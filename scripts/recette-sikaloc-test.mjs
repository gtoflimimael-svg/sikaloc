#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  statSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SI_TEST_REF = 'epjpcmvdvshxfsydltgf'
export const SI_TEST_URL = `https://${SI_TEST_REF}.supabase.co`

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fichiersEnvNext = [
  '.env.development.local',
  '.env.local',
  '.env.development',
  '.env',
]

const variablesControlees = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SIKALOC_TEST_BACKUP_MANIFEST',
  'NEXT_PUBLIC_SITE_URL',
  'APP_NAME',
  'FEDAPAY_PUBLIC_KEY',
  'FEDAPAY_SECRET_KEY',
  'FEDAPAY_ENV',
  'FEDAPAY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'EMAIL_FROM_NAME',
  'CRON_SECRET',
  'EMAIL_EXPLOITATION',
  'SIKALOC_QUESTIONS_ADMIN_IDS',
  'SIKALOC_QUESTIONS_NOTIFICATIONS_ACTIVE',
  'VERIFICATION_GOOGLE',
  'VERIFICATION_BING',
  'NEXT_PUBLIC_EMAIL_OTP_LENGTH',
  'OTP_SECRET',
  'SMS_FOURNISSEUR',
  'SMS_IDENTIFIANT',
  'SMS_JETON',
  'SMS_EXPEDITEUR',
  'WHATSAPP_ID_TELEPHONE',
  'WHATSAPP_JETON',
  'NEXT_PUBLIC_WHATSAPP_SUPPORT',
  'OTP_CANAL_DEV',
  'SIKALOC_MAINTENANCE_MODE',
  'GUIDE_EMAILS_JOURNAL',
  'SIKALOC_DEMO_LOCAL',
  'SIKALOC_DEMO_EXPECTED_PROJECT_ID',
])

const controlesRestaurationPostgres = [
  'schemas',
  'tables',
  'constraints',
  'functions',
  'triggers',
  'rls',
  'aggregateCounts',
  'authUsersAndIdentities',
]

function estDansDepot(chemin) {
  const relatif = path.relative(racine, chemin)
  return relatif === '' || (!relatif.startsWith(`..${path.sep}`) && relatif !== '..' && !path.isAbsolute(relatif))
}

function lireFichierPrive(chemin, base, libelle, limiteOctets = Number.POSITIVE_INFINITY) {
  if (typeof chemin !== 'string' || !chemin.trim()) {
    throw new Error(`${libelle} : chemin manquant.`)
  }

  const candidat = path.isAbsolute(chemin) ? chemin : path.resolve(base, chemin)
  let lstat
  try {
    lstat = lstatSync(candidat)
  } catch {
    throw new Error(`${libelle} : fichier absent ou inaccessible.`)
  }
  if (lstat.isSymbolicLink() || !lstat.isFile() || lstat.size === 0) {
    throw new Error(`${libelle} : fichier absent, vide ou symbolique.`)
  }

  const cheminReel = realpathSync(candidat)
  if (estDansDepot(cheminReel)) {
    throw new Error(`${libelle} : les preuves doivent rester hors du dépôt.`)
  }

  const fichier = statSync(cheminReel)
  const dossier = statSync(path.dirname(cheminReel))
  if (process.platform !== 'win32' && ((fichier.mode & 0o077) !== 0 || (dossier.mode & 0o077) !== 0)) {
    throw new Error(`${libelle} : permissions trop ouvertes; fichier privé et dossier 0700 requis.`)
  }
  if (fichier.size > limiteOctets) {
    throw new Error(`${libelle} : taille supérieure à la limite autorisée.`)
  }

  return { chemin: cheminReel, taille: fichier.size }
}

function calculerSha256(chemin) {
  const fd = openSync(chemin, 'r')
  const hash = createHash('sha256')
  const bloc = Buffer.allocUnsafe(1024 * 1024)
  try {
    let lus
    while ((lus = readSync(fd, bloc, 0, bloc.length, null)) > 0) {
      hash.update(bloc.subarray(0, lus))
    }
  } finally {
    closeSync(fd)
  }
  return hash.digest('hex')
}

function verifierFichierAvecEmpreinte(reference, base, libelle) {
  const fichier = lireFichierPrive(reference?.path, base, libelle)
  const attendue = reference?.sha256
  if (typeof attendue !== 'string' || !/^[a-f0-9]{64}$/i.test(attendue)) {
    throw new Error(`${libelle} : empreinte SHA-256 absente ou invalide.`)
  }
  const obtenue = calculerSha256(fichier.chemin)
  if (obtenue !== attendue.toLowerCase()) {
    throw new Error(`${libelle} : empreinte SHA-256 incohérente.`)
  }
  return { ...fichier, sha256: obtenue }
}

