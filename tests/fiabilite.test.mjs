// Non-régression du lot « fiabilité » (audit du 22/11/2026) : OPS-01 Sentry,
// OPS-03 CI avec base réelle, OPS-06 migrations immuables, OPS-07 journal.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, appendFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { journaliserEchec } from '../src/lib/journal.ts'
import { masquer, nettoyerEvenement, nettoyerFil, optionsCommunes } from '../src/lib/sentry-options.ts'
import { getSentryCspOrigin } from '../src/lib/sentry-csp.mjs'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

function capturerConsole(fn) {
  const appels = []
  const original = console.error
  console.error = (...args) => appels.push(args)
  try { fn() } finally { console.error = original }
  return appels
}

test('OPS-07 : le journal garde étape et codes, jamais le message brut', () => {
  const cause = new Error('Refus', { cause: { etape: 'precontrole_echeance', code: '42703', nom: 'PostgrestError' } })
  Object.assign(cause, { code: 'X1' })
  const [[etiquette, detail]] = capturerConsole(() => journaliserEchec('paiements.valider', cause))
  assert.equal(etiquette, '[paiements.valider] échec')
  assert.deepEqual(
    { etape: detail.etape, code_origine: detail.code_origine, type_origine: detail.type_origine, code: detail.code },
    { etape: 'precontrole_echeance', code_origine: '42703', type_origine: 'PostgrestError', code: 'X1' },
  )
  const [[, brut]] = capturerConsole(() => journaliserEchec('x', { message: 'jean@exemple.bj a échoué', code: 'pas un code !' }))
  assert.equal(JSON.stringify(brut).includes('jean@exemple.bj'), false)
  assert.equal(brut.code, undefined)
})

test('OPS-07 : les échecs autrefois silencieux sont journalisés', async () => {
  for (const [fichier, etiquette] of [
    ['src/lib/actions/paiements.ts', 'paiements.valider'],
    ['src/lib/actions/paiements.ts', 'paiements.regenerer'],
    ['src/app/api/abonnement/fedapay/route.ts', 'fedapay.webhook_illisible'],
    ['src/app/api/cron/notifications/route.ts', 'cron.notifications'],
    ['src/lib/fedapay.ts', 'fedapay.api'],
    ['src/lib/reglement-abonnement.ts', 'abonnement.reglement'],
    ['src/lib/file-notifications.ts', 'notifications.envoi'],
    ['src/lib/emails.ts', 'emails.resend'],
  ]) assert.match(await lire(fichier), new RegExp(`journaliserEchec\\('${etiquette.replace('.', '\\.')}'`), fichier)
  const quittance = await lire('src/lib/quittance.ts')
  assert.doesNotMatch(quittance, /throw new Error\(REFUS_QUITTANCE\)/)
  assert.match(quittance, /throw refusQuittance\('precontrole_echeance', erreurEcheance\)/)
})

test('OPS-01 : Sentry ne reçoit ni utilisateur, ni corps, ni email, ni téléphone', () => {
  const evenement = nettoyerEvenement({
    type: undefined,
    user: { id: 'u1', email: 'a@b.co' },
    message: 'échec pour a.b@exemple.bj au +229 97 00 00 11',
    request: { cookies: { s: '1' }, headers: { cookie: 's' }, data: { motDePasse: 'x' }, query_string: 'email=a@b.co' },
    exception: { values: [{ value: 'contact jean@exemple.bj' }] },
    extra: { detail: { email: 'c@d.fr' } },
    breadcrumbs: [{ message: 'tel 22997000011', data: { x: 'e@f.io' } }],
  })
  const texte = JSON.stringify(evenement)
  for (const interdit of ['a@b.co', 'a.b@exemple.bj', 'jean@exemple.bj', 'c@d.fr', 'e@f.io', '97 00 00 11', '22997000011', 'motDePasse']) {
    assert.equal(texte.includes(interdit), false, interdit)
  }
  assert.equal(evenement.user, undefined)
  const options = optionsCommunes(undefined)
  assert.equal(options.enabled, false)
  assert.equal(options.sendDefaultPii, false)
  assert.equal(optionsCommunes('https://k@o1.ingest.de.sentry.io/2').enabled, true)
})

