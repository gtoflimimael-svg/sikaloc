import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { verifierHistoriqueMigrations, verifierIntention, verifierUrlLocale } from '../src/lib/integration/isolation-guard.mjs'

// Ne lit jamais DATABASE_URL ni les variables de connexion d'une application.
// Une pile fraîche doit porter un marqueur créé manuellement après contrôle de
// son identité. Aucune mutation n'est faite par ce lanceur avant ces contrôles.
let cible, instanceId
try {
  instanceId = verifierIntention(process.env)
  cible = verifierUrlLocale(process.env.SIKALOC_INTEGRATION_DATABASE_URL)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exit(2)
}

const env = {
  PATH: process.env.PATH,
  PGHOST: cible.host,
  PGPORT: cible.port,
  PGDATABASE: cible.database,
  PGUSER: cible.user,
  PGPASSWORD: cible.password,
  PGSSLMODE: 'disable',
  PGCONNECT_TIMEOUT: '3',
}

function lire(sql) {
  const resultat = spawnSync('psql', ['-X', '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    env, encoding: 'utf8', timeout: 10000,
  })
  if (resultat.status !== 0) throw new Error('Métadonnée locale inaccessible ou garde absente.')
  return resultat.stdout.trim()
}

try {
  const marqueur = lire(`select id::text from sikaloc_test_guard.instance
    where id = '${instanceId}'::uuid and disposable is true`)
  if (marqueur !== instanceId) throw new Error('Marqueur de pile jetable non confirmé.')
  const fichiers = readdirSync(new URL('../supabase/migrations/', import.meta.url))
  const historique = lire("select coalesce(string_agg(version::text, ',' order by version), '') from supabase_migrations.schema_migrations")
  verifierHistoriqueMigrations(fichiers, historique)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exit(2)
}

const fichier = fileURLToPath(new URL('../tests/receipt-historique-asof.integration.sql', import.meta.url))
const resultat = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', fichier], {
  env, encoding: 'utf8', timeout: 30000,
})
if (resultat.status !== 0) {
  process.stderr.write('Échec du scénario SQL de reçu historique ; consulter la sortie locale de psql.\n')
  process.exit(1)
}
if (!resultat.stdout.includes('PASS: courant 50000/50000; reçu historique 30000/70000')) {
  // psql envoie les NOTICE sur stderr selon sa configuration.
  if (!resultat.stderr.includes('PASS: courant 50000/50000; reçu historique 30000/70000')) {
    process.stderr.write('Le scénario SQL n’a pas produit sa preuve PASS attendue.\n')
    process.exit(1)
  }
}
process.stdout.write('PASS : reçu historique à sa date, sur pile locale marquée jetable.\n')