function verifierArchiveChiffree(reference, base, libelle) {
  if (reference?.encryption !== 'openpgp-armored') {
    throw new Error(`${libelle} : chiffrement OpenPGP requis.`)
  }
  const fichier = verifierFichierAvecEmpreinte(reference, base, libelle)
  const fd = openSync(fichier.chemin, 'r')
  const prefixe = Buffer.from('-----BEGIN PGP MESSAGE-----')
  const debut = Buffer.alloc(prefixe.length)
  let lus
  try {
    lus = readSync(fd, debut, 0, debut.length, 0)
  } finally {
    closeSync(fd)
  }
  if (lus !== prefixe.length || !debut.equals(prefixe)) {
    throw new Error(`${libelle} : l’en-tête d’archive OpenPGP est invalide.`)
  }
  return fichier
}

function lireRapport(reference, base, libelle) {
  const fichier = verifierFichierAvecEmpreinte(reference, base, libelle)
  try {
    return {
      fichier,
      rapport: JSON.parse(readFileSync(fichier.chemin, 'utf8')),
    }
  } catch {
    throw new Error(`${libelle} : rapport JSON illisible.`)
  }
}

function chargerManifesteRecette(cheminManifest) {
  if (typeof cheminManifest !== 'string' || !path.isAbsolute(cheminManifest)) {
    throw new Error('Manifeste de sauvegarde : chemin absolu externe requis.')
  }
  const manifeste = lireFichierPrive(
    cheminManifest,
    process.cwd(),
    'Manifeste de sauvegarde',
    1024 * 1024,
  )

  let contenu
  try {
    contenu = JSON.parse(readFileSync(manifeste.chemin, 'utf8'))
  } catch {
    throw new Error('Manifeste de sauvegarde : JSON illisible.')
  }

  if (contenu.format !== 'sikaloc-test-evidence/v1' || contenu.projectRef !== SI_TEST_REF) {
    throw new Error('Manifeste de sauvegarde : format ou référence de projet incorrecte.')
  }
  const date = Date.parse(contenu.createdAt)
  if (!Number.isFinite(date) || date > Date.now() || Date.now() - date > 7 * 24 * 60 * 60 * 1000) {
    throw new Error('Manifeste de sauvegarde : date absente, future ou âgée de plus de 7 jours.')
  }
  return { contenu, base: path.dirname(manifeste.chemin) }
}

function verifierPreuvesSauvegardes(cheminManifest) {
  const { contenu, base } = chargerManifesteRecette(cheminManifest)
  const dump = verifierArchiveChiffree(contenu.postgres?.archive, base, 'Archive PostgreSQL')
  const rapportDb = lireRapport(contenu.postgres?.restoreReport, base, 'Rapport de restauration PostgreSQL').rapport
  if (
    rapportDb.format !== 'sikaloc-test-postgres-restore/v1' ||
    rapportDb.projectRef !== SI_TEST_REF ||
    rapportDb.status !== 'passed' ||
    rapportDb.isolatedTarget !== true ||
    rapportDb.sourceArchiveSha256 !== dump.sha256 ||
    !controlesRestaurationPostgres.every((controle) => rapportDb.checks?.[controle] === true)
  ) {
    throw new Error('Restauration PostgreSQL non démontrée par un rapport isolé complet.')
  }

  const archiveStorage = verifierArchiveChiffree(contenu.storage?.archive, base, 'Archive Storage')
  const inventaireStorageResultat = lireRapport(contenu.storage?.inventory, base, 'Inventaire Storage')
  const inventaireStorage = inventaireStorageResultat.rapport
  const objets = inventaireStorage.objects
  if (
    inventaireStorage.format !== 'sikaloc-test-storage-inventory/v1' ||
    inventaireStorage.projectRef !== SI_TEST_REF ||
    !Array.isArray(objets) ||
    objets.some((objet) =>
      typeof objet.bucket !== 'string' || !objet.bucket ||
      typeof objet.key !== 'string' || !objet.key ||
      !Number.isSafeInteger(objet.sizeBytes) || objet.sizeBytes < 0 ||
      typeof objet.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(objet.sha256))
  ) {
    throw new Error('Inventaire Storage absent, invalide ou incomplet.')
  }
  const clesObjets = objets.map((objet) => `${objet.bucket}\0${objet.key}`)
  if (new Set(clesObjets).size !== objets.length) {
    throw new Error('Inventaire Storage : chemins d’objet dupliqués.')
  }

  const rapportStorage = lireRapport(
    contenu.storage?.restoreReport,
    base,
    'Rapport de restauration Storage',
  ).rapport
  if (
    rapportStorage.format !== 'sikaloc-test-storage-restore/v1' ||
    rapportStorage.projectRef !== SI_TEST_REF ||
    rapportStorage.status !== 'passed' ||
    rapportStorage.isolatedTarget !== true ||
    rapportStorage.archiveSha256 !== archiveStorage.sha256 ||
    rapportStorage.inventorySha256 !== inventaireStorageResultat.fichier.sha256 ||
    rapportStorage.restoredObjectsCount !== objets.length ||
    rapportStorage.objectHashesVerified !== true
  ) {
    throw new Error('Restauration Storage non démontrée pour tous les objets inventoriés.')
  }

  return { postgres: true, storageObjects: objets.length }
}

