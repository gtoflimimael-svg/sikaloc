#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import {
  constants,
  fstatSync,
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
const cheminConfigurationRecette = path.join(homedir(), '.config', 'sikaloc-test', 'app.env')
const cheminConfigurationAdminRecette = path.join(homedir(), '.config', 'sikaloc-test', 'admin.env')
const fichiersEnvNext = [
  '.env.development.local',
  '.env.local',
  '.env.development',
  '.env',
]

const variablesControlees = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
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

const variablesAutoriseesConfigurationRecette = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SIKALOC_TEST_SUPABASE_URL',
  'SIKALOC_TEST_SUPABASE_ANON_KEY',
  'SIKALOC_TEST_SUPABASE_PUBLISHABLE_KEY',
  'SIKALOC_TEST_SUPABASE_SECRET_KEY',
  'SIKALOC_TEST_SERVICE_ROLE_KEY',
  'SIKALOC_TEST_BACKUP_MANIFEST',
  'SIKALOC_TEST_OTP_SECRET',
  'SIKALOC_TEST_CRON_SECRET',
  'SIKALOC_TEST_FEDAPAY_PUBLIC_KEY',
  'SIKALOC_TEST_FEDAPAY_SECRET_KEY',
  'SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET',
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

function lireValeurEnv(texte, numeroLigne) {
  const valeur = texte.trim()
  if (!valeur) return ''

  const guillemet = valeur[0]
  if (guillemet === '"' || guillemet === "'") {
    let fin = -1
    for (let index = 1; index < valeur.length; index += 1) {
      if (valeur[index] === guillemet && valeur[index - 1] !== '\\') {
        fin = index
        break
      }
    }
    if (fin < 0 || (valeur.slice(fin + 1).trim() && !valeur.slice(fin + 1).trim().startsWith('#'))) {
      throw new Error(`Configuration Sikaloc-Test : syntaxe invalide à la ligne ${numeroLigne}.`)
    }
    const contenu = valeur.slice(1, fin)
    const decode = guillemet === '"'
      ? contenu.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : contenu
    if (/[\r\n\0]/.test(decode)) {
      throw new Error(`Configuration Sikaloc-Test : valeur multilignes refusée à la ligne ${numeroLigne}.`)
    }
    return decode
  }

  const commentaire = valeur.search(/\s#/)
  const sansCommentaire = commentaire < 0 ? valeur : valeur.slice(0, commentaire)
  if (/[\0\r\n]/.test(sansCommentaire)) {
    throw new Error(`Configuration Sikaloc-Test : valeur invalide à la ligne ${numeroLigne}.`)
  }
  return sansCommentaire.trimEnd()
}

export function chargerConfigurationRecettePrivee(chemin = cheminConfigurationRecette, { optional = false } = {}) {
  if (typeof chemin !== 'string' || !path.isAbsolute(chemin)) {
    throw new Error('Configuration Sikaloc-Test : chemin absolu requis.')
  }

  let lstat
  try {
    lstat = lstatSync(chemin)
  } catch (cause) {
    if (optional && cause?.code === 'ENOENT') return {}
    throw new Error('Configuration Sikaloc-Test : fichier absent ou inaccessible.')
  }
  if (lstat.isSymbolicLink() || !lstat.isFile()) {
    throw new Error('Configuration Sikaloc-Test : fichier ordinaire requis; liens symboliques refusés.')
  }

  const cheminReel = realpathSync(chemin)
  if (estDansDepot(cheminReel)) {
    throw new Error('Configuration Sikaloc-Test : le fichier doit rester hors du dépôt.')
  }

  const dossier = path.dirname(cheminReel)
  let statDossier
  try {
    const dossierLstat = lstatSync(dossier)
    if (dossierLstat.isSymbolicLink() || !dossierLstat.isDirectory()) {
      throw new Error('Configuration Sikaloc-Test : dossier privé invalide.')
    }
    statDossier = statSync(dossier)
  } catch {
    throw new Error('Configuration Sikaloc-Test : dossier privé absent ou invalide.')
  }

  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined
  if (
    process.platform !== 'win32' &&
    ((statDossier.mode & 0o077) !== 0 || (lstat.mode & 0o077) !== 0 || (lstat.mode & 0o111) !== 0 ||
      (uid !== undefined && (statDossier.uid !== uid || lstat.uid !== uid)))
  ) {
    throw new Error('Configuration Sikaloc-Test : fichier et dossier doivent appartenir à l’utilisateur et rester privés (0600/0700).')
  }
  if ([cheminConfigurationRecette, cheminConfigurationAdminRecette].includes(path.resolve(chemin))) {
    const dossierConfig = path.join(homedir(), '.config')
    let statConfig
    try {
      const configLstat = lstatSync(dossierConfig)
      if (configLstat.isSymbolicLink() || !configLstat.isDirectory()) {
        throw new Error('Configuration Sikaloc-Test : dossier .config invalide.')
      }
      statConfig = statSync(dossierConfig)
    } catch {
      throw new Error('Configuration Sikaloc-Test : dossier .config absent ou invalide.')
    }
    if (
      process.platform !== 'win32' &&
      ((statConfig.mode & 0o077) !== 0 || (uid !== undefined && statConfig.uid !== uid))
    ) {
      throw new Error('Configuration Sikaloc-Test : le dossier .config doit appartenir à l’utilisateur et rester privé.')
    }
  }
  if (lstat.size === 0 || lstat.size > 64 * 1024) {
    throw new Error('Configuration Sikaloc-Test : fichier vide ou supérieur à 64 Ko.')
  }

  let fd
  let contenu
  try {
    const options = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    fd = openSync(cheminReel, options)
    const statOuvert = fstatSync(fd)
    if (
      !statOuvert.isFile() || statOuvert.size === 0 || statOuvert.size > 64 * 1024 ||
      (process.platform !== 'win32' &&
        ((statOuvert.mode & 0o077) !== 0 || (statOuvert.mode & 0o111) !== 0 ||
          (uid !== undefined && statOuvert.uid !== uid)))
    ) {
      throw new Error('Configuration Sikaloc-Test : fichier modifié ou invalide à l’ouverture.')
    }
    contenu = readFileSync(fd, 'utf8')
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('Configuration Sikaloc-Test :')) throw cause
    throw new Error('Configuration Sikaloc-Test : lecture sécurisée impossible.')
  } finally {
    if (fd !== undefined) closeSync(fd)
  }

  const configuration = {}
  const lignes = contenu.replace(/^\uFEFF/, '').split(/\r?\n/)
  for (let index = 0; index < lignes.length; index += 1) {
    const ligne = lignes[index]
    if (!ligne.trim() || ligne.trimStart().startsWith('#')) continue
    const correspondance = ligne.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=([\s\S]*)$/)
    if (!correspondance) {
      throw new Error(`Configuration Sikaloc-Test : syntaxe invalide à la ligne ${index + 1}.`)
    }
    const nom = correspondance[1]
    if (!variablesAutoriseesConfigurationRecette.has(nom)) {
      throw new Error(`Configuration Sikaloc-Test : variable non autorisée « ${nom} » à la ligne ${index + 1}.`)
    }
    if (Object.hasOwn(configuration, nom)) {
      throw new Error(`Configuration Sikaloc-Test : variable dupliquée « ${nom} ».`)
    }
    configuration[nom] = lireValeurEnv(correspondance[2], index + 1)
  }
  return configuration
}

