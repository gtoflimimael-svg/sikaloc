import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { normaliserTelephone } from '../src/lib/telephone.ts'

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

test('Pro/Me : un PDF publié dont les octets divergent de l’empreinte SQL n’est pas servi', async () => {
  const route = await lire('src/app/api/quittances/[id]/pdf/route.ts')
  assert.match(route, /acces\.hash && empreinte\(pdf\) !== acces\.hash/)
  assert.match(route, /Le contenu du document ne correspond pas à son empreinte/)
})

test('Me : un téléphone absent ne devient pas un lien d’appel', async () => {
  assert.equal(normaliserTelephone('Non renseigné'), null)
  assert.equal(normaliserTelephone(''), null)
  assert.equal(normaliserTelephone('+2290190459821'), '+2290190459821')
  for (const chemin of ['src/app/me/(espace)/page.tsx', 'src/app/me/(espace)/bail/page.tsx']) {
    const source = await lire(chemin)
    assert.match(source, /normaliserTelephone\(bail\.bailleur_telephone\)/)
    assert.doesNotMatch(source, /href=\{`tel:\$\{bail\.bailleur_telephone\}`\}/)
  }
})
