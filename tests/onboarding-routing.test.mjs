import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  destinationApresConnexion,
  destinationApresVerification,
  ESPACE_ME,
  ESPACE_PRO,
  CANDIDATURES,
} from '../src/lib/roles.ts'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

const bailleurSeul = { estBailleur: true, estLocataire: false, estCandidat: false }

test('un bailleur confirmé entre directement dans Pro, quel que soit son marqueur historique', () => {
  assert.equal(destinationApresVerification(bailleurSeul), ESPACE_PRO.tableauDeBord)
  assert.equal(destinationApresConnexion(bailleurSeul), ESPACE_PRO.tableauDeBord)
})

test('les comptes à rôles multiples, locataires et candidats conservent leur aiguillage', () => {
  assert.equal(
    destinationApresVerification(
      { estBailleur: true, estLocataire: true, estCandidat: false },
    ),
    '/entrer',
  )
  assert.equal(
    destinationApresVerification(
      { estBailleur: false, estLocataire: true, estCandidat: false },
    ),
    ESPACE_ME.tableauDeBord,
  )
  assert.equal(
    destinationApresVerification(
      { estBailleur: false, estLocataire: false, estCandidat: true },
    ),
    CANDIDATURES,
  )
})

test('le shell authentifie avant les requêtes et le guide ne s’ouvre que sur le tableau de bord', async () => {
  const shell = await lire('src/app/pro/(shell)/layout.tsx')
  const garde = shell.indexOf('const bailleur = await bailleurOnboarde()')
  const requete = shell.indexOf(".from('v_impayes')")
  const rendu = shell.indexOf('return (')
  const guide = shell.indexOf('<VisiteGuidee')

  assert.ok(garde >= 0)
  assert.ok(garde < requete)
  assert.ok(requete < rendu)
  assert.ok(rendu < guide)
  assert.doesNotMatch(shell, /bailleurCourant\(\)/)
  const session = await lire('src/lib/session.ts')
  const debut = session.indexOf('export async function bailleurOnboarde()')
  const fin = session.indexOf('export async function bailleurAvecEcriture()', debut)
  assert.match(session.slice(debut, fin), /return bailleurCourant\(\)/)
  assert.doesNotMatch(session.slice(debut, fin), /onboarding_termine|\/pro\/onboarding/)

  const bienvenue = await lire('src/app/verification/reussie/page.tsx')
  assert.doesNotMatch(bienvenue, /VisiteGuidee/)
  const visite = await lire('src/components/app/visite-guidee.tsx')
  assert.match(visite, /chemin === '\/pro\/tableau-de-bord'[\s\S]*?ouvertAuDemarrage \|\| rejeuDemande/)
})

test('la page de vérification ne dépend plus du marqueur historique et redirige vers la destination du rôle', async () => {
  const verification = await lire('src/app/verification/page.tsx')
  assert.doesNotMatch(verification, /onboarding_termine/)
  assert.match(verification, /redirect\(destination\)/)
  assert.doesNotMatch(verification, /Accéder à Sikaloc/)
})

test('l’ancienne route onboarding reste protégée et renvoie tous les bailleurs au tableau de bord', async () => {
  const onboarding = await lire('src/app/pro/onboarding/page.tsx')
  assert.match(onboarding, /await bailleurCourant\(\)/)
  assert.match(onboarding, /redirect\(ESPACE_PRO\.tableauDeBord\)/)
  assert.doesNotMatch(onboarding, /onboarding_termine|AssistantOnboarding/)
})

test('les accès directs au dashboard restent gardés même si une page opérationnelle change', async () => {
  const dashboard = await lire('src/app/pro/(shell)/tableau-de-bord/page.tsx')
  assert.match(dashboard, /bailleurOnboarde\(\)/)
})

test('la page publique Pro envoie les bailleurs vérifiés directement au tableau de bord', async () => {
  const pro = await lire('src/app/pro/page.tsx')
  assert.match(pro, /redirect\(ESPACE_PRO\.tableauDeBord\)/)
  assert.doesNotMatch(pro, /onboarding_termine|\/pro\/onboarding/)
})
