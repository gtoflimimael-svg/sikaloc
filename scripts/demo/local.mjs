#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'
import {
  chmod,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dossierPrive = path.join(
  process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
  'sikaloc-demo-local',
)
const fichierMarqueur = path.join(dossierPrive, 'instance.json')
const fichierSecrets = path.join(dossierPrive, 'secrets.json')
const fichierAcces = path.join(dossierPrive, 'acces-demo.md')
const fichierNettoyage = path.join(dossierPrive, 'nettoyage-demo-en-attente.json')
const repertoireSupabase = path.join(dossierPrive, 'supabase')
const repertoireModelesAuth = path.join(dossierPrive, 'templates')
const binaireSupabase = path.join(racine, 'node_modules', '.bin', 'supabase')
const binaireTsx = path.join(racine, 'node_modules', '.bin', 'tsx')
const binaireNext = path.join(racine, 'node_modules', 'next', 'dist', 'bin', 'next')
const portApi = 54821
const identifiantAttendu = /^sikaloc-demo-[a-f0-9]{12}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const bucketsDemo = ['annonces', 'quittances', 'signatures', 'photos']

function erreur(message) {
  console.error(`Démo locale Sikaloc : ${message}`)
  process.exitCode = 1
}

function environnementCli() {
  return {
    ...process.env,
    XDG_CONFIG_HOME: path.join(os.tmpdir(), 'sikaloc-demo-cli-config'),
    SUPABASE_TELEMETRY_DISABLED: '1',
  }
}

function expurgerDiagnosticCli(texte) {
  return String(texte ?? '')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[jeton masqué]')
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+(@)/gi, '$1[secret masqué]$2')
    .replace(/((?:service[_ -]?role|anon|api[_ -]?key|password|secret)\s*[=:]\s*)[^\s,;]+/gi, '$1[masqué]')
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter(Boolean)
    .slice(-8)
    .join(' | ')
    .slice(0, 1200)
}

function executerSupabase(argumentsCli, options = {}) {
  const resultat = spawnSync(
    binaireSupabase,
    [...argumentsCli, '--workdir', dossierPrive],
    {
      cwd: racine,
      env: environnementCli(),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: options.timeout ?? 10 * 60 * 1000,
    },
  )

  if (resultat.error || resultat.status !== 0) {
    // La sortie CLI peut inclure des clés locales. Elle n'est jamais journalisée.
    const commande = argumentsCli.slice(0, 2).join(' ')
    const statut = resultat.status ?? resultat.error?.code ?? 'inconnu'
    const diagnostic = options.diagnostic
      ? expurgerDiagnosticCli(`${resultat.stdout ?? ''}\n${resultat.stderr ?? ''}`)
      : ''
    throw new Error(
      `la commande Supabase locale « ${commande} » a échoué (${statut})` +
      (diagnostic ? ` : ${diagnostic}` : ''),
    )
  }
  return resultat.stdout
}