function verifierPreuveEmailAuth(cheminManifest) {
  if (typeof cheminManifest !== 'string' || !path.isAbsolute(cheminManifest)) {
    throw new Error('Rapport Auth absent : configuration et boîte contrôlée doivent être vérifiées.')
  }
  const { contenu, base } = chargerManifesteRecette(cheminManifest)
  const rapportEmail = lireRapport(contenu.authEmail?.report, base, 'Preuve email Auth').rapport
  if (
    rapportEmail.format !== 'sikaloc-test-auth-email/v1' ||
    rapportEmail.projectRef !== SI_TEST_REF ||
    rapportEmail.status !== 'passed' ||
    rapportEmail.confirmationRequired !== true ||
    rapportEmail.smtpConfigured !== true ||
    rapportEmail.redirectAllowlistVerified !== true ||
    rapportEmail.controlledMailboxTestPassed !== true ||
    rapportEmail.existingUsersContacted !== false
  ) {
    throw new Error('Configuration et réception contrôlée des emails Auth non démontrées.')
  }
  return true
}

function verifierConfigurationCles(source) {
  const url = verifierUrlTest(source.SIKALOC_TEST_SUPABASE_URL ?? '')
  const clePublique = source.SIKALOC_TEST_SUPABASE_ANON_KEY?.trim() ?? ''
  const cleService = source.SIKALOC_TEST_SERVICE_ROLE_KEY?.trim() ?? ''

  if (!clePublique) throw new Error('SIKALOC_TEST_SUPABASE_ANON_KEY est requise.')
  if (!cleService) throw new Error('SIKALOC_TEST_SERVICE_ROLE_KEY est requise pour les routes serveur.')

  if (clePublique.split('.').length === 3) {
    verifierCleJwt(clePublique, 'anon', 'SIKALOC_TEST_SUPABASE_ANON_KEY')
  } else if (!clePublique.startsWith('sb_publishable_')) {
    throw new Error('La clé publique Test doit être une clé anon JWT ou sb_publishable_.')
  }
  verifierCleJwt(cleService, 'service_role', 'SIKALOC_TEST_SERVICE_ROLE_KEY')
  return { url, clePublique, cleService }
}

export function diagnostiquerPrerequisRecette(source = process.env, nomsEnvCharges = []) {
  const controles = []
  const ajouter = (nom, verifier) => {
    try {
      const detail = verifier()
      controles.push({ nom, statut: 'OK', detail })
    } catch (cause) {
      controles.push({ nom, statut: 'BLOQUÉ', detail: cause.message })
    }
  }

  ajouter('Variables .env', () => {
    const inconnues = nomsEnvCharges.filter((nom) => !variablesControlees.has(nom))
    if (inconnues.length) throw new Error(`noms à examiner : ${inconnues.join(', ')}`)
    return 'noms reconnus; valeurs non affichées'
  })
  ajouter('Cible Supabase', () => verifierUrlTest(source.SIKALOC_TEST_SUPABASE_URL ?? ''))
  ajouter('Clés Supabase Test', () => {
    verifierConfigurationCles(source)
    return 'présentes et projet/roles vérifiés sans afficher les clés'
  })
  ajouter('Sauvegardes et restauration', () => {
    const preuves = verifierPreuvesSauvegardes(source.SIKALOC_TEST_BACKUP_MANIFEST ?? '')
    return `PostgreSQL et Storage restaurés en isolation; ${preuves.storageObjects} objets vérifiés`
  })
  ajouter('Email Supabase Auth', () => {
    verifierPreuveEmailAuth(source.SIKALOC_TEST_BACKUP_MANIFEST ?? '')
    return 'configuration et réception contrôlée attestées dans le manifeste vérifié'
  })
  ajouter('FedaPay', () => {
    const secret = source.SIKALOC_TEST_FEDAPAY_SECRET_KEY?.trim() ?? ''
    const publique = source.SIKALOC_TEST_FEDAPAY_PUBLIC_KEY?.trim() ?? ''
    const webhook = source.SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET?.trim() ?? ''
    if (Boolean(secret || publique || webhook) && !(secret && publique && webhook)) {
      throw new Error('configuration sandbox incomplète')
    }
    if (secret && !secret.startsWith('sk_sandbox')) throw new Error('seule une clé sandbox est autorisée')
    return secret ? 'sandbox configuré' : 'désactivé'
  })
  ajouter('Runtime Node.js', () => {
    if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Node.js 22.x requis')
    return process.versions.node
  })
  return controles
}

