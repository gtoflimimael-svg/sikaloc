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

// Tous les scénarios `tests/*.integration.sql`, chacun devant prouver son
// succès par une ligne « PASS: » (NOTICE psql) ; chaque scénario annule ses
// propres fixtures.
const dossierTests = new URL('../tests/', import.meta.url)
const scenarios = readdirSync(dossierTests).filter((nom) => nom.endsWith('.integration.sql')).sort()
if (scenarios.length === 0) {
  process.stderr.write('Aucun scénario SQL d’intégration trouvé.\n')
  process.exit(1)
}
for (const nom of scenarios) {
  const resultat = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', fileURLToPath(new URL(nom, dossierTests))], {
    env, encoding: 'utf8', timeout: 60000,
  })
  const sortie = `${resultat.stdout ?? ''}\n${resultat.stderr ?? ''}`
  const echec = sortie.split('\n').find((ligne) => /ERROR|FAIL/.test(ligne))
  if (resultat.status !== 0 || !/PASS:/.test(sortie)) {
    process.stderr.write(`ÉCHEC ${nom}${echec ? ` : ${echec.replace(/^.*?(ERROR|FAIL)/, '$1').slice(0, 300)}` : ''}\n`)
    process.exit(1)
  }
  process.stdout.write(`PASS ${nom}\n`)
}
process.stdout.write(`${scenarios.length} scénario(s) SQL réussis sur pile locale marquée jetable.\n`)