async function ecrirePrive(chemin, contenu) {
  const temporaire = `${chemin}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(temporaire, contenu, { mode: 0o600, flag: 'wx' })
  await chmod(temporaire, 0o600)
  await rename(temporaire, chemin)
  await chmod(chemin, 0o600)
}

async function lireMarqueur() {
  try {
    const marqueur = JSON.parse(await readFile(fichierMarqueur, 'utf8'))
    if (
      marqueur?.version !== 1 ||
      !identifiantAttendu.test(marqueur.projectId) ||
      !['fresh', 'initializing', 'ready'].includes(marqueur.schemaState)
    ) {
      throw new Error('marqueur inattendu')
    }
    return marqueur
  } catch (cause) {
    if (cause?.code === 'ENOENT') return null
    throw new Error('les fichiers privés de cette démo sont incohérents; aucune donnée n’a été modifiée')
  }
}

async function preparerProjetPrive() {
  let existe = false
  try {
    const info = await lstat(dossierPrive)
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error('le chemin privé existe mais n’est pas un dossier normal; arrêt sans modification')
    }
    existe = true
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause
  }

  if (!existe) await mkdir(dossierPrive, { recursive: true, mode: 0o700 })
  await chmod(dossierPrive, 0o700)

  let marqueur = await lireMarqueur()
  if (!marqueur) {
    const entrees = await readdir(dossierPrive)
    if (entrees.length > 0) {
      throw new Error('le dossier privé contient déjà des fichiers sans marqueur connu; arrêt pour les préserver')
    }
    marqueur = {
      version: 1,
      projectId: `sikaloc-demo-${randomBytes(6).toString('hex')}`,
      schemaState: 'fresh',
      creeLe: new Date().toISOString(),
    }
    await ecrirePrive(fichierMarqueur, `${JSON.stringify(marqueur, null, 2)}\n`)
  }

  await mkdir(repertoireSupabase, { recursive: true, mode: 0o700 })
  await mkdir(path.join(repertoireSupabase, 'migrations'), { recursive: true, mode: 0o700 })
  await mkdir(repertoireModelesAuth, { recursive: true, mode: 0o700 })
  await chmod(repertoireSupabase, 0o700)
  await chmod(path.join(repertoireSupabase, 'migrations'), 0o700)
  await chmod(repertoireModelesAuth, 0o700)
  await cp(path.join(racine, 'supabase', 'migrations'), path.join(repertoireSupabase, 'migrations'), {
    recursive: true,
    force: true,
  })
  await cp(path.join(racine, 'supabase', 'templates'), repertoireModelesAuth, {
    recursive: true,
    force: true,
  })

  const modele = await readFile(path.join(racine, 'scripts', 'demo', 'supabase.config.toml'), 'utf8')
  const configuration = modele.replace('__PROJECT_ID__', marqueur.projectId)
  await writeFile(path.join(repertoireSupabase, 'config.toml'), configuration, { mode: 0o600 })
  await chmod(path.join(repertoireSupabase, 'config.toml'), 0o600)
  return marqueur
}

function parserEnvSupabase(sortie) {
  const valeurs = {}
  for (const ligne of sortie.split(/\r?\n/)) {
    const correspondance = ligne.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (!correspondance) continue
    let valeur = correspondance[2].trim()
    if (valeur.startsWith('"') && valeur.endsWith('"')) {
      valeur = valeur.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\')
    }
    valeurs[correspondance[1]] = valeur
  }
  return valeurs
}

function verifierPileLocale(valeurs) {
  const url = valeurs.API_URL || valeurs.NEXT_PUBLIC_SUPABASE_URL
  const anon = valeurs.ANON_KEY || valeurs.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = valeurs.SERVICE_ROLE_KEY || valeurs.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) {
    throw new Error('la pile locale n’a pas fourni toutes ses clés attendues')
  }
  let destination
  try {
    destination = new URL(url)
  } catch {
    throw new Error('l’URL retournée par la pile locale est invalide')
  }

  const hoteAutorise = ['127.0.0.1', 'localhost', '::1'].includes(destination.hostname)
  if (!hoteAutorise || Number(destination.port) !== portApi || !anon || !service) {
    throw new Error('la cible Supabase ne correspond pas à l’instance locale dédiée')
  }

  let charge = {}
  try {
    charge = JSON.parse(Buffer.from(service.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    throw new Error('la clé locale ne peut pas être identifiée sans l’afficher')
  }
  if (charge.iss !== 'supabase-demo' || charge.ref || charge.role !== 'service_role') {
    throw new Error('la clé ne porte pas la signature attendue de la pile locale; arrêt')
  }

  return {
    url: destination.origin,
    anon,
    service,
  }
}

async function lireSecrets() {
  try {
    const secrets = JSON.parse(await readFile(fichierSecrets, 'utf8'))
    if (typeof secrets.otpSecret === 'string' && secrets.otpSecret.length >= 32) return secrets
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw new Error('le fichier privé des secrets est illisible')
  }

  const secrets = { otpSecret: randomBytes(48).toString('base64url'), comptes: {} }
  await ecrirePrive(fichierSecrets, `${JSON.stringify(secrets, null, 2)}\n`)
  return secrets
}

async function obtenirPile({ demarrer = true } = {}) {
  const marqueur = await preparerProjetPrive()
  if (marqueur.schemaState === 'initializing') {
    throw new Error('une initialisation SQL précédente s’est interrompue; aucune réinitialisation automatique ne sera tentée')
  }

  if (demarrer) {
    // Sortie capturée pour ne jamais afficher les clés de service locales.
    executerSupabase(['start'])
  }

  let valeurs = parserEnvSupabase(executerSupabase(['status', '--output', 'env']))
  let identite = verifierPileLocale(valeurs)

  if (marqueur.schemaState === 'fresh') {
    marqueur.schemaState = 'initializing'
    await ecrirePrive(fichierMarqueur, `${JSON.stringify(marqueur, null, 2)}\n`)
    // Première création uniquement : ce chemin possède un project_id aléatoire
    // et neuf. Aucun lien distant, aucun seed général, aucune autre base.
    executerSupabase(['db', 'reset', '--local', '--no-seed'])
    marqueur.schemaState = 'ready'
    marqueur.initialiseLe = new Date().toISOString()
    await ecrirePrive(fichierMarqueur, `${JSON.stringify(marqueur, null, 2)}\n`)
  } else {
    // Mise à niveau non destructive : seules les migrations locales manquantes.
    executerSupabase(['migration', 'up', '--local'])
  }

  valeurs = parserEnvSupabase(executerSupabase(['status', '--output', 'env']))
  identite = verifierPileLocale(valeurs)
  return { marqueur, identite, secrets: await lireSecrets() }
}

function environnementApplication(identite, secrets, projectId) {
  return {
    ...process.env,
    NODE_ENV: 'development',
    SIKALOC_DEMO_LOCAL: '1',
    SIKALOC_DEMO_EXPECTED_PROJECT_ID: projectId,
    SIKALOC_MAINTENANCE_MODE: 'off',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: identite.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: identite.anon,
    SUPABASE_SERVICE_ROLE_KEY: identite.service,
    OTP_SECRET: secrets.otpSecret,
    NEXT_PUBLIC_EMAIL_OTP_LENGTH: '6',
    OTP_CANAL_DEV: '0',
    RESEND_API_KEY: '',
    FEDAPAY_ENV: 'sandbox',
    FEDAPAY_SECRET_KEY: '',
    FEDAPAY_WEBHOOK_SECRET: '',
    SMS_FOURNISSEUR: '',
    EMAIL_EXPLOITATION: '',
    EMAIL_FROM: '',
    EMAIL_FROM_NAME: 'Sikaloc — démonstration locale',
    NEXT_PUBLIC_WHATSAPP_SUPPORT: '',
    VERIFICATION_BING: '',
    VERIFICATION_GOOGLE: '',
  }
}

async function peupler(identite, projectId, mode = 'initial') {
  const environnement = environnementApplication(identite, await lireSecrets(), projectId)
  const resultat = spawnSync(binaireTsx, [path.join(racine, 'scripts', 'demo', 'seed-local.mts')], {
    cwd: racine,
    env: {
      ...environnement,
      SIKALOC_DEMO_CREDENTIALS_FILE: fichierSecrets,
      SIKALOC_DEMO_ACCESS_FILE: fichierAcces,
      SIKALOC_DEMO_MODE: mode,
      SIKALOC_DEMO_REBUILD_CLEANUP: mode === 'rebuild' ? '1' : '0',
    },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
  })
  if (resultat.error || resultat.status !== 0) {
    // N'imprime que les messages volontairement expurgés produits par le seed.
    if (resultat.stdout) process.stdout.write(resultat.stdout)
    if (resultat.stderr) process.stderr.write(resultat.stderr)
    throw new Error('le peuplement local n’a pas abouti; aucune base distante n’a été ciblée')
  }
  process.stdout.write(resultat.stdout)
}

async function listerUtilisateurs(admin) {
  const utilisateurs = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error('impossible de vérifier les comptes de l’instance Demo')
    utilisateurs.push(...data.users)
    if (data.users.length < 1000) return utilisateurs
  }
}

function verifierComptesDemo(utilisateurs) {
  if (utilisateurs.some((utilisateur) =>
    utilisateur.app_metadata?.sikaloc_demo !== 'sikaloc-demo-v1' ||
    !utilisateur.email?.toLowerCase().endsWith('@sikaloc-demo.test'),
  )) {
    throw new Error('un compte Auth n’est pas marqué comme fictif Sikaloc Demo; nettoyage annulé')
  }
}

async function listerFichiers(admin, bucket, prefix, profondeur = 0) {
  if (profondeur > 8) throw new Error('arborescence de stockage Demo anormalement profonde; arrêt')
  const fichiers = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`lecture du stockage Demo ${bucket} impossible`)
    for (const entree of data ?? []) {
      if (!entree.name || entree.name.includes('\\') || /(^|\/)\.\.?($|\/)/.test(entree.name)) {
        throw new Error(`chemin de stockage Demo invalide dans ${bucket}; arrêt`)
      }
      const cheminObjet = `${prefix}/${entree.name}`
      if (!cheminObjet.startsWith(`${prefix}/`)) throw new Error('chemin de stockage hors périmètre; arrêt')
      if (typeof entree.id === 'string' && entree.id) fichiers.push(cheminObjet)
      else fichiers.push(...await listerFichiers(admin, bucket, cheminObjet, profondeur + 1))
    }
    if (!data || data.length < 100) return fichiers
  }
}

function validerManifesteNettoyage(manifeste, projectId) {
  if (
    manifeste?.version !== 1 || manifeste.projectId !== projectId ||
    !Array.isArray(manifeste.userIds) || !manifeste.objets || typeof manifeste.objets !== 'object'
  ) {
    throw new Error('un nettoyage Demo interrompu appartient à une autre instance ou est illisible; arrêt')
  }
  const utilisateurs = new Set(manifeste.userIds)
  if ([...utilisateurs].some((id) => !UUID.test(id))) throw new Error('identifiant de stockage Demo invalide; arrêt')
  for (const [bucket, chemins] of Object.entries(manifeste.objets)) {
    if (!bucketsDemo.includes(bucket) || !Array.isArray(chemins)) {
      throw new Error('contenu du manifeste de nettoyage Demo inattendu; arrêt')
    }
    for (const chemin of chemins) {
      if (typeof chemin !== 'string' || ![...utilisateurs].some((id) => chemin.startsWith(`${id}/`))) {
        throw new Error('le manifeste contient un chemin hors des comptes Demo; arrêt')
      }
    }
  }
}

async function preparerManifesteNettoyage(admin, projectId, utilisateurs) {
  let existant = null
  try {
    existant = JSON.parse(await readFile(fichierNettoyage, 'utf8'))
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw new Error('le manifeste privé de nettoyage Demo est illisible; arrêt')
  }
  if (existant) validerManifesteNettoyage(existant, projectId)

  const userIds = [...new Set([...(existant?.userIds ?? []), ...utilisateurs.map(({ id }) => id)])]
  const objets = Object.fromEntries(bucketsDemo.map((bucket) => [
    bucket,
    new Set(existant?.objets?.[bucket] ?? []),
  ]))
  for (const id of utilisateurs.map(({ id }) => id)) {
    if (!UUID.test(id)) throw new Error('identifiant Auth Demo invalide; arrêt')
    for (const bucket of bucketsDemo) {
      for (const chemin of await listerFichiers(admin, bucket, id)) objets[bucket].add(chemin)
    }
  }

  const manifeste = {
    version: 1,
    projectId,
    userIds,
    objets: Object.fromEntries(Object.entries(objets).map(([bucket, chemins]) => [bucket, [...chemins]])),
  }
  validerManifesteNettoyage(manifeste, projectId)
  await ecrirePrive(fichierNettoyage, `${JSON.stringify(manifeste, null, 2)}\n`)
  return manifeste
}

async function effacerObjetsManifeste(admin, manifeste) {
  for (const bucket of bucketsDemo) {
    const chemins = manifeste.objets[bucket] ?? []
    for (let debut = 0; debut < chemins.length; debut += 100) {
      const lot = chemins.slice(debut, debut + 100)
      if (lot.some((chemin) => !manifeste.userIds.some((id) => chemin.startsWith(`${id}/`)))) {
        throw new Error('chemin de stockage hors du préfixe Demo; suppression interrompue')
      }
      const { error } = await admin.storage.from(bucket).remove(lot)
      if (error) throw new Error(`suppression des objets fictifs du bucket ${bucket} impossible`)
    }
  }
}

async function nettoyerBaseDemo(identite, projectId) {
  // L’URL et la clé ont déjà été vérifiées : localhost:54821, émetteur Demo,
  // projet privé correspondant au marqueur local, sans référence distante.
  const admin = createClient(identite.url, identite.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const utilisateurs = await listerUtilisateurs(admin)
  verifierComptesDemo(utilisateurs)
  const manifeste = await preparerManifesteNettoyage(admin, projectId, utilisateurs)

  // Cette requête n’utilise que le workdir privé, --local, et un fichier SQL
  // avec une seconde garde indépendante sur tous les utilisateurs Auth.
  executerSupabase([
    'db', 'query', '--local', '--file', path.join(racine, 'scripts', 'demo', 'rebuild.sql'),
  ], { timeout: 60_000, diagnostic: true })

  const restants = await listerUtilisateurs(admin)
  if (restants.length !== 0) {
    throw new Error('la transaction Demo n’a pas supprimé tous les comptes attendus; le seed n’a pas été lancé')
  }
  await effacerObjetsManifeste(admin, manifeste)
  await unlink(fichierNettoyage).catch((cause) => {
    if (cause?.code !== 'ENOENT') throw cause
  })
  console.log(`Nettoyage transactionnel Demo terminé (${utilisateurs.length} comptes fictifs, stockage limité à leurs préfixes).`)
  console.log('Les trois protections SQL ciblées ont été réactivées avant la validation de la transaction.')
}

async function main() {
  const action = process.argv[2]
  if (!['setup', 'seed', 'dev', 'status', 'stop', 'rebuild'].includes(action)) {
    throw new Error('choisissez setup, seed, dev, status, stop ou rebuild')
  }

  // Le serveur reste limité à la machine par défaut. Pour un aperçu sur un
  // téléphone du même réseau, accepter uniquement une adresse IPv4 réellement
  // attribuée à cet ordinateur — jamais un bind générique sur toutes les
  // interfaces.
  let hoteServeur = '127.0.0.1'
  if (action === 'dev' && process.env.SIKALOC_DEMO_HOST) {
    const hoteDemande = process.env.SIKALOC_DEMO_HOST.trim()
    const adressesLocales = Object.values(os.networkInterfaces())
      .flatMap((interfaceReseau) => interfaceReseau ?? [])
      .filter((interfaceReseau) => !interfaceReseau.internal && interfaceReseau.family === 'IPv4')
      .map((interfaceReseau) => interfaceReseau.address)

    if (hoteDemande !== '127.0.0.1' && !adressesLocales.includes(hoteDemande)) {
      throw new Error('SIKALOC_DEMO_HOST doit être 127.0.0.1 ou une adresse IPv4 de cet ordinateur')
    }
    hoteServeur = hoteDemande
  }

  if (action === 'stop') {
    const marqueur = await lireMarqueur()
    if (!marqueur) throw new Error('aucune instance dédiée reconnue; rien n’a été arrêté')
    await preparerProjetPrive()
    executerSupabase(['stop'])
    console.log('Pile locale arrêtée; ses volumes et ses données ont été conservés.')
    return
  }

  if (action === 'status') {
    const marqueur = await lireMarqueur()
    if (!marqueur) throw new Error('aucune instance de démonstration locale préparée')
    await preparerProjetPrive()
    const valeurs = parserEnvSupabase(executerSupabase(['status', '--output', 'env']))
    const identite = verifierPileLocale(valeurs)
    const admin = createClient(identite.url, identite.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const utilisateurs = await listerUtilisateurs(admin)
    console.log(`Pile Supabase locale dédiée active : ${identite.url}`)
    console.log(`Comptes Auth présents : ${utilisateurs.length}`)
    console.log(`Fiche privée des comptes : ${fichierAcces}`)
    return
  }

  if (action === 'rebuild') {
    const marqueurInitial = await lireMarqueur()
    if (!marqueurInitial || marqueurInitial.schemaState !== 'ready') {
      throw new Error('aucune base Demo locale prête et identifiée; rien n’a été supprimé')
    }
    if (!process.stdin.isTTY) {
      throw new Error('la reconstruction exige une confirmation interactive de l’identifiant privé Demo')
    }
    const invite = createInterface({ input: process.stdin, output: process.stdout })
    let confirmation = ''
    try {
      confirmation = await invite.question(
        `Cette opération remplacera uniquement les comptes de démonstration de ${marqueurInitial.projectId}.\n` +
        `Pour confirmer, saisissez exactement cet identifiant : `,
      )
    } finally {
      invite.close()
    }
    if (confirmation.trim() !== marqueurInitial.projectId) {
      throw new Error('identifiant non confirmé; aucune donnée n’a été modifiée')
    }

    const { marqueur, identite } = await obtenirPile()
    if (marqueur.projectId !== marqueurInitial.projectId || marqueur.schemaState !== 'ready') {
      throw new Error('l’identité de la base a changé pendant la confirmation; arrêt sans reconstruction')
    }
    await nettoyerBaseDemo(identite, marqueur.projectId)
    marqueur.seeded = false
    await ecrirePrive(fichierMarqueur, `${JSON.stringify(marqueur, null, 2)}\n`)
    await peupler(identite, marqueur.projectId, 'rebuild')
    marqueur.seeded = true
    marqueur.peupleLe = new Date().toISOString()
    marqueur.reconstruitLe = marqueur.peupleLe
    await ecrirePrive(fichierMarqueur, `${JSON.stringify(marqueur, null, 2)}\n`)
    console.log('Démonstration reconstruite dans la base Supabase locale dédiée; aucun db reset n’a été lancé.')
    console.log(`Accès privés : ${fichierAcces}`)
    console.log(`Lancement : npm run demo:dev (données manuelles conservées au prochain démarrage).`)
    console.log(`Application locale : http://localhost:3000`)
    return
  }

  const { marqueur, identite, secrets } = await obtenirPile()
  if (action === 'seed' && marqueur.seeded) {
    throw new Error('les fixtures ont déjà été installées; cette commande ne réinitialise pas les données modifiées')
  }
  if (!marqueur.seeded) {
    await peupler(identite, marqueur.projectId)
    marqueur.seeded = true
    marqueur.peupleLe = new Date().toISOString()
    await ecrirePrive(fichierMarqueur, `${JSON.stringify(marqueur, null, 2)}\n`)
  } else {
    console.log('Fixtures déjà présentes : les données modifiées dans l’application sont conservées.')
  }
  if (action === 'dev') {
    console.log(
      hoteServeur === '127.0.0.1'
        ? 'Application locale démarrée sur http://localhost:3000 (pile et comptes de démonstration isolés).'
        : `Application locale accessible sur http://${hoteServeur}:3000 (réseau local, pile de démonstration isolée).`,
    )
    const processus = spawn(process.execPath, [binaireNext, 'dev', '--hostname', hoteServeur], {
      cwd: racine,
      env: environnementApplication(identite, secrets, marqueur.projectId),
      stdio: 'inherit',
    })
    processus.on('exit', (code) => {
      process.exitCode = code ?? 0
    })
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () => processus.kill(signal))
    }
    return
  }

  const actionTexte = action === 'setup' ? 'préparés' : 'mis à jour'
  console.log(`Schéma local migré et jeu synthétique ${actionTexte}.`)
  console.log(`Fiche privée des comptes (jamais dans Git) : ${fichierAcces}`)
  console.log('Aucune base distante, aucun email/SMS externe et aucun paiement réel n’ont été utilisés.')
}

main().catch((cause) => {
  erreur(cause instanceof Error ? cause.message : 'opération locale interrompue')
})
