#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import {
  chmod,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
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
const repertoireSupabase = path.join(dossierPrive, 'supabase')
const binaireSupabase = path.join(racine, 'node_modules', '.bin', 'supabase')
const binaireTsx = path.join(racine, 'node_modules', '.bin', 'tsx')
const binaireNext = path.join(racine, 'node_modules', 'next', 'dist', 'bin', 'next')
const portApi = 54821
const identifiantAttendu = /^sikaloc-demo-[a-f0-9]{12}$/

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
    throw new Error('la commande Supabase locale a échoué')
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
  await chmod(repertoireSupabase, 0o700)
  await chmod(path.join(repertoireSupabase, 'migrations'), 0o700)
  await cp(path.join(racine, 'supabase', 'migrations'), path.join(repertoireSupabase, 'migrations'), {
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

function environnementApplication(identite, secrets) {
  return {
    ...process.env,
    NODE_ENV: 'development',
    SIKALOC_DEMO_LOCAL: '1',
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

async function peupler(identite) {
  const environnement = environnementApplication(identite, await lireSecrets())
  const resultat = spawnSync(binaireTsx, [path.join(racine, 'scripts', 'demo', 'seed-local.mts')], {
    cwd: racine,
    env: {
      ...environnement,
      SIKALOC_DEMO_CREDENTIALS_FILE: fichierSecrets,
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

async function main() {
  const action = process.argv[2]
  if (!['setup', 'seed', 'dev', 'status', 'stop'].includes(action)) {
    throw new Error('choisissez setup, seed, dev, status ou stop')
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
    console.log(`Pile Supabase locale dédiée active : ${identite.url}`)
    console.log(`Fichier privé des accès : ${fichierSecrets}`)
    return
  }

  const { marqueur, identite, secrets } = await obtenirPile()
  if (action === 'seed' && marqueur.seeded) {
    throw new Error('les fixtures ont déjà été installées; cette commande ne réinitialise pas les données modifiées')
  }
  if (!marqueur.seeded) {
    await peupler(identite)
    marqueur.seeded = true
    marqueur.peupleLe = new Date().toISOString()
    await ecrirePrive(fichierMarqueur, `${JSON.stringify(marqueur, null, 2)}\n`)
  } else {
    console.log('Fixtures déjà présentes : les données modifiées dans l’application sont conservées.')
  }
  if (action === 'dev') {
    console.log('Application locale démarrée sur http://localhost:3000 (pile et comptes de démonstration isolés).')
    const processus = spawn(process.execPath, [binaireNext, 'dev', '--hostname', '127.0.0.1'], {
      cwd: racine,
      env: environnementApplication(identite, secrets),
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
  console.log(`Identifiants privés (jamais dans Git) : ${fichierSecrets}`)
  console.log('Aucune base distante, aucun email/SMS externe et aucun paiement réel n’ont été utilisés.')
}

main().catch((cause) => {
  erreur(cause instanceof Error ? cause.message : 'opération locale interrompue')
})