export function extraireNomsVariables(contenu) {
  return [...contenu.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)]
    .map((correspondance) => correspondance[1])
}

export function collecterNomsEnvNext(repertoire = racine) {
  const noms = new Set()

  for (const fichier of fichiersEnvNext) {
    try {
      for (const nom of extraireNomsVariables(
        readFileSync(path.join(repertoire, fichier), 'utf8'),
      )) {
        noms.add(nom)
      }
    } catch (cause) {
      if (cause?.code !== 'ENOENT') throw cause
    }
  }

  return [...noms].sort()
}

function lireClaimsJwt(cle) {
  const segments = cle.split('.')
  if (segments.length !== 3) return null

  try {
    return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function verifierCleJwt(cle, roleAttendu, nomVariable) {
  const claims = lireClaimsJwt(cle)
  if (!claims || claims.ref !== SI_TEST_REF || claims.role !== roleAttendu) {
    throw new Error(
      `${nomVariable} doit être une clé JWT du projet Sikaloc-Test avec le rôle ${roleAttendu}. Aucune clé n’a été affichée.`,
    )
  }
}

function verifierUrlTest(urlBrute) {
  let url
  try {
    url = new URL(urlBrute)
  } catch {
    throw new Error('SIKALOC_TEST_SUPABASE_URL est absente ou invalide.')
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== `${SI_TEST_REF}.supabase.co` ||
    url.port !== '' ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.search !== '' ||
    url.hash !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error(
      `Refus de lancer la recette : l’URL doit cibler exclusivement ${SI_TEST_REF}.`,
    )
  }

  return SI_TEST_URL
}

export function construireEnvironnementRecette(source = process.env, nomsEnvCharges = []) {
  const inconnues = nomsEnvCharges.filter((nom) => !variablesControlees.has(nom))
  if (inconnues.length) {
    throw new Error(
      `Variables des fichiers .env à examiner avant lancement : ${inconnues.join(', ')}.`,
    )
  }

  const configuration = verifierConfigurationCles(source)
  verifierPreuvesSauvegardes(source.SIKALOC_TEST_BACKUP_MANIFEST ?? '')
  verifierPreuveEmailAuth(source.SIKALOC_TEST_BACKUP_MANIFEST ?? '')
  const { url, clePublique, cleService } = configuration

  const secretFedapay = source.SIKALOC_TEST_FEDAPAY_SECRET_KEY?.trim() ?? ''
  const cleFedapayPublique = source.SIKALOC_TEST_FEDAPAY_PUBLIC_KEY?.trim() ?? ''
  const secretWebhookFedapay = source.SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET?.trim() ?? ''
  const fedapayPartiel = Boolean(secretFedapay || cleFedapayPublique || secretWebhookFedapay)

  if (fedapayPartiel && !(secretFedapay && cleFedapayPublique && secretWebhookFedapay)) {
    throw new Error(
      'Pour activer FedaPay, les trois identifiants Test (public, secret et webhook) sont requis.',
    )
  }
  if (secretFedapay && !secretFedapay.startsWith('sk_sandbox')) {
    throw new Error('FedaPay est refusé : seule une clé sk_sandbox est autorisée.')
  }

  const environnement = {}
  for (const nom of [
    'PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'TERM', 'SYSTEMROOT', 'WINDIR',
  ]) {
    if (source[nom] !== undefined) environnement[nom] = source[nom]
  }
  for (const nom of nomsEnvCharges) {
    environnement[nom] = ''
  }

  Object.assign(environnement, {
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
    PORT: '3000',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: clePublique,
    SUPABASE_SERVICE_ROLE_KEY: cleService,
    APP_NAME: 'Sikaloc | recette Test',
    SIKALOC_MAINTENANCE_MODE: 'off',
    SIKALOC_DEMO_LOCAL: '',
    SIKALOC_DEMO_EXPECTED_PROJECT_ID: '',
    OTP_SECRET: source.SIKALOC_TEST_OTP_SECRET || randomBytes(32).toString('base64url'),
    CRON_SECRET: source.SIKALOC_TEST_CRON_SECRET || randomBytes(32).toString('base64url'),
    NEXT_PUBLIC_EMAIL_OTP_LENGTH: '6',
    OTP_CANAL_DEV: '0',
    FEDAPAY_ENV: 'sandbox',
    FEDAPAY_PUBLIC_KEY: cleFedapayPublique,
    FEDAPAY_SECRET_KEY: secretFedapay,
    FEDAPAY_WEBHOOK_SECRET: secretWebhookFedapay,
    RESEND_API_KEY: '',
    EMAIL_FROM: '',
    EMAIL_FROM_NAME: 'Sikaloc | recette Test',
    EMAIL_EXPLOITATION: '',
    SIKALOC_QUESTIONS_ADMIN_IDS: '',
    SIKALOC_QUESTIONS_NOTIFICATIONS_ACTIVE: '',
    SMS_FOURNISSEUR: '',
    SMS_IDENTIFIANT: '',
    SMS_JETON: '',
    SMS_EXPEDITEUR: '',
    WHATSAPP_ID_TELEPHONE: '',
    WHATSAPP_JETON: '',
    NEXT_PUBLIC_WHATSAPP_SUPPORT: '',
    VERIFICATION_GOOGLE: '',
    VERIFICATION_BING: '',
    GUIDE_EMAILS_JOURNAL: '',
  })

  for (const nom of ['SIKALOC_TEST_SUPABASE_URL', 'SIKALOC_TEST_SUPABASE_ANON_KEY',
    'SIKALOC_TEST_SERVICE_ROLE_KEY', 'SIKALOC_TEST_OTP_SECRET', 'SIKALOC_TEST_CRON_SECRET',
    'SIKALOC_TEST_FEDAPAY_PUBLIC_KEY', 'SIKALOC_TEST_FEDAPAY_SECRET_KEY',
    'SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET']) {
    delete environnement[nom]
  }

  return environnement
}

export function afficherPreflightRecette(source = process.env, nomsEnvCharges = []) {
  console.info('Préflight Sikaloc-Test — lecture seule; aucune application ni connexion ne sera démarrée.')
  const controles = diagnostiquerPrerequisRecette(source, nomsEnvCharges)
  for (const controle of controles) {
    console.info(`[${controle.statut}] ${controle.nom} : ${controle.detail}`)
  }
  if (controles.some((controle) => controle.statut !== 'OK')) {
    console.info('État : BLOQUÉ pour le lancement connecté; le préflight consultatif est terminé.')
  } else {
    console.info('État : prérequis vérifiés; le préflight n’a démarré aucun service.')
  }
  return controles
}

export function lancerRecette(source = process.env, repertoire = racine) {
  const environnement = construireEnvironnementRecette(
    source,
    collecterNomsEnvNext(repertoire),
  )

  if (Number(process.versions.node.split('.')[0]) !== 22) {
    throw new Error('La recette Sikaloc-Test exige Node.js 22.x, conformément au projet.')
  }

  const binaireNext = path.join(repertoire, 'node_modules', 'next', 'dist', 'bin', 'next')
  const serveur = spawn(
    process.execPath,
    [binaireNext, 'dev', '--hostname', '127.0.0.1', '--port', '3000'],
    { cwd: repertoire, env: environnement, stdio: 'inherit' },
  )

  console.info(
    `Recette isolée Sikaloc-Test (${SI_TEST_REF}) sur http://localhost:3000. ` +
    `Emails, SMS et WhatsApp sont désactivés ; FedaPay sandbox ${environnement.FEDAPAY_SECRET_KEY ? 'configuré' : 'désactivé'}.`,
  )

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => serveur.kill(signal))
  }
  serveur.on('error', (cause) => {
    console.error(`Impossible de démarrer Next.js (${cause.code ?? 'erreur'}).`)
    process.exitCode = 1
  })
  serveur.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0)
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--preflight')) {
      afficherPreflightRecette(process.env, collecterNomsEnvNext())
    } else {
      lancerRecette()
    }
  } catch (cause) {
    console.error(`Recette Sikaloc-Test arrêtée sans démarrer l’application : ${cause.message}`)
    process.exitCode = 1
  }
}
