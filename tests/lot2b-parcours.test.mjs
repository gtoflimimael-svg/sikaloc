import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { lireNumeroPage } from '../src/lib/pagination.ts'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

test('Pro : une erreur de comptage interdit la création d’un logement au-delà du contrôle du plan', async () => {
  const source = await lire('src/lib/actions/logements.ts')
  const creation = source.slice(source.indexOf('export async function creerLogement('), source.indexOf('export async function modifierLogement('))
  assert.match(creation, /\.eq\('bailleur_id', bailleur\.id\)/)
  assert.match(creation, /if \(erreurComptage \|\| count === null\) return/)
})

test('Me : le compte invité utilise l’adresse relue sur le jeton, non le champ transmis', async () => {
  const source = await lire('src/lib/actions/rejoindre.ts')
  const rejoindre = source.slice(source.indexOf('export async function rejoindreAvecInvitation('), source.indexOf('export async function finaliserInvitationEnAttente('))
  assert.match(rejoindre, /\.eq\('empreinte', empreinteJeton\(jeton\)\)/)
  assert.match(rejoindre, /email: invitation\.email/)
  assert.doesNotMatch(rejoindre, /email: donnees\.get\('email'\)/)
})

test('Find : un refus de mise à jour du consentement ne donne pas un faux succès', async () => {
  const source = await lire('src/lib/actions/candidatures.ts')
  const profil = source.slice(source.indexOf('export async function enregistrerProfilCandidat('), source.indexOf('export async function envoyerCandidature('))
  assert.match(profil, /\.select\('id'\)\s*\.maybeSingle\(\)/)
  assert.match(profil, /if \(erreurWhatsApp \|\| !profilMisAJour\) return/)
})

test('Pro/Find : le texte des candidatures reflète la mise en file des réponses', async () => {
  const page = await lire('src/app/pro/(shell)/annonces/[id]/candidatures/page.tsx')
  const migration = await lire('supabase/migrations/20260920000200_notifications_whatsapp.sql')
  assert.match(migration, /'candidature_' \|\| v_evenement/)
  assert.match(page, /email de réponse est mis en file/)
  assert.doesNotMatch(page, /ne le prévient pas encore de votre réponse/)
})

test('Pro/Me : un PDF publié dont les octets divergent de l’empreinte SQL n’est pas servi', async () => {
  const route = await lire('src/app/api/quittances/[id]/pdf/route.ts')
  assert.match(route, /acces\.hash && empreinte\(pdf\) !== acces\.hash/)
  assert.match(route, /Le contenu du document ne correspond pas à son empreinte/)
})

test('Pro/Find : la pagination refuse les numéros partiels, répétés et excessifs', () => {
  assert.equal(lireNumeroPage(undefined), 1)
  assert.equal(lireNumeroPage('2'), 2)
  assert.equal(lireNumeroPage('1000'), 1000)
  for (const invalide of ['0', '02', '2abc', '1001', '99999999999999', ['2', '3']]) {
    assert.equal(lireNumeroPage(invalide), null)
  }
})
