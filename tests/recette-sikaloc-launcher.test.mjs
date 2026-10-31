import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import {
  diagnostiquerPrerequisRecette,
  construireEnvironnementRecette,
  extraireNomsVariables,
  chargerConfigurationRecettePrivee,
  fusionnerConfigurationRecettePrivee,
  verifierConnexionProjetTest,
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

test('charge la configuration locale privée et mappe la clé publishable sur le nom client attendu', () => {
  const cleServiceTest = cleJwt({ ref: SI_TEST_REF, role: 'service_role' })
  const fichier = ecrireFichier('app-test.env', [
    '# Configuration dédiée au projet Test',
    `NEXT_PUBLIC_SUPABASE_URL="${SI_TEST_URL}"`,
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture',
    `SIKALOC_TEST_SERVICE_ROLE_KEY=${cleServiceTest}`,
    `SIKALOC_TEST_BACKUP_MANIFEST=${manifeste.path}`,
  ].join('\n')).path

  const source = fusionnerConfigurationRecettePrivee({
    NEXT_PUBLIC_SUPABASE_URL: 'https://pzrixjydnclwvjwqfbal.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'production-value-must-not-be-used',
  }, fichier)
  assert.equal(source.SIKALOC_TEST_SUPABASE_URL, SI_TEST_URL)
  assert.equal(source.SIKALOC_TEST_SUPABASE_ANON_KEY, 'sb_publishable_fixture')

  const environnement = construireEnvironnementRecette(source, [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ])
  assert.equal(environnement.NEXT_PUBLIC_SUPABASE_URL, SI_TEST_URL)
  assert.equal(environnement.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'sb_publishable_fixture')
  assert.equal(environnement.SUPABASE_SERVICE_ROLE_KEY, cleServiceTest)
  assert.equal(environnement.SIKALOC_TEST_SUPABASE_URL, undefined)
  assert.equal(environnement.SIKALOC_TEST_SERVICE_ROLE_KEY, undefined)
})

test('fusionne admin.env et garde la clé secrète hors des variables publiques', () => {
  const cleSecrete = 'sb_secret_fixture'
  const app = ecrireFichier('app-test-separated.env', [
    `NEXT_PUBLIC_SUPABASE_URL=${SI_TEST_URL}`,
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture',
  ].join('\n')).path
  const admin = ecrireFichier('admin-test-separated.env', `SIKALOC_TEST_SUPABASE_SECRET_KEY=${cleSecrete}`).path
  const source = fusionnerConfigurationRecettePrivee({
    SIKALOC_TEST_BACKUP_MANIFEST: manifeste.path,
  }, app, admin)
  const environnement = construireEnvironnementRecette(source)

  assert.equal(source.SIKALOC_TEST_SERVICE_ROLE_KEY, cleSecrete)
  assert.equal(environnement.SUPABASE_SERVICE_ROLE_KEY, cleSecrete)
  assert.equal(environnement.NEXT_PUBLIC_SUPABASE_SECRET_KEY, undefined)
  assert.equal(environnement.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, undefined)
})

test('le préflight ne prétend pas vérifier hors ligne le projet d’une clé publishable opaque', () => {
  const controles = diagnostiquerPrerequisRecette(configurationValide({
    SIKALOC_TEST_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
  }), [])
  const controle = controles.find(({ nom }) => nom === 'Clé publique Supabase Test')
  assert.equal(controle?.statut, 'OK')
  assert.match(controle?.detail ?? '', /correspondance clé\/projet non vérifiable hors ligne/)
  assert.doesNotMatch(controle?.detail ?? '', /fixture/)
})

test('accepte une clé serveur Supabase Secret sans prétendre connaître son projet hors ligne', () => {
  const secret = 'sb_secret_fixture'
  const config = configurationValide({ SIKALOC_TEST_SERVICE_ROLE_KEY: secret })
  assert.doesNotThrow(() => construireEnvironnementRecette(config))
  const controle = diagnostiquerPrerequisRecette(config, []).find(({ nom }) => nom === 'Clé serveur Supabase Test')
  assert.equal(controle?.statut, 'OK')
  assert.match(controle?.detail ?? '', /référence projet à confirmer par contrôle de connexion GET/)
  assert.doesNotMatch(controle?.detail ?? '', /sb_secret_fixture/)
})

test('la vérification de connexion utilise les réglages Auth publics sans exposer une clé opaque en Bearer', async () => {
  const requetes = []
  const secret = 'sb_secret_fixture'
  const resultat = await verifierConnexionProjetTest(
    configurationValide({
      SIKALOC_TEST_SERVICE_ROLE_KEY: secret,
      SIKALOC_TEST_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
    }),
    async (url, options) => {
      requetes.push({ url: String(url), options })
      return new Response('{}', { status: 200 })
    },
  )

  assert.equal(requetes.length, 2)
  for (const requete of requetes) {
    assert.equal(requete.url, `${SI_TEST_URL}/auth/v1/settings`)
    assert.equal(requete.options.method, 'GET')
    assert.equal(requete.options.redirect, 'error')
    assert.equal(requete.options.headers.has('authorization'), false)
  }
  assert.equal(requetes[0].options.headers.get('apikey'), secret)
  assert.equal(requetes[1].options.headers.get('apikey'), 'sb_publishable_fixture')
  assert.deepEqual(resultat, {
    projectRef: SI_TEST_REF,
    method: 'GET',
    path: '/auth/v1/settings',
    server: { type: 'secret', status: 200, accepted: true, headerNames: ['apikey'] },
    publicClient: { type: 'publishable', status: 200, accepted: true, headerNames: ['apikey'] },
  })
})

test('la vérification de connexion garde la compatibilité avec une ancienne clé service_role Test', async () => {
  const entetes = []
  const serviceRole = cleJwt({ ref: SI_TEST_REF, role: 'service_role' })
  await verifierConnexionProjetTest(
    configurationValide({ SIKALOC_TEST_SERVICE_ROLE_KEY: serviceRole }),
    async (_url, options) => {
      entetes.push(options.headers)
      return new Response('{}', { status: 200 })
    },
  )
  assert.equal(entetes[0].get('apikey'), serviceRole)
  assert.equal(entetes[0].get('authorization'), `Bearer ${serviceRole}`)
  assert.equal(entetes[1].get('authorization'), `Bearer ${configurationValide().SIKALOC_TEST_SUPABASE_ANON_KEY}`)
})

test('la vérification de connexion refuse une URL autre que Sikaloc-Test avant toute requête', async () => {
  let appele = false
  await assert.rejects(
    verifierConnexionProjetTest(
      configurationValide({ SIKALOC_TEST_SUPABASE_URL: 'https://pzrixjydnclwvjwqfbal.supabase.co' }),
      async () => { appele = true },
    ),
    /URL doit cibler exclusivement/,
  )
  assert.equal(appele, false)
})

test('refuse les variables non autorisées sans afficher leurs valeurs', () => {
  const fichier = ecrireFichier('app-test-unknown.env', 'DATABASE_URL=must-never-be-shown').path
  assert.throws(() => chargerConfigurationRecettePrivee(fichier), (erreur) => {
    assert.match(erreur.message, /DATABASE_URL/)
    assert.doesNotMatch(erreur.message, /must-never-be-shown/)
    return true
  })
})

test('refuse les fichiers de configuration non privés et les liens symboliques', () => {
  const fichierOuvert = ecrireFichier('app-test-open.env', `NEXT_PUBLIC_SUPABASE_URL=${SI_TEST_URL}`).path
  chmodSync(fichierOuvert, 0o644)
  assert.throws(() => chargerConfigurationRecettePrivee(fichierOuvert), /doivent appartenir.*rester privés/)
  chmodSync(fichierOuvert, 0o600)

  const lien = path.join(dossierPreuves, 'app-test-link.env')
  symlinkSync(fichierOuvert, lien)
  assert.throws(() => chargerConfigurationRecettePrivee(lien), /liens symboliques refusés/)
})
