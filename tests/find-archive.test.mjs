import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

import { accesAutorise, destinationApresConnexion, ESPACE_ME, ESPACE_PRO } from '../src/lib/roles.ts'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

test('les routes Find, annonces Pro, candidatures et photos applicatives sont archivées', async () => {
  const retirees = [
    'src/app/find/page.tsx',
    'src/app/find/[reference]/page.tsx',
    'src/app/find/[reference]/candidater/page.tsx',
    'src/app/me/candidatures/page.tsx',
    'src/app/pro/(shell)/annonces/page.tsx',
    'src/app/pro/(shell)/annonces/nouvelle/page.tsx',
    'src/app/pro/(shell)/annonces/[id]/page.tsx',
    'src/app/pro/(shell)/annonces/[id]/candidatures/page.tsx',
    'src/app/api/annonces/photos/[id]/route.ts',
  ]
  await Promise.all(retirees.map(async (chemin) => {
    await assert.rejects(access(new URL(chemin, racine)), { code: 'ENOENT' }, chemin)
  }))
})

test('les espaces publics et Pro ne proposent plus Find ni les annonces', async () => {
  const [accueil, pied, menuMobile, connexion, verification, navigation, logements, sitemap, cron] = await Promise.all([
    lire('src/app/page.tsx'),
    lire('src/components/marketing/pied-de-page.tsx'),
    lire('src/components/marketing/menu-mobile.tsx'),
    lire('src/app/connexion/page.tsx'),
    lire('src/app/verification/page.tsx'),
    lire('src/components/app/navigation.tsx'),
    lire('src/app/pro/(shell)/logements/page.tsx'),
    lire('src/app/sitemap.ts'),
    lire('src/app/api/cron/notifications/route.ts'),
  ])
  for (const source of [accueil, pied, menuMobile, connexion, verification, navigation, logements, sitemap]) {
    assert.doesNotMatch(source, /\/find|\/pro\/annonces|\/me\/candidatures/)
  }
  assert.doesNotMatch(navigation, /Annonces|Commercialisation/)
  assert.doesNotMatch(logements, /Créer une annonce|Préparer une annonce|Gérer l’annonce/)
  assert.doesNotMatch(cron, /notifications_candidature|notifications_whatsapp|whatsAppOperationnel/)
  assert.match(cron, /emails_a_envoyer/)
})

test('les comptes candidat historiques ne reçoivent aucun accès Pro ou Me', async () => {
  const candidat = { estBailleur: false, estLocataire: false, estCandidat: true }
  assert.equal(destinationApresConnexion(candidat), '/')
  assert.equal(accesAutorise(candidat, ESPACE_PRO), false)
  assert.equal(accesAutorise(candidat, ESPACE_ME), false)
  const contexte = await lire('src/lib/auth-contexte.ts')
  assert.match(contexte, /type ContexteConnexion = 'pro' \| 'me' \| 'general'/)
  assert.match(contexte, /chemin === '\/find' \|\| chemin\.startsWith\('\/find\/'\)/)
  assert.match(contexte, /chemin === '\/me\/candidatures' \|\| chemin\.startsWith\('\/me\/candidatures\/'\)/)
})

test('les espaces Pro et Me ainsi que les objets SQL historiques restent présents', async () => {
  const [, , , , , , typesDb] = await Promise.all([
    access(new URL('src/app/pro/(shell)/logements/page.tsx', racine)),
    access(new URL('src/app/pro/(shell)/locataires/page.tsx', racine)),
    access(new URL('src/app/pro/(shell)/baux/page.tsx', racine)),
    access(new URL('src/app/pro/(shell)/paiements/page.tsx', racine)),
    access(new URL('src/app/pro/(shell)/quittances/[id]/page.tsx', racine)),
    access(new URL('src/app/me/(espace)/page.tsx', racine)),
    lire('src/lib/types/database.ts'),
  ])
  assert.match(typesDb, /annonces:/)
  assert.match(typesDb, /candidatures:/)
  assert.equal(ESPACE_PRO.role, 'bailleur')
  assert.equal(ESPACE_ME.role, 'locataire')
})
