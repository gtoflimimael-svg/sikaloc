// Lanceur des tests de bout en bout (QA-01, FN-01).
//
//   node scripts/e2e/lancer.mjs [--workdir <dossier supabase>] [--sans-build]
//
// 1. lit les clés de la pile Supabase locale jetable (`supabase status`) ;
// 2. fixe EXPLICITEMENT chaque variable de l'application : Next charge
//    `.env.local`, qui peut contenir de vraies clés (Resend, FedaPay, Sentry).
//    Toutes sont neutralisées ou remplacées par des valeurs de test ; FedaPay
//    pointe vers un faux service local ;
// 3. construit et démarre l'application en mode production ;
// 4. crée les données fictives, puis lance `tests/e2e/*.e2e.mjs`.
import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const workdir = args.includes('--workdir') ? args[args.indexOf('--workdir') + 1] : racine
const sansBuild = args.includes('--sans-build')
const PORT_APP = 3100
const PORT_FEDAPAY = 9150
const BASE = `http://127.0.0.1:${PORT_APP}`

function arreter(message, code = 1) {
  console.error(`E2E : ${message}`)
  process.exit(code)
}

const statut = spawnSync(path.join(racine, 'node_modules/.bin/supabase'), ['status', '--output', 'env', '--workdir', workdir], {
  encoding: 'utf8', env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
})
if (statut.status !== 0) arreter('pile Supabase locale introuvable (supabase start ?)')
const pile = Object.fromEntries(statut.stdout.split('\n').map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]))
const urlPile = new URL(pile.API_URL ?? 'http://invalide')
if (!['127.0.0.1', 'localhost'].includes(urlPile.hostname) || urlPile.port === '54821') {
  arreter('la pile cible n’est pas une pile locale jetable (la démo 54821 est exclue)')
}

// Toutes les variables connues de l'application, neutralisées puis fixées.
const neutres = Object.fromEntries(
  readFileSync(path.join(racine, '.env.example'), 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z][A-Z0-9_]+)=/)?.[1]).filter(Boolean).map((cle) => [cle, '']),
)
const secrets = {
  OTP_SECRET: randomBytes(48).toString('base64url'),
  CRON_SECRET: randomBytes(32).toString('base64url'),
  FEDAPAY_WEBHOOK_SECRET: `wh_sandbox_${randomBytes(24).toString('hex')}`,
}
const env = {
  ...process.env,
  ...neutres,
  ...secrets,
  SIKALOC_E2E: '1',
  SIKALOC_MAINTENANCE_MODE: 'off',
  NEXT_PUBLIC_SITE_URL: BASE,
  NEXT_PUBLIC_SUPABASE_URL: pile.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: pile.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: pile.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_EMAIL_OTP_LENGTH: '6',
  OTP_CANAL_DEV: '0',
  FEDAPAY_ENV: 'sandbox',
  FEDAPAY_SECRET_KEY: 'sk_sandbox_e2e_factice',
  FEDAPAY_API_URL: `http://127.0.0.1:${PORT_FEDAPAY}/v1`,
  EMAIL_FROM_NAME: 'Sikaloc E2E',
  SENTRY_DSN: '', NEXT_PUBLIC_SENTRY_DSN: '', SENTRY_AUTH_TOKEN: '', SENTRY_ORG: '', SENTRY_PROJECT: '',
  NODE_ENV: 'production',
}
const next = path.join(racine, 'node_modules/next/dist/bin/next')

if (!sansBuild) {
  console.log('E2E : construction de l’application…')
  for (let essai = 1; essai <= 2; essai++) {
    const build = spawnSync(process.execPath, [next, 'build'], { cwd: racine, env, encoding: 'utf8', maxBuffer: 64e6 })
    if (build.status === 0) break
    if (essai === 2) arreter(`échec du build :\n${(build.stdout + build.stderr).split('\n').slice(-15).join('\n')}`)
  }
}

console.log('E2E : démarrage du serveur…')
const serveur = spawn(process.execPath, [next, 'start', '-p', String(PORT_APP), '-H', '127.0.0.1'], { cwd: racine, env, stdio: ['ignore', 'pipe', 'pipe'] })
let journal = ''
serveur.stdout.on('data', (d) => { journal += d })
serveur.stderr.on('data', (d) => { journal += d })
const finir = (code) => { serveur.kill('SIGTERM'); process.exit(code) }

let pret = false
for (let i = 0; i < 60 && !pret; i++) {
  try { pret = (await fetch(`${BASE}/connexion`)).ok } catch { await new Promise((r) => setTimeout(r, 1000)) }
}
if (!pret) { console.error(journal.slice(-3000)); arreter('le serveur ne répond pas') }

const dossier = mkdtempSync(path.join(tmpdir(), 'sikaloc-e2e-'))
const fichierComptes = path.join(dossier, 'comptes.json')
const fixtures = spawnSync(process.execPath, [path.join(racine, 'scripts/e2e/fixtures.mjs'), fichierComptes], { cwd: racine, env, stdio: 'inherit' })
if (fixtures.status !== 0) finir(1)

const scenarios = readdirSync(path.join(racine, 'tests/e2e')).filter((n) => n.endsWith('.e2e.mjs')).sort().map((n) => path.join('tests/e2e', n))
const tests = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...scenarios], {
  cwd: racine,
  stdio: 'inherit',
  env: { ...env, NODE_ENV: 'test', E2E_BASE: BASE, E2E_COMPTES: fichierComptes, E2E_FEDAPAY_PORT: String(PORT_FEDAPAY) },
})
rmSync(dossier, { recursive: true, force: true })
if (tests.status !== 0) {
  // Échecs journalisés par l'application (journaliserEchec, erreurs Next).
  const lignes = journal.split('\n').filter((l) => /\] échec|impossible|⨯|Error/.test(l)).slice(-40)
  if (lignes.length) console.error(`\nJournal serveur (échecs) :\n${lignes.join('\n')}`)
}
finir(tests.status ?? 1)
