import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { verifierHistoriqueMigrations, verifierIntention, verifierUrlLocale } from '../src/lib/integration/isolation-guard.mjs'

test('seule la base locale sur le port Supabase de test est admise', () => {
  assert.equal(verifierUrlLocale('postgresql://postgres@127.0.0.1:54322/postgres').host, '127.0.0.1')
  for (const url of [
    'postgresql://postgres@db.pzrixjydnclwvjwqfbal.supabase.co:5432/postgres',
    'postgresql://postgres@db.epjpcmvdvshxfsydltgf.supabase.co:5432/postgres',
    'postgresql://postgres@localhost:54322/postgres',
    'postgresql://postgres@127.0.0.1:5432/postgres',
    'postgresql://postgres@127.0.0.1:54322/production',
    'postgresql://app@127.0.0.1:54322/postgres',
  ]) assert.throws(() => verifierUrlLocale(url), /refusée/)
})

test('le marqueur explicite de pile jetable est obligatoire', () => {
  const id = '7e1867d2-9aa7-4abd-a54c-af2f54db85e2'
  assert.equal(verifierIntention({
    SIKALOC_INTEGRATION_TARGET: 'ephemeral-local',
    SIKALOC_INTEGRATION_INSTANCE_ID: id,
  }), id)
  assert.throws(() => verifierIntention({ SIKALOC_INTEGRATION_INSTANCE_ID: id }), /refusée/)
  assert.throws(() => verifierIntention({ SIKALOC_INTEGRATION_TARGET: 'ephemeral-local' }), /absent/)
})

test('les versions de migration doivent correspondre exactement au dépôt', () => {
  const fichiers = ['20261022090000_initial.sql', '20261022231507_questions.sql']
  assert.equal(verifierHistoriqueMigrations(fichiers, '20261022090000,20261022231507'), 2)
  assert.throws(() => verifierHistoriqueMigrations(fichiers, '20261022090000'), /diffèrent/)
  assert.throws(() => verifierHistoriqueMigrations(fichiers, '20261022090000,20261022231507,20261023000000'), /diffèrent/)
  assert.throws(() => verifierHistoriqueMigrations(fichiers, '20261022090000,20261022231508'), /diffèrent/)
  assert.throws(() => verifierHistoriqueMigrations([...fichiers, '20261022090000_autre.sql'], '20261022090000,20261022231507'), /diffèrent/)
  assert.throws(() => verifierHistoriqueMigrations(['incorrect.sql'], ''), /invalide/)
  assert.throws(() => verifierHistoriqueMigrations([], ''), /diffèrent/)
})

test('le démarrage habituel utilise la pile Supabase locale isolée', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.scripts.dev, 'node scripts/demo/local.mjs dev')
})

test('le scénario SQL refuse une base non marquée avant sa première écriture', () => {
  const sql = readFileSync(new URL('./receipt-historique-asof.integration.sql', import.meta.url), 'utf8')
  const garde = sql.indexOf("to_regclass('sikaloc_test_guard.instance')")
  const premiereEcriture = sql.indexOf('insert into auth.users')
  assert.ok(garde >= 0 && premiereEcriture > garde)
  assert.match(sql, /where disposable is true/)
})
