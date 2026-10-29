import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  construireEnvironnementRecette,
  extraireNomsVariables,
  SI_TEST_REF,
  SI_TEST_URL,
} from '../scripts/recette-sikaloc-test.mjs'

function cleJwt(claims) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
}

function configurationValide(surcharges = {}) {
  return {
    SIKALOC_TEST_SUPABASE_URL: SI_TEST_URL,
    SIKALOC_TEST_SUPABASE_ANON_KEY: cleJwt({ ref: SI_TEST_REF, role: 'anon' }),
    SIKALOC_TEST_SERVICE_ROLE_KEY: cleJwt({ ref: SI_TEST_REF, role: 'service_role' }),
    SIKALOC_TEST_DB_BACKUP_VERIFIED: '1',
    SIKALOC_TEST_STORAGE_BACKUP_VERIFIED: '1',
    SIKALOC_TEST_AUTH_EMAILS_CONTROLLED: '1',
    ...surcharges,
  }
}

test('la recette force le projet Test et neutralise les intégrations réelles', () => {
  const environnement = construireEnvironnementRecette(
    {
      ...configurationValide(),
      NEXT_PUBLIC_SUPABASE_URL: 'https://pzrixjydnclwvjwqfbal.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'secret-production-ne-doit-pas-passer',
      RESEND_API_KEY: 'cle-production-ne-doit-pas-passer',
      FEDAPAY_SECRET_KEY: 'sk_live_ne_doit_pas_passer',
      SMS_JETON: 'jeton-production-ne-doit-pas-passer',
      CRON_SECRET: 'secret-production-ne-doit-pas-passer',
    },
    ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY'],
  )

  assert.equal(environnement.NEXT_PUBLIC_SUPABASE_URL, SI_TEST_URL)
  assert.equal(environnement.SUPABASE_SERVICE_ROLE_KEY, configurationValide().SIKALOC_TEST_SERVICE_ROLE_KEY)
  assert.equal(environnement.RESEND_API_KEY, '')
  assert.equal(environnement.FEDAPAY_SECRET_KEY, '')
  assert.equal(environnement.SMS_JETON, '')
  assert.notEqual(environnement.CRON_SECRET, 'secret-production-ne-doit-pas-passer')
  assert.equal(environnement.OTP_CANAL_DEV, '0')
  assert.equal(environnement.SIKALOC_DEMO_LOCAL, '')
  assert.equal(environnement.SIKALOC_TEST_SERVICE_ROLE_KEY, undefined)
})

test('refuse toute URL qui ne désigne pas explicitement Sikaloc-Test', () => {
  for (const url of [
    'https://pzrixjydnclwvjwqfbal.supabase.co',
    'http://epjpcmvdvshxfsydltgf.supabase.co',
    'https://epjpcmvdvshxfsydltgf.supabase.co.evil.test',
    `${SI_TEST_URL}/proxy`,
  ]) {
    assert.throws(
      () => construireEnvironnementRecette(configurationValide({ SIKALOC_TEST_SUPABASE_URL: url })),
      /Refus de lancer|URL doit cibler exclusivement/,
    )
  }
})

test('refuse les clés JWT issues d’un autre projet ou ayant un rôle incorrect', () => {
  const mauvaisesCles = [
    cleJwt({ ref: 'pzrixjydnclwvjwqfbal', role: 'anon' }),
    cleJwt({ ref: SI_TEST_REF, role: 'anon' }),
  ]
  assert.throws(
    () => construireEnvironnementRecette(configurationValide({ SIKALOC_TEST_SUPABASE_ANON_KEY: mauvaisesCles[0] })),
    /doit être une clé JWT du projet Sikaloc-Test/,
  )
  assert.throws(
    () => construireEnvironnementRecette(configurationValide({ SIKALOC_TEST_SERVICE_ROLE_KEY: mauvaisesCles[1] })),
    /doit être une clé JWT du projet Sikaloc-Test/,
  )
})

test('exige les deux clés du projet Test sans révéler leurs valeurs', () => {
  assert.throws(() => construireEnvironnementRecette({}), /SIKALOC_TEST_DB_BACKUP_VERIFIED/)
  const sansUrl = configurationValide()
  delete sansUrl.SIKALOC_TEST_SUPABASE_URL
  assert.throws(() => construireEnvironnementRecette(sansUrl), /SIKALOC_TEST_SUPABASE_URL/)
  assert.throws(
    () => construireEnvironnementRecette(configurationValide({ SIKALOC_TEST_SERVICE_ROLE_KEY: '' })),
    /SIKALOC_TEST_SERVICE_ROLE_KEY est requise/,
  )
})

test('bloque le lancement avant validation des sauvegardes et des emails Auth', () => {
  const config = configurationValide()
  delete config.SIKALOC_TEST_DB_BACKUP_VERIFIED
  assert.throws(
    () => construireEnvironnementRecette(config),
    /Recette bloquée : vérifier puis confirmer ces prérequis/,
  )
})

test('FedaPay reste coupé par défaut et n’accepte qu’un ensemble sandbox complet', () => {
  const sansFedaPay = construireEnvironnementRecette(configurationValide())
  assert.equal(sansFedaPay.FEDAPAY_ENV, 'sandbox')
  assert.equal(sansFedaPay.FEDAPAY_SECRET_KEY, '')

  const sandbox = construireEnvironnementRecette(configurationValide({
    SIKALOC_TEST_FEDAPAY_PUBLIC_KEY: 'pk_sandbox_test',
    SIKALOC_TEST_FEDAPAY_SECRET_KEY: 'sk_sandbox_test',
    SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET: 'webhook-sandbox-test',
  }))
  assert.equal(sandbox.FEDAPAY_SECRET_KEY, 'sk_sandbox_test')

  assert.throws(
    () => construireEnvironnementRecette(configurationValide({
      SIKALOC_TEST_FEDAPAY_PUBLIC_KEY: 'pk_live_test',
      SIKALOC_TEST_FEDAPAY_SECRET_KEY: 'sk_live_test',
      SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET: 'webhook-test',
    })),
    /seule une clé sk_sandbox est autorisée/,
  )
  assert.throws(
    () => construireEnvironnementRecette(configurationValide({
      SIKALOC_TEST_FEDAPAY_SECRET_KEY: 'sk_sandbox_test',
    })),
    /les trois identifiants Test/,
  )
})

test('refuse un nom de variable .env inconnu avant que Next.js ne le charge', () => {
  assert.throws(
    () => construireEnvironnementRecette(configurationValide(), ['PRODUCTION_DATABASE_URL']),
    /Variables des fichiers \.env à examiner/,
  )
})

test('extrait seulement les noms de variables, jamais leurs valeurs', () => {
  assert.deepEqual(
    extraireNomsVariables('# commentaire\nexport SECRET_KEY="secret"\nNEXT_PUBLIC_SITE_URL=x'),
    ['SECRET_KEY', 'NEXT_PUBLIC_SITE_URL'],
  )
})
