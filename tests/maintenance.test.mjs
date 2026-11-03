import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  MAINTENANCE_HEADERS,
  MAINTENANCE_TECHNICAL_METHODS,
  isMaintenanceEnabled,
  maintenanceDecision,
  maintenanceResponseSpec,
} from '../src/lib/maintenance-policy.mjs'
import { getSupabaseCspOrigins } from '../src/lib/supabase-csp.mjs'

test('la maintenance reste active par défaut et ne se désactive que par choix explicite', () => {
  assert.equal(isMaintenanceEnabled(undefined), true)
  assert.equal(isMaintenanceEnabled(''), true)
  assert.equal(isMaintenanceEnabled('OFF'), true)
  assert.equal(isMaintenanceEnabled('off'), false)
  assert.equal(maintenanceDecision('/pro', 'GET', 'off'), 'normal')
})

test('les pages, espaces, authentification, API métier et Server Actions sont bloqués', () => {
  const requetes = [
    ['/', 'GET'],
    ['/mentions-legales', 'GET'],
    ['/pro/tableau-de-bord', 'GET'],
    ['/me/paiements', 'GET'],
    ['/find', 'GET'],
    ['/connexion', 'GET'],
    ['/inscription', 'POST'],
    ['/api/quittances/fixture/pdf', 'GET'],
    ['/pro/paiements', 'POST'],
  ]

  for (const [pathname, method] of requetes) {
    assert.equal(maintenanceDecision(pathname, method, undefined), 'maintenance')
  }
})

test('les exceptions techniques sont exactes et limitées aux méthodes nécessaires', () => {
  assert.equal(MAINTENANCE_TECHNICAL_METHODS.size, 5)
  for (const [pathname, methods] of MAINTENANCE_TECHNICAL_METHODS) {
    for (const method of methods) {
      assert.equal(maintenanceDecision(pathname, method, undefined), 'technical')
    }
  }

  assert.equal(maintenanceDecision('/api/abonnement/fedapay', 'GET', undefined), 'maintenance')
  assert.equal(maintenanceDecision('/api/cron/purge', 'DELETE', undefined), 'maintenance')
  assert.equal(maintenanceDecision('/api/cron/purge/extra', 'POST', undefined), 'maintenance')
})

test('les en-têtes de maintenance imposent non-cache, retry et noindex', () => {
  assert.equal(MAINTENANCE_HEADERS['Content-Type'], 'text/html; charset=utf-8')
  assert.match(MAINTENANCE_HEADERS['Cache-Control'], /no-store/)
  assert.equal(MAINTENANCE_HEADERS['Retry-After'], '3600')
  assert.match(MAINTENANCE_HEADERS['X-Robots-Tag'], /noindex/)
})

test('le contrat de réponse produit 503 et un corps HTML sauf pour HEAD', async () => {
  const spec = maintenanceResponseSpec('GET', '<main>Maintenance</main>')
  const response = new Response(spec.body, { status: spec.status, headers: spec.headers })
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), MAINTENANCE_HEADERS['Cache-Control'])
  assert.equal(response.headers.get('retry-after'), '3600')
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')
  assert.equal(await response.text(), '<main>Maintenance</main>')

  const head = maintenanceResponseSpec('HEAD', '<main>Maintenance</main>')
  assert.equal(head.status, 503)
  assert.equal(head.body, null)
})

test('la page est autonome et conserve le texte de maintenance demandé', async () => {
  const source = await readFile(new URL('../src/proxy.ts', import.meta.url), 'utf8')
  assert.match(source, /Sikaloc est actuellement en maintenance\./)
  assert.match(source, /Nous travaillons à l'amélioration de notre plateforme/)
  assert.match(source, /Merci de votre compréhension\. Nous serons bientôt de retour\./)
  assert.doesNotMatch(source, /<script\b|<img\b|<link\b[^>]*href=["']https?:/i)
})

test('les routes techniques laissées passer gardent leur contrôle propre', async () => {
  for (const route of ['cycle-grace', 'notifications', 'purge', 'schema']) {
    const source = await readFile(
      new URL(`../src/app/api/cron/${route}/route.ts`, import.meta.url),
      'utf8',
    )
    assert.match(source, /requeteCronAutorisee/)
  }

  const webhook = await readFile(
    new URL('../src/app/api/abonnement/fedapay/route.ts', import.meta.url),
    'utf8',
  )
  assert.match(webhook, /signatureWebhookValide/)
})

test('la CSP suit le projet Supabase configuré et retombe sur localhost', async () => {
  assert.deepEqual(getSupabaseCspOrigins('https://test-ref.supabase.co'), {
    httpOrigin: 'https://test-ref.supabase.co',
    websocketOrigin: 'wss://test-ref.supabase.co',
  })
  assert.deepEqual(getSupabaseCspOrigins('http://127.0.0.1:54321'), {
    httpOrigin: 'http://127.0.0.1:54321',
    websocketOrigin: 'ws://127.0.0.1:54321',
  })
  assert.deepEqual(getSupabaseCspOrigins(undefined), {
    httpOrigin: 'http://127.0.0.1:54321',
    websocketOrigin: 'ws://127.0.0.1:54321',
  })
  assert.deepEqual(getSupabaseCspOrigins('javascript:alert(1)'), {
    httpOrigin: 'http://127.0.0.1:54321',
    websocketOrigin: 'ws://127.0.0.1:54321',
  })

  const config = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(config, /pzrixjydnclwvjwqfbal/)
})
