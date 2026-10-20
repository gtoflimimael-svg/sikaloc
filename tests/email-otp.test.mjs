import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  LONGUEUR_CODE_EMAIL_DEFAUT,
  lireLongueurCodeEmail,
  validerCodeEmail,
} from '../src/lib/verification/email-otp.ts'
import { LONGUEUR_CODE } from '../src/lib/verification/regles.ts'

const racine = new URL('../', import.meta.url)

test('longueur email configurable dans la plage Supabase, avec défaut historique 6', () => {
  assert.equal(LONGUEUR_CODE_EMAIL_DEFAUT, 6)
  assert.equal(lireLongueurCodeEmail(undefined), 6)
  assert.equal(lireLongueurCodeEmail(''), 6)
  assert.equal(lireLongueurCodeEmail('6'), 6)
  assert.equal(lireLongueurCodeEmail('8'), 8)
  assert.equal(lireLongueurCodeEmail('10'), 10)
  for (const valeur of ['5', '11', '6.5', '08', 'abc', ' 8']) {
    assert.throws(() => lireLongueurCodeEmail(valeur))
  }
})

test('un code email de six chiffres est accepté dans un environnement configuré à six', () => {
  assert.deepEqual(validerCodeEmail('123456', lireLongueurCodeEmail('6')), {
    ok: true,
    code: '123456',
  })
})

test('un code email de huit chiffres est accepté dans un environnement configuré à huit', () => {
  assert.deepEqual(validerCodeEmail('12345678', lireLongueurCodeEmail('8')), {
    ok: true,
    code: '12345678',
  })
})

test('un code plus court est rejeté avec le motif incomplet', () => {
  assert.deepEqual(validerCodeEmail('123456', 8), {
    ok: false,
    motif: 'code_incomplet',
  })
})

test('un code plus long est rejeté sans troncature', () => {
  assert.deepEqual(validerCodeEmail('123456789', 8), {
    ok: false,
    motif: 'code_trop_long',
  })
})

test('les caractères non numériques sont rejetés, sans normalisation silencieuse', () => {
  assert.deepEqual(validerCodeEmail('1234 678', 8), {
    ok: false,
    motif: 'code_format_invalide',
  })
  assert.deepEqual(validerCodeEmail('1234a678', 8), {
    ok: false,
    motif: 'code_format_invalide',
  })
})

test('les zéros initiaux sont conservés', () => {
  assert.deepEqual(validerCodeEmail('00000008', 8), {
    ok: true,
    code: '00000008',
  })
})

test('l’action transmet intégralement le code à Supabase verifyOtp', async () => {
  const source = await readFile(new URL('src/lib/actions/verification.ts', racine), 'utf8')
  const debut = source.indexOf('export async function verifierCodeEmail(')
  const fin = source.indexOf('// ═══ Téléphone', debut)
  const action = source.slice(debut, fin)
  assert.match(action, /validerCodeEmail\(donnees\.get\('code'\), LONGUEUR_CODE_EMAIL\)/)
  assert.match(action, /auth\.verifyOtp\(\{[\s\S]*token: code,[\s\S]*type: 'signup'/)
  assert.doesNotMatch(action, /replace\(|slice\(/)
})

test('un code invalide ou expiré ne contourne pas la confirmation email', async () => {
  const source = await readFile(new URL('src/lib/actions/verification.ts', racine), 'utf8')
  const action = source.slice(
    source.indexOf('export async function verifierCodeEmail('),
    source.indexOf('// ═══ Téléphone'),
  )
  assert.match(action, /auth\.verifyOtp/)
  assert.match(action, /if \(error\)[\s\S]*code_incorrect_ou_expire/)
  assert.match(action, /type: 'signup'/)
  assert.equal(validerCodeEmail('', 8).ok, false)
})

test('la règle téléphone reste distincte et conserve six chiffres', async () => {
  assert.equal(LONGUEUR_CODE, 6)
  const composant = await readFile(new URL('src/components/ui/champ-code.tsx', racine), 'utf8')
  const formulaires = await readFile(
    new URL('src/components/verification/formulaires.tsx', racine),
    'utf8',
  )
  assert.match(composant, /longueur = LONGUEUR_CODE/)
  assert.match(formulaires, /longueur=\{LONGUEUR_CODE_EMAIL\}[\s\S]*strictFormat/)
  assert.match(formulaires, /<ChampCode[\s\S]*libelle="Entrez le code reçu"/)
})
