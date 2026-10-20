import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  comptePleinementVerifie,
  etatCanalDepuisConfiguration,
  etapeCourante,
  etapesRestantes,
  telephoneExigiblePourActivation,
} from '../src/lib/verification/regles.ts'

const racine = new URL('../', import.meta.url)

test('la confirmation email reste obligatoire, le téléphone ne l’est pas par défaut', () => {
  assert.equal(
    comptePleinementVerifie({ emailVerifie: true, telephoneVerifie: false }),
    true,
  )
  assert.equal(
    comptePleinementVerifie({ emailVerifie: false, telephoneVerifie: true }),
    false,
  )
  assert.equal(
    comptePleinementVerifie(
      { emailVerifie: true, telephoneVerifie: false },
      { telephoneExigible: true },
    ),
    false,
  )
})

test('seul un transport réellement opérationnel peut rendre le téléphone exigible', () => {
  assert.equal(telephoneExigiblePourActivation(['desactive']), false)
  assert.equal(telephoneExigiblePourActivation(['indisponible']), false)
  assert.equal(telephoneExigiblePourActivation(['configure']), false)
  assert.equal(telephoneExigiblePourActivation(['configure', 'operationnel']), true)
  assert.equal(
    telephoneExigiblePourActivation(['operationnel'], { trappeDeveloppement: true }),
    false,
  )
})

test('variables OTP absentes, partielles ou complètes sans adaptateur ne rendent pas le téléphone exigible', () => {
  const absent = etatCanalDepuisConfiguration(4, 0)
  const partiel = etatCanalDepuisConfiguration(4, 2)
  const completMaisSansTransport = etatCanalDepuisConfiguration(4, 4)

  assert.equal(absent, 'desactive')
  assert.equal(partiel, 'indisponible')
  assert.equal(completMaisSansTransport, 'configure')
  assert.equal(
    telephoneExigiblePourActivation([absent, partiel, completMaisSansTransport]),
    false,
  )
})

test('les étapes et le compteur ne présentent pas le téléphone comme obligatoire par défaut', () => {
  const emailConfirme = { emailVerifie: true, telephoneVerifie: false }
  assert.equal(etapeCourante(emailConfirme), null)
  assert.equal(etapeCourante(emailConfirme, { telephoneExigible: true }), 'telephone')
  assert.equal(etapesRestantes(emailConfirme), 0)
  assert.equal(etapesRestantes(emailConfirme, { telephoneExigible: true }), 1)
  assert.equal(etapeCourante({ ...emailConfirme, emailVerifie: false }), 'email')
})

test('l’inscription crée un compte Auth sans écrire un marqueur de téléphone vérifié', async () => {
  const source = await readFile(new URL('src/lib/actions/auth.ts', racine), 'utf8')
  assert.match(source, /supabase\.auth\.signUp\(/)
  assert.match(source, /emailRedirectTo:.*\/verification/s)
  assert.doesNotMatch(source, /telephone_verifie_le\s*:/)
})

test('la confirmation email et la reprise continuent à utiliser Supabase Auth', async () => {
  const source = await readFile(new URL('src/lib/actions/verification.ts', racine), 'utf8')
  assert.match(source, /auth\.verifyOtp\(\{\s*email,\s*token: code,\s*type: 'signup'/s)
  assert.match(source, /auth\.resend\(\{\s*type: 'signup',\s*email\s*\}\)/)
  assert.match(source, /export async function reprendreVerificationEmail/)
  assert.match(source, /await poserTemoinVerification\(email\)/)
})

test('le code téléphonique n’est marqué vérifié qu’après validation serveur du code', async () => {
  const source = await readFile(new URL('src/lib/actions/verification.ts', racine), 'utf8')
  const validation = source.indexOf('const verdict = await verifierCodeTelephone(')
  const rejet = source.indexOf('if (!verdict.ok)', validation)
  const ecriture = source.indexOf('telephone_verifie_le: new Date().toISOString()', validation)
  assert.ok(validation >= 0)
  assert.ok(rejet > validation)
  assert.ok(ecriture > rejet)
})

test('l’accès bailleur reste gardé côté serveur par l’état email et les gardes métier', async () => {
  const session = await readFile(new URL('src/lib/session.ts', racine), 'utf8')
  assert.match(session, /supabase\.auth\.getUser\(\)/)
  assert.match(session, /if \(!etat\.pleinementVerifie\) redirect\('\/verification'\)/)
  assert.match(session, /export async function bailleurAvecEcriture/)
})

test('les variables configurées mais sans adaptateur opérationnel ne sont pas une preuve de disponibilité', async () => {
  const source = await readFile(new URL('src/lib/verification/canaux.ts', racine), 'utf8')
  const debut = source.indexOf('export function verificationTelephoneExigible')
  const fin = source.indexOf('\n}\n', debut)
  assert.ok(debut >= 0 && fin > debut)
  const fonction = source.slice(debut, fin)
  assert.match(fonction, /telephoneExigiblePourActivation/)
  assert.match(fonction, /CANAUX_TELEPHONE\.map\(etatCanal\)/)
  assert.doesNotMatch(fonction, /process\.env\./)
})