test('OPS-01 : URL de requêtes, emails encodés et numéros masqués ; dates conservées', () => {
  const url = 'http://127.0.0.1:54821/rest/v1/tentatives_connexion?select=tentee_le&email=eq.bailleur%40sikaloc-demo.test'
  const masque = masquer(`GET ${url} échoué le 2026-11-22 ; tel 22997000011 ; 3 essais`)
  assert.equal(masque.includes('sikaloc-demo'), false)
  assert.equal(masque.includes('22997000011'), false)
  assert.match(masque, /\/rest\/v1\/tentatives_connexion\?\[requête masquée\]/)
  assert.match(masque, /2026-11-22/)
  assert.match(masque, /3 essais/)
  assert.equal(optionsCommunes('https://k@o1.ingest.sentry.io/2').tracesSampleRate, 0)
  const fil = nettoyerFil({ data: { url } })
  assert.equal(JSON.stringify(fil).includes('%40'), false)
})

test('OPS-01 : CSP Sentry limitée à une origine sentry.io, sans la clé', () => {
  assert.equal(getSentryCspOrigin('https://cle@o123.ingest.de.sentry.io/456'), 'https://o123.ingest.de.sentry.io')
  assert.equal(getSentryCspOrigin('https://cle@evil.example.com/1'), '')
  assert.equal(getSentryCspOrigin('http://cle@o1.ingest.sentry.io/1'), '')
  assert.equal(getSentryCspOrigin(undefined), '')
})

test('OPS-01 : instrumentation, erreur globale et crons suivis', async () => {
  assert.match(await lire('src/instrumentation.ts'), /export const onRequestError = Sentry\.captureRequestError/)
  assert.match(await lire('src/instrumentation-client.ts'), /optionsCommunes\(process\.env\.NEXT_PUBLIC_SENTRY_DSN\)/)
  assert.doesNotMatch(await lire('src/instrumentation-client.ts'), /replayIntegration/)
  assert.match(await lire('src/app/global-error.tsx'), /Sentry\.captureException\(error\)/)
  const suivi = await lire('src/lib/cron-suivi.ts')
  assert.ok(suivi.indexOf('requeteCronAutorisee(request.headers)') < suivi.indexOf('captureCheckIn'))
  const vercel = JSON.parse(await lire('vercel.json'))
  for (const { path: chemin, schedule } of vercel.crons) {
    const nom = chemin.split('/').pop()
    assert.match(await lire(`src/app/api/cron/${nom}/route.ts`), new RegExp(`suivreCron\\('${nom}', '${schedule.replace(/\*/g, '\\*')}'`), nom)
  }
})

test('OPS-06 : une migration livrée modifiée fait échouer le contrôle', () => {
  const copie = mkdtempSync(path.join(tmpdir(), 'sikaloc-migrations-'))
  try {
    const source = fileURLToPath(racine)
    cpSync(path.join(source, 'supabase'), path.join(copie, 'supabase'), { recursive: true })
    cpSync(path.join(source, 'scripts', 'verifier-migrations-statique.mjs'), path.join(copie, 'scripts', 'verifier-migrations-statique.mjs'))
    const lancer = () => spawnSync(process.execPath, [path.join(copie, 'scripts', 'verifier-migrations-statique.mjs')], { encoding: 'utf8' })
    assert.equal(lancer().status, 0, 'le dépôt doit être conforme à son verrou')
    const verrou = JSON.parse(readFileSync(path.join(copie, 'supabase', 'migrations.lock.json'), 'utf8'))
    const premiere = Object.keys(verrou).sort()[0]
    appendFileSync(path.join(copie, 'supabase', 'migrations', premiere), '\n-- réécriture\n')
    const echec = lancer()
    assert.notEqual(echec.status, 0)
    assert.match(echec.stderr, /Migration livrée modifiée/)
  } finally {
    rmSync(copie, { recursive: true, force: true })
  }
})

test('OPS-03 : la CI applique les migrations sur une base jetable et rejoue les scénarios SQL', async () => {
  const ci = await lire('.github/workflows/quality.yml')
  assert.match(ci, /run: npm test/)
  assert.match(ci, /npx supabase db start/)
  assert.match(ci, /npx supabase migration up --local/)
  assert.match(ci, /run: node scripts\/run-isolated-sql-test\.mjs/)
  const isolation = await lire('tests/isolation-bailleurs.integration.sql')
  assert.match(isolation, /^begin;$/m)
  assert.match(isolation, /^rollback;$/m)
  assert.match(isolation, /PASS: isolation bailleurs/)
  const schema = await lire('src/lib/schema.ts')
  assert.ok(schema.indexOf('lireColonnesCatalogue(') < schema.indexOf("existe(table, '*')"))
})
