import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import {
  diagnostiquerPrerequisRecette,
  construireEnvironnementRecette,
  extraireNomsVariables,
  SI_TEST_REF,
  SI_TEST_URL,
} from '../scripts/recette-sikaloc-test.mjs'

function cleJwt(claims) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
}

const dossierPreuves = mkdtempSync(path.join(tmpdir(), 'sikaloc-test-preuves-'))
chmodSync(dossierPreuves, 0o700)
after(() => rmSync(dossierPreuves, { recursive: true, force: true }))

function ecrireFichier(nom, contenu) {
  const chemin = path.join(dossierPreuves, nom)
  writeFileSync(chemin, contenu, { mode: 0o600 })
  chmodSync(chemin, 0o600)
  return { path: chemin, sha256: createHash('sha256').update(contenu).digest('hex') }
}

function ecrireJson(nom, valeur) {
  return ecrireFichier(nom, JSON.stringify(valeur))
}

const archivePostgres = ecrireFichier('test.dump.gpg', '-----BEGIN PGP MESSAGE-----\npostgres fixture ciphertext\n')
const rapportPostgres = ecrireJson('postgres-restore.json', {
  format: 'sikaloc-test-postgres-restore/v1',
  projectRef: SI_TEST_REF,
  status: 'passed',
  isolatedTarget: true,
  sourceArchiveSha256: archivePostgres.sha256,
  checks: {
    schemas: true,
    tables: true,
    constraints: true,
    functions: true,
    triggers: true,
    rls: true,
    aggregateCounts: true,
    authUsersAndIdentities: true,
  },
})
const archiveStorage = ecrireFichier('storage.tar.gpg', '-----BEGIN PGP MESSAGE-----\nstorage fixture ciphertext\n')
const inventaireStorage = ecrireJson('storage-inventory.json', {
  format: 'sikaloc-test-storage-inventory/v1',
  projectRef: SI_TEST_REF,
  objects: [{ bucket: 'quittances', key: 'fixture.pdf', sizeBytes: 16, sha256: 'a'.repeat(64) }],
})
const rapportStorage = ecrireJson('storage-restore.json', {
  format: 'sikaloc-test-storage-restore/v1',
  projectRef: SI_TEST_REF,
  status: 'passed',
  isolatedTarget: true,
  archiveSha256: archiveStorage.sha256,
  inventorySha256: inventaireStorage.sha256,
  restoredObjectsCount: 1,
  objectHashesVerified: true,
})
const rapportEmail = ecrireJson('auth-email.json', {
  format: 'sikaloc-test-auth-email/v1',
  projectRef: SI_TEST_REF,
  status: 'passed',
  confirmationRequired: true,
  smtpConfigured: true,
  redirectAllowlistVerified: true,
  controlledMailboxTestPassed: true,
  existingUsersContacted: false,
})
const manifeste = ecrireJson('evidence.json', {
  format: 'sikaloc-test-evidence/v1',
  projectRef: SI_TEST_REF,
  createdAt: new Date().toISOString(),
  postgres: { archive: { ...archivePostgres, encryption: 'openpgp-armored' }, restoreReport: rapportPostgres },
  storage: {
    archive: { ...archiveStorage, encryption: 'openpgp-armored' },
    inventory: inventaireStorage,
    restoreReport: rapportStorage,
  },
  authEmail: { report: rapportEmail },
})

function configurationValide(surcharges = {}) {
  return {
    SIKALOC_TEST_SUPABASE_URL: SI_TEST_URL,
    SIKALOC_TEST_SUPABASE_ANON_KEY: cleJwt({ ref: SI_TEST_REF, role: 'anon' }),
    SIKALOC_TEST_SERVICE_ROLE_KEY: cleJwt({ ref: SI_TEST_REF, role: 'service_role' }),
    SIKALOC_TEST_BACKUP_MANIFEST: manifeste.path,
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
      NODE_OPTIONS: '--require ./unexpected-hook.cjs',
      UNLISTED_PRIVATE_TOKEN: 'secret-non-autorise',
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
  assert.equal(environnement.NODE_OPTIONS, undefined)
  assert.equal(environnement.UNLISTED_PRIVATE_TOKEN, undefined)
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
  assert.throws(() => construireEnvironnementRecette({}), /SIKALOC_TEST_SUPABASE_URL est absente/)
  const sansUrl = configurationValide()
  delete sansUrl.SIKALOC_TEST_SUPABASE_URL
  assert.throws(() => construireEnvironnementRecette(sansUrl), /SIKALOC_TEST_SUPABASE_URL/)
  assert.throws(
    () => construireEnvironnementRecette(configurationValide({ SIKALOC_TEST_SERVICE_ROLE_KEY: '' })),
    /SIKALOC_TEST_SERVICE_ROLE_KEY est requise/,
  )
})

test('les anciens indicateurs déclaratifs ne remplacent pas les preuves de sauvegarde', () => {
  const config = configurationValide()
  delete config.SIKALOC_TEST_BACKUP_MANIFEST
  config.SIKALOC_TEST_DB_BACKUP_VERIFIED = '1'
  config.SIKALOC_TEST_STORAGE_BACKUP_VERIFIED = '1'
  config.SIKALOC_TEST_AUTH_EMAILS_CONTROLLED = '1'
  assert.throws(
    () => construireEnvironnementRecette(config),
    /Manifeste de sauvegarde/,
  )
})

test('vérifie les empreintes réelles et les rapports de restauration isolée', () => {
  assert.doesNotThrow(() => construireEnvironnementRecette(configurationValide()))
  assert.throws(
    () => construireEnvironnementRecette(configurationValide({
      SIKALOC_TEST_BACKUP_MANIFEST: path.join(dossierPreuves, 'absent.json'),
    })),
    /Manifeste de sauvegarde/,
  )
  const contenu = JSON.parse(readFileSync(manifeste.path, 'utf8'))
  const fauxManifeste = ecrireJson('evidence-wrong-hash.json', {
    ...contenu,
    postgres: {
      ...contenu.postgres,
      archive: { ...contenu.postgres.archive, sha256: '0'.repeat(64) },
    },
  })
  assert.throws(
    () => construireEnvironnementRecette(configurationValide({
      SIKALOC_TEST_BACKUP_MANIFEST: fauxManifeste.path,
    })),
    /empreinte SHA-256 incohérente/,
  )
  const archiveNonChiffree = ecrireFichier('plaintext.dump', 'not an encrypted backup')
  const manifesteNonChiffre = ecrireJson('evidence-plaintext.json', {
    ...contenu,
    postgres: {
      ...contenu.postgres,
      archive: { ...archiveNonChiffree, encryption: 'openpgp-armored' },
    },
  })
  assert.throws(
    () => construireEnvironnementRecette(configurationValide({
      SIKALOC_TEST_BACKUP_MANIFEST: manifesteNonChiffre.path,
    })),
    /en-tête d’archive OpenPGP est invalide/,
  )
})

test('préflight consultatif détaille les blocages sans démarrer le serveur', () => {
  const controles = diagnostiquerPrerequisRecette({}, [])
  assert.ok(controles.every(({ nom, statut, detail }) => nom && statut && detail))
  assert.ok(controles.some(({ nom, statut }) => nom === 'Cible Supabase' && statut === 'BLOQUÉ'))
  assert.ok(controles.some(({ nom, statut }) => nom === 'Sauvegardes et restauration' && statut === 'BLOQUÉ'))
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
