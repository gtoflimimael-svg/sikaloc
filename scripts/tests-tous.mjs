// Lance tous les tests Node du dépôt (OPS-03 / QA) : la CI n'en exécutait
// qu'une partie. Seul `hydratation-ui` est exclu : il exige un serveur local de
// revue désigné explicitement (HYDRATION_TEST_URL).
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const EXCLUS = new Set(['hydratation-ui.test.mjs'])
const fichiers = readdirSync(new URL('../tests/', import.meta.url))
  .filter((nom) => /\.test\.(mjs|ts)$/.test(nom) && !EXCLUS.has(nom))
  .sort()
  .map((nom) => `tests/${nom}`)

const resultat = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--experimental-strip-types', '--test', '--test-concurrency=1', ...fichiers],
  { stdio: 'inherit' },
)
process.exit(resultat.status ?? 1)