export function fusionnerConfigurationRecettePrivee(
  source = process.env,
  chemin = cheminConfigurationRecette,
  cheminAdmin = path.resolve(chemin) === cheminConfigurationRecette ? cheminConfigurationAdminRecette : null,
) {
  const fichiersPrives = [chargerConfigurationRecettePrivee(chemin)]
  if (cheminAdmin) {
    fichiersPrives.push(
      chargerConfigurationRecettePrivee(cheminAdmin, { optional: cheminAdmin === cheminConfigurationAdminRecette }),
    )
  }
  const normalisee = {}
  const aliases = new Map([
    ['NEXT_PUBLIC_SUPABASE_URL', 'SIKALOC_TEST_SUPABASE_URL'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SIKALOC_TEST_SUPABASE_ANON_KEY'],
    ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SIKALOC_TEST_SUPABASE_ANON_KEY'],
    ['SIKALOC_TEST_SUPABASE_PUBLISHABLE_KEY', 'SIKALOC_TEST_SUPABASE_ANON_KEY'],
    ['SIKALOC_TEST_SUPABASE_SECRET_KEY', 'SIKALOC_TEST_SERVICE_ROLE_KEY'],
  ])

  for (const privee of fichiersPrives) {
    for (const [nom, valeur] of Object.entries(privee)) {
      const destination = aliases.get(nom) ?? nom
      if (valeur === '') continue
      if (Object.hasOwn(normalisee, destination) && normalisee[destination] !== valeur) {
        throw new Error(`Configuration Sikaloc-Test : valeurs contradictoires pour « ${destination} ».`)
      }
      normalisee[destination] = valeur
    }
  }

  const fusion = { ...source }
  for (const [nom, valeur] of Object.entries(normalisee)) {
    if (fusion[nom] && fusion[nom] !== valeur) {
      throw new Error(`Configuration Sikaloc-Test : conflit pour « ${nom} » entre le fichier privé et l’environnement.`)
    }
    fusion[nom] = valeur
  }
  return fusion
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
  const cheminDossier = path.dirname(cheminReel)
  const dossierLstat = lstatSync(cheminDossier)
  const dossier = statSync(cheminDossier)
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined
  if (
    dossierLstat.isSymbolicLink() || !dossier.isDirectory() ||
    (process.platform !== 'win32' && (
      (fichier.mode & 0o077) !== 0 || (dossier.mode & 0o077) !== 0 ||
      (uid !== undefined && (fichier.uid !== uid || dossier.uid !== uid))
    ))
  ) {
    throw new Error(`${libelle} : fichier et dossier doivent être privés, non symboliques et appartenir à l’utilisateur.`)
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

function comparerEntreesEnregistrees(attendues, obtenues) {
  if (!attendues || !obtenues || typeof attendues !== 'object' || typeof obtenues !== 'object') {
    return false
  }
  return Object.entries(attendues).every(([cle, valeur]) => obtenues[cle] === valeur)
}

function verifierFichierLegacy(base, nom, reference, libelle) {
  if (typeof nom !== 'string' || !nom || path.basename(nom) !== nom) {
    throw new Error(`${libelle} : nom de fichier inattendu.`)
  }
  const fichier = lireFichierPrive(path.join(base, nom), base, libelle)
  const dossier = statSync(base)
  const empreinte = calculerSha256(fichier.chemin)
  if (
    (process.platform !== 'win32' && (fichier.taille === 0 || (dossier.mode & 0o777) !== 0o700)) ||
    reference?.mode !== '600' ||
    (process.platform !== 'win32' && (statSync(fichier.chemin).mode & 0o777) !== 0o600) ||
    !Number.isSafeInteger(reference?.bytes) || reference.bytes !== fichier.taille ||
    typeof reference?.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(reference.sha256) ||
    empreinte !== reference.sha256.toLowerCase()
  ) {
    throw new Error(`${libelle} : taille, permissions ou empreinte SHA-256 incohérente.`)
  }
  return { ...fichier, sha256: empreinte }
}

function verifierPreuvesLegacySikalocTest(contenu, base) {
  const cible = contenu.target
  if (
    contenu.schema_version !== 1 ||
    cible?.environment !== 'Sikaloc-Test' ||
    cible?.project_ref !== SI_TEST_REF ||
    cible?.region !== 'eu-central-1' ||
    cible?.postgres_version !== '17.11' ||
    contenu.local_protection?.directory_mode !== '0700' ||
    contenu.local_protection?.files_mode !== '0600' ||
    contenu.local_protection?.encrypted_at_rest !== false
  ) {
    throw new Error('Manifeste historique : environnement, protection locale ou référence Test incohérents.')
  }

  const postgres = contenu.postgres
  if (postgres?.format !== 'pg_dump custom') {
    throw new Error('Manifeste historique : format PostgreSQL inattendu.')
  }
  const dump = verifierFichierLegacy(
    base,
    postgres.file,
    postgres.archive,
    'Archive PostgreSQL historique',
  )
  const rapports = lireFichierPrive(
    path.join(base, 'restoration-validation.json'),
    base,
    'Rapport historique de restauration',
    2 * 1024 * 1024,
  )
  if (
    process.platform !== 'win32' &&
    (statSync(rapports.chemin).mode & 0o777) !== 0o600
  ) {
    throw new Error('Rapport historique de restauration : permissions 0600 requises.')
  }
  let restauration
  try {
    restauration = JSON.parse(readFileSync(rapports.chemin, 'utf8'))
  } catch {
    throw new Error('Rapport historique de restauration : JSON illisible.')
  }

  const source = restauration.source
  const archiveDb = restauration.postgres_archive
  const restaurationIsolee = restauration.isolated_restore
  const restaurationManifeste = postgres.restoration
  const comptes = postgres.rows_verified_from_archive
  const catalogues = postgres.source_catalog_counts_verified
  const schemasRequis = ['auth', 'public', 'storage', 'supabase_migrations']
  const tablesRequises = [
    'auth.users', 'auth.identities', 'public.bailleurs', 'public.logements',
    'public.locataires', 'public.baux', 'public.paiements', 'public.quittances',
    'public.signatures_apposees', 'storage.objects', 'supabase_migrations.schema_migrations',
  ]
  const cataloguesRequis = [
    'functions', 'triggers', 'policies', 'constraints', 'row_security_tables',
  ]
  if (
    source?.environment !== 'Sikaloc-Test' || source?.project_ref !== SI_TEST_REF ||
    source?.postgres_version !== '17.11' ||
    archiveDb?.file !== postgres.file || archiveDb?.format !== 'pg_dump custom' ||
    archiveDb?.bytes !== dump.taille || archiveDb?.sha256 !== postgres.archive.sha256 ||
    archiveDb?.pg_restore_list !== 'passed' ||
    restaurationManifeste?.status !== 'succeeded' ||
    restaurationManifeste?.source_server_version !== '17.11' ||
    restaurationManifeste?.restored_server_version !== '17.6' ||
    restaurationManifeste?.network_mode !== 'none' ||
    !String(restaurationManifeste?.data_storage ?? '').toLowerCase().includes('tmpfs') ||
    !schemasRequis.every((schema) => archiveDb.schemas_covered?.includes(schema)) ||
    !tablesRequises.every((table) => Number.isSafeInteger(comptes?.[table]) && comptes[table] >= 0) ||
    !comparerEntreesEnregistrees(comptes, archiveDb.row_counts_verified_after_restore) ||
    !comparerEntreesEnregistrees(comptes, restaurationManifeste?.verified_row_counts) ||
    !cataloguesRequis.every((nom) => Number.isSafeInteger(catalogues?.[nom]) && catalogues[nom] >= 0) ||
    !comparerEntreesEnregistrees(catalogues, restaurationManifeste?.verified_catalog_counts) ||
    !comparerEntreesEnregistrees(catalogues, archiveDb.source_and_restored_catalog_counts) ||
    restaurationIsolee?.status !== 'success' ||
    restaurationIsolee?.postgres_version !== '17.6' ||
    restaurationIsolee?.network !== 'none' ||
    restaurationIsolee?.bind_mounts !== 0 ||
    restaurationIsolee?.persistent_volumes !== 0 ||
    !String(restaurationIsolee?.data_directory ?? '').toLowerCase().includes('tmpfs')
  ) {
    throw new Error('Restauration PostgreSQL historique : périmètre Test ou contrôles isolés incohérents.')
  }

  const storage = contenu.storage
  const archiveStorage = verifierFichierLegacy(
    base,
    storage?.archive,
    storage?.archive_integrity,
    'Archive Storage historique',
  )
  const manifesteStorage = verifierFichierLegacy(
    base,
    storage?.manifest,
    storage?.manifest_integrity,
    'Manifeste Storage historique',
  )
  let inventaire
  try {
    inventaire = JSON.parse(readFileSync(manifesteStorage.chemin, 'utf8'))
  } catch {
    throw new Error('Manifeste Storage historique : JSON illisible.')
  }
  const objets = inventaire.files
  const comptesParBucket = Array.isArray(objets)
    ? objets.reduce((comptesBucket, objet) => {
      if (typeof objet.bucket === 'string' && objet.bucket) {
        comptesBucket[objet.bucket] = (comptesBucket[objet.bucket] ?? 0) + 1
      }
      return comptesBucket
    }, {})
    : {}
  const tailleTotaleObjets = Array.isArray(objets)
    ? objets.reduce((total, objet) => total + (Number.isSafeInteger(objet.bytes) ? objet.bytes : 0), 0)
    : 0
  if (
    inventaire.project_ref !== SI_TEST_REF ||
    !Array.isArray(objets) || objets.length !== storage.objects ||
    objets.some((objet) =>
      typeof objet.bucket !== 'string' || !objet.bucket ||
      typeof objet.path !== 'string' || !objet.path ||
      !Number.isSafeInteger(objet.bytes) || objet.bytes < 0 ||
      typeof objet.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(objet.sha256)) ||
    tailleTotaleObjets !== storage.bytes ||
    !comparerEntreesEnregistrees(storage.by_bucket, comptesParBucket) ||
    restauration.storage_archive?.sha256 !== archiveStorage.sha256 ||
    restauration.storage_archive?.manifest_sha256 !== manifesteStorage.sha256 ||
    restauration.storage_archive?.objects_expected_and_archived !== objets.length ||
    restauration.storage_archive?.extracted_file_count !== objets.length ||
    restauration.storage_archive?.extracted_hash_and_size_matches !== objets.length ||
    restauration.storage_archive?.storage_service_import_tested !== false
  ) {
    throw new Error('Restauration Storage historique : inventaire, empreintes ou compteurs incohérents.')
  }

  const etapesInterdites = [
    'production_project_accessed', 'hosted_test_written', 'hosted_migrations_applied',
    'auth_accounts_created', 'emails_sent', 'payments_triggered', 'push_or_deployment',
  ]
  if (!etapesInterdites.every((nom) => restauration.safety?.[nom] === false)) {
    throw new Error('Rapport historique : une opération hors périmètre est déclarée.')
  }

  return { postgres: true, storageObjects: objets.length, legacy: true, encryptedAtRest: false }
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

  const formatNouveau = contenu.format === 'sikaloc-test-evidence/v1' && contenu.projectRef === SI_TEST_REF
  const formatHistorique = contenu.schema_version === 1 && contenu.target?.project_ref === SI_TEST_REF
  if (!formatNouveau && !formatHistorique) {
    throw new Error('Manifeste de sauvegarde : format ou référence de projet incorrecte.')
  }
  const date = Date.parse(formatHistorique ? contenu.created_at : contenu.createdAt)
  if (!Number.isFinite(date) || date > Date.now() || Date.now() - date > 7 * 24 * 60 * 60 * 1000) {
    throw new Error('Manifeste de sauvegarde : date absente, future ou âgée de plus de 7 jours.')
  }
  return {
    contenu,
    base: path.dirname(manifeste.chemin),
    historique: formatHistorique,
    fichier: manifeste,
  }
}

function verifierPreuvesSauvegardes(cheminManifest) {
  const { contenu, base, historique, fichier } = chargerManifesteRecette(cheminManifest)
  if (historique) {
    const dossier = statSync(base)
    if (
      process.platform !== 'win32' &&
      (
        (dossier.mode & 0o777) !== 0o700 ||
        (statSync(fichier.chemin).mode & 0o777) !== 0o600 ||
        fichier.taille === 0
      )
    ) {
      throw new Error('Manifeste historique : dossier privé 0700 et fichier non vide requis.')
    }
    return verifierPreuvesLegacySikalocTest(contenu, base)
  }
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

  verifierClePublique(clePublique, 'SIKALOC_TEST_SUPABASE_ANON_KEY')
  verifierCleServeur(cleService, 'SIKALOC_TEST_SERVICE_ROLE_KEY')
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
  ajouter('Clé publique Supabase Test', () => {
    verifierUrlTest(source.SIKALOC_TEST_SUPABASE_URL ?? '')
    const cle = source.SIKALOC_TEST_SUPABASE_ANON_KEY?.trim() ?? ''
    if (!cle) throw new Error('SIKALOC_TEST_SUPABASE_ANON_KEY est absente.')
    const verification = verifierClePublique(cle, 'SIKALOC_TEST_SUPABASE_ANON_KEY')
    return verification.referenceProjetVerifiee
      ? 'rôle anon et référence Test vérifiés; valeur masquée'
      : 'format publishable reconnu; correspondance clé/projet non vérifiable hors ligne; valeur masquée'
  })
  ajouter('Clé serveur Supabase Test', () => {
    const cle = source.SIKALOC_TEST_SERVICE_ROLE_KEY?.trim() ?? ''
    if (!cle) throw new Error('SIKALOC_TEST_SERVICE_ROLE_KEY est requise pour les routes serveur.')
    const verification = verifierCleServeur(cle, 'SIKALOC_TEST_SERVICE_ROLE_KEY')
    return verification.referenceProjetVerifiee
      ? 'ancienne clé service_role et référence Test vérifiées; valeur masquée'
      : 'nouvelle clé secrète reconnue; référence projet à confirmer par contrôle de connexion GET; valeur masquée'
  })
  ajouter('Sauvegardes et restauration', () => {
    const preuves = verifierPreuvesSauvegardes(source.SIKALOC_TEST_BACKUP_MANIFEST ?? '')
    const protection = preuves.legacy
      ? 'manifeste historique cohérent; archives en clair dans un dossier 0700 privé'
      : 'archives chiffrées et preuves récentes vérifiées'
    return `PostgreSQL et Storage restaurés en isolation; ${preuves.storageObjects} objets vérifiés; ${protection}`
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

function verifierCleServeur(cle, nomVariable) {
  if (cle.startsWith('sb_secret_')) {
    if (cle.length <= 'sb_secret_'.length || /\s/.test(cle)) {
      throw new Error(`${nomVariable} n’a pas un format de clé secrète Supabase valide.`)
    }
    return { type: 'secret', referenceProjetVerifiee: false }
  }

  verifierCleJwt(cle, 'service_role', nomVariable)
  return { type: 'service_role', referenceProjetVerifiee: true }
}

function verifierClePublique(cle, nomVariable) {
  if (cle.split('.').length === 3) {
    verifierCleJwt(cle, 'anon', nomVariable)
    return { type: 'anon', referenceProjetVerifiee: true }
  }
  if (cle.startsWith('sb_publishable_')) {
    return { type: 'publishable', referenceProjetVerifiee: false }
  }
  throw new Error('La clé publique Test doit être une clé anon JWT ou sb_publishable_.')
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

export async function verifierConnexionProjetTest(source = process.env, fetcher = globalThis.fetch) {
  const url = verifierUrlTest(source.SIKALOC_TEST_SUPABASE_URL ?? '')
  const cleServeur = source.SIKALOC_TEST_SERVICE_ROLE_KEY?.trim() ?? ''
  const clePublique = source.SIKALOC_TEST_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!cleServeur) throw new Error('SIKALOC_TEST_SERVICE_ROLE_KEY est absente.')
  if (!clePublique) throw new Error('SIKALOC_TEST_SUPABASE_ANON_KEY est absente.')

  const typeServeur = verifierCleServeur(cleServeur, 'SIKALOC_TEST_SERVICE_ROLE_KEY').type
  const typePublic = verifierClePublique(clePublique, 'SIKALOC_TEST_SUPABASE_ANON_KEY').type
  const testerCle = async (cle, type) => {
    const headers = new Headers({ apikey: cle })
    const headerNames = ['apikey']
    if (type === 'service_role' || type === 'anon') {
      headers.set('Authorization', `Bearer ${cle}`)
      headerNames.push('Authorization')
    }
    try {
      const reponse = await fetcher(`${url}/auth/v1/settings`, {
        method: 'GET',
        headers,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      })
      const resultat = { type, status: reponse.status, accepted: reponse.ok, headerNames }
      await reponse.body?.cancel().catch(() => {})
      return resultat
    } catch {
      return { type, status: null, accepted: false, headerNames }
    }
  }

  const [server, publicClient] = await Promise.all([
    testerCle(cleServeur, typeServeur),
    testerCle(clePublique, typePublic),
  ])
  return { projectRef: SI_TEST_REF, method: 'GET', path: '/auth/v1/settings', server, publicClient }
}

export function construireEnvironnementRecette(
  source = process.env,
  nomsEnvCharges = [],
  { mode = 'complete' } = {},
) {
  if (!['complete', 'otp-initial'].includes(mode)) {
    throw new Error('Mode de recette inconnu; seuls complete et otp-initial sont autorisés.')
  }
  const otpInitial = mode === 'otp-initial'
  const inconnues = nomsEnvCharges.filter((nom) => !variablesControlees.has(nom))
  if (inconnues.length) {
    throw new Error(
      `Variables des fichiers .env à examiner avant lancement : ${inconnues.join(', ')}.`,
    )
  }

  const configuration = verifierConfigurationCles(source)
  verifierPreuvesSauvegardes(source.SIKALOC_TEST_BACKUP_MANIFEST ?? '')
  if (!otpInitial) verifierPreuveEmailAuth(source.SIKALOC_TEST_BACKUP_MANIFEST ?? '')
  const { url, clePublique, cleService } = configuration

  const secretFedapay = otpInitial ? '' : source.SIKALOC_TEST_FEDAPAY_SECRET_KEY?.trim() ?? ''
  const cleFedapayPublique = otpInitial ? '' : source.SIKALOC_TEST_FEDAPAY_PUBLIC_KEY?.trim() ?? ''
  const secretWebhookFedapay = otpInitial ? '' : source.SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET?.trim() ?? ''
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
    SIKALOC_TEST_RECETTE_MODE: mode,
    SIKALOC_MAINTENANCE_MODE: 'off',
    SIKALOC_DEMO_LOCAL: '',
    SIKALOC_DEMO_EXPECTED_PROJECT_ID: '',
    OTP_SECRET: source.SIKALOC_TEST_OTP_SECRET || randomBytes(32).toString('base64url'),
    CRON_SECRET: otpInitial ? '' : source.SIKALOC_TEST_CRON_SECRET || randomBytes(32).toString('base64url'),
    // Valeur vérifiée dans Auth > Email sur Sikaloc-Test (8 chiffres).
    NEXT_PUBLIC_EMAIL_OTP_LENGTH: '8',
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

export function lancerRecette(source = process.env, repertoire = racine, { mode = 'complete' } = {}) {
  const environnement = construireEnvironnementRecette(
    source,
    collecterNomsEnvNext(repertoire),
    { mode },
  )

  if (Number(process.versions.node.split('.')[0]) !== 22) {
    throw new Error('La recette Sikaloc-Test exige Node.js 22.x, conformément au projet.')
  }

  const binaireNext = path.join(repertoire, 'node_modules', 'next', 'dist', 'bin', 'next')
  const serveur = spawn(
    process.execPath,
    ['--dns-result-order=ipv4first', binaireNext, 'dev', '--hostname', '127.0.0.1', '--port', '3000'],
    { cwd: repertoire, env: environnement, stdio: 'inherit' },
  )

  if (mode === 'otp-initial') {
    console.info(
      `Démarrage OTP initial limité à Sikaloc-Test (${SI_TEST_REF}) sur http://127.0.0.1:3000. ` +
      'Aucun compte ni email n’est créé au démarrage; FedaPay et Cron sont désactivés. ' +
      'Ce mode ne valide pas la recette complète et ne remplace pas sa preuve email.',
    )
  } else {
    console.info(
      `Recette isolée Sikaloc-Test (${SI_TEST_REF}) sur http://127.0.0.1:3000. ` +
      `Emails applicatifs, SMS et WhatsApp sont désactivés ; FedaPay sandbox ${environnement.FEDAPAY_SECRET_KEY ? 'configuré' : 'désactivé'}.`,
    )
  }

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
    const argumentsCli = process.argv.slice(2)
    const commandesConnues = new Set(['--check-connection', '--preflight', '--otp-initial'])
    if (
      argumentsCli.length > 1 ||
      argumentsCli.some((argument) => !commandesConnues.has(argument))
    ) {
      throw new Error('Une seule commande explicite est autorisée : --check-connection, --preflight ou --otp-initial.')
    }
    const commande = argumentsCli[0] ?? ''
    const source = fusionnerConfigurationRecettePrivee(process.env)
    if (commande === '--check-connection') {
      const resultat = await verifierConnexionProjetTest(source)
      for (const [nom, controle] of Object.entries({ serveur: resultat.server, publique: resultat.publicClient })) {
        const statut = controle.status === null ? 'erreur réseau' : `HTTP ${controle.status}`
        console.info(`[${controle.accepted ? 'OK' : 'ÉCHEC'}] clé ${nom} (${controle.type}) — ${statut}`)
      }
      console.info(
        `Contrôle GET ${resultat.path} en lecture seule sur ${resultat.projectRef}; aucune table ni donnée métier consultée. ` +
        'Ce contrôle ne valide pas les sauvegardes ou les emails Auth et ne débloque pas le lancement de la recette.',
      )
      if (!resultat.server.accepted || !resultat.publicClient.accepted) process.exitCode = 1
    } else if (commande === '--preflight') {
      afficherPreflightRecette(source, collecterNomsEnvNext())
    } else if (commande === '--otp-initial') {
      lancerRecette(source, racine, { mode: 'otp-initial' })
    } else {
      lancerRecette(source)
    }
  } catch (cause) {
    console.error(`Recette Sikaloc-Test arrêtée sans démarrer l’application : ${cause.message}`)
    process.exitCode = 1
  }
}
