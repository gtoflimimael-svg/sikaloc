// Pile Supabase jetable pour les tests de bout en bout.
//
//   node scripts/e2e/pile.mjs demarrer <dossier>
//   node scripts/e2e/pile.mjs arreter  <dossier>
//
// Copie migrations et gabarits du dépôt dans <dossier>/supabase, avec une
// configuration dérivée de `supabase/config.toml` et sécurisée :
//   • projet « sikaloc-e2e », ports 553xx : n'entre en conflit ni avec la pile
//     de développement (543xx) ni avec la démo (548xx) ;
//   • envoi d'e-mails SMTP DÉSACTIVÉ : la configuration du dépôt pointe vers
//     Resend, un test ne doit jamais écrire à une vraie adresse ;
//   • seed de développement désactivé : base vide, données créées par
//     `scripts/e2e/fixtures.mjs`.
// `arreter` supprime les volumes (--no-backup) : rien ne survit au test.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { configurationE2E } from './configuration.mjs'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const [action, dossierBrut] = process.argv.slice(2)
if (!['demarrer', 'arreter'].includes(action) || !dossierBrut) {
  console.error('Usage : node scripts/e2e/pile.mjs demarrer|arreter <dossier>')
  process.exit(2)
}
const dossier = path.resolve(dossierBrut)
if (dossier === racine || dossier.startsWith(`${racine}${path.sep}`)) {
  console.error('Le dossier de pile E2E doit être hors du dépôt.')
  process.exit(2)
}
const cli = path.join(racine, 'node_modules/.bin/supabase')
const executer = (args) => spawnSync(cli, [...args, '--workdir', dossier], {
  stdio: 'inherit', env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1', RESEND_API_KEY: '' },
})


if (action === 'demarrer') {
  rmSync(dossier, { recursive: true, force: true })
  mkdirSync(path.join(dossier, 'supabase'), { recursive: true })
  cpSync(path.join(racine, 'supabase/migrations'), path.join(dossier, 'supabase/migrations'), { recursive: true })
  cpSync(path.join(racine, 'supabase/templates'), path.join(dossier, 'supabase/templates'), { recursive: true })
  const config = configurationE2E(readFileSync(path.join(racine, 'supabase/config.toml'), 'utf8'))
  if (!/\[auth\.email\.smtp\][^[]*enabled = false/.test(config) || /\b543\d\d\b/.test(config)) {
    console.error('Configuration E2E non sécurisée : arrêt.')
    process.exit(1)
  }
  writeFileSync(path.join(dossier, 'supabase/config.toml'), config)
  const resultat = executer(['start', '-x', 'studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta,mailpit'])
  process.exit(resultat.status ?? 1)
} else {
  const resultat = executer(['stop', '--no-backup'])
  rmSync(dossier, { recursive: true, force: true })
  process.exit(resultat.status ?? 1)
}
