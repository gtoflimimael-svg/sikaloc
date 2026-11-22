// Gardes des tests de bout en bout (QA-01, FN-01) : ils ne doivent jamais
// écrire à une vraie adresse, appeler le vrai FedaPay, ni viser la démo ou un
// projet hébergé.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { configurationE2E } from '../scripts/e2e/configuration.mjs'
import { baseApiRemplacement } from '../src/lib/fedapay-base.ts'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

test('la pile E2E coupe le SMTP réel et le seed, et change de projet et de ports', async () => {
  const config = configurationE2E(await lire('supabase/config.toml'))
  assert.match(config, /^project_id = "sikaloc-e2e"$/m)
  assert.match(config, /\[auth\.email\.smtp\][^[]*enabled = false/)
  assert.match(config, /\[db\.seed\][^[]*enabled = false/)
  assert.doesNotMatch(config, /\b543\d\d\b/)
  assert.match(config, /\[api\][^[]*port = 55321/)
})

test('FedaPay de remplacement : local uniquement', () => {
  assert.equal(baseApiRemplacement('http://127.0.0.1:9150/v1'), 'http://127.0.0.1:9150/v1')
  assert.equal(baseApiRemplacement('http://localhost:9150/v1/'), 'http://localhost:9150/v1')
  for (const refuse of ['https://api.fedapay.com/v1', 'http://evil.example/v1', 'http://user:mdp@127.0.0.1:1/v1',
    'http://127.0.0.1.evil.example/v1', 'file:///etc/passwd', '', undefined]) {
    assert.equal(baseApiRemplacement(refuse), null, String(refuse))
  }
})

test('le remplacement FedaPay est ignoré avec une clé live', async () => {
  const fedapay = await lire('src/lib/fedapay.ts')
  assert.match(fedapay, /environnement === 'sandbox' \? baseApiRemplacement\(process\.env\.FEDAPAY_API_URL\) : null/)
})

test('le lanceur neutralise toutes les variables de .env.example et vise une pile locale', async () => {
  const lanceur = await lire('scripts/e2e/lancer.mjs')
  assert.match(lanceur, /readFileSync\(path\.join\(racine, '\.env\.example'\)/)
  assert.match(lanceur, /\.\.\.neutres,/)
  assert.match(lanceur, /FEDAPAY_SECRET_KEY: 'sk_sandbox_e2e_factice'/)
  assert.match(lanceur, /urlPile\.port === '54821'/)
  const fixtures = await lire('scripts/e2e/fixtures.mjs')
  assert.match(fixtures, /process\.env\.SIKALOC_E2E !== '1'/)
  assert.match(fixtures, /charge\.iss !== 'supabase-demo'/)
  assert.match(fixtures, /url\.port === '54821'/)
})

test('la CI lance les E2E sur une pile jetable, arrêtée dans tous les cas', async () => {
  const ci = await lire('.github/workflows/quality.yml')
  assert.match(ci, /node scripts\/e2e\/pile\.mjs demarrer/)
  assert.match(ci, /npm run test:e2e -- --workdir/)
  assert.match(ci, /if: always\(\)\s+run: node scripts\/e2e\/pile\.mjs arreter/)
})
