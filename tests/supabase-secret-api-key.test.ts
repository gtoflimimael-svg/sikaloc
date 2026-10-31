import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'

import { fetchSupabaseSansSecretBearer } from '../src/lib/supabase/fetch-cle-secrete'

const URL_TEST = 'https://epjpcmvdvshxfsydltgf.supabase.co'

test('supabase-js accepte une Secret key et ne l’envoie pas comme Bearer', async () => {
  let entetesRequete: Headers | undefined
  const secretFixture = 'sb_secret_fixture'
  const fetchIntercepte = fetchSupabaseSansSecretBearer(async (_input, init) => {
    entetesRequete = new Headers(init?.headers)
    return new Response(null, { status: 200, headers: { 'content-range': '0-0/0' } })
  })

  const client = createClient(URL_TEST, secretFixture, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchIntercepte },
  })
  const { error } = await client.from('fixture_sans_donnees').select('id', { head: true }).limit(0)

  assert.equal(error, null)
  assert.equal(entetesRequete?.get('apikey'), secretFixture)
  assert.equal(entetesRequete?.has('authorization'), false)
})

test('le filtre de sécurité préserve un Bearer utilisateur et les anciennes service_role', async () => {
  const jetonsAuthentification = [
    { apikey: 'sb_secret_fixture', authorization: 'Bearer ey.fixture.user', attendu: 'Bearer ey.fixture.user' },
    { apikey: 'ey.fixture.service_role', authorization: 'Bearer ey.fixture.service_role', attendu: 'Bearer ey.fixture.service_role' },
  ]

  for (const jeton of jetonsAuthentification) {
    let entetesRequete: Headers | undefined
    const filtrer = fetchSupabaseSansSecretBearer(async (_input, init) => {
      entetesRequete = new Headers(init?.headers)
      return new Response(null, { status: 204 })
    })
    await filtrer(`${URL_TEST}/rest/v1/`, {
      headers: { apikey: jeton.apikey, authorization: jeton.authorization },
    })
    assert.equal(entetesRequete?.get('authorization'), jeton.attendu)
  }

})
