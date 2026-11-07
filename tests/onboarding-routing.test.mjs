import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  destinationApresVerification,
  ESPACE_ME,
  ESPACE_PRO,
  CANDIDATURES,
} from '../src/lib/roles.ts'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

const bailleurSeul = { estBailleur: true, estLocataire: false, estCandidat: false }

test('un bailleur confirmé dont l’onboarding est incomplet arrive directement à l’onboarding', () => {
  assert.equal(destinationApresVerification(bailleurSeul, false), '/pro/onboarding')
})

test('un bailleur déjà onboardé arrive directement au tableau de bord', () => {
  assert.equal(destinationApresVerification(bailleurSeul, true), ESPACE_PRO.tableauDeBord)
})

test('si le statut de profil est inconnu, la destination reste sûre et le shell protège le rendu', () => {
  assert.equal(destinationApresVerification(bailleurSeul, null), ESPACE_PRO.tableauDeBord)
})

test('les comptes à rôles multiples, locataires et candidats conservent leur aiguillage', () => {
  assert.equal(
    destinationApresVerification(
      { estBailleur: true, estLocataire: true, estCandidat: false },
      false,
    ),
    '/entrer',
  )
  assert.equal(
    destinationApresVerification(
      { estBailleur: false, estLocataire: true, estCandidat: false },
      null,
    ),
    ESPACE_ME.tableauDeBord,
  )
  assert.equal(
    destinationApresVerification(
      { estBailleur: false, estLocataire: false, estCandidat: true },
      null,
    ),
    CANDIDATURES,
  )
})

test('le shell refuse un onboarding incomplet avant les requêtes, le layout visuel et le guide', async () => {
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
})

test('la page de vérification choisit la destination avec le statut serveur du bailleur', async () => {
  const verification = await lire('src/app/verification/page.tsx')
  assert.match(verification, /select\('[^']*onboarding_termine[^']*'\)/)
  assert.match(
    verification,
    /destinationApresVerification\([\s\S]*?profil\?\.onboarding_termine \?\? null/,
  )
})

test('la route onboarding reste accessible aux incomplets et renvoie les comptes terminés au dashboard', async () => {
  const onboarding = await lire('src/app/pro/onboarding/page.tsx')
  assert.match(onboarding, /const bailleur = await bailleurCourant\(\)/)
  assert.match(onboarding, /if \(bailleur\.onboarding_termine\) redirect\(ESPACE_PRO\.tableauDeBord\)/)
})

test('les accès directs au dashboard restent gardés même si une page opérationnelle change', async () => {
  const dashboard = await lire('src/app/pro/(shell)/tableau-de-bord/page.tsx')
  assert.match(dashboard, /bailleurOnboarde\(\)/)
})

test('la page publique Pro aiguille elle aussi les comptes vérifiés selon leur onboarding', async () => {
  const pro = await lire('src/app/pro/page.tsx')
  assert.match(pro, /redirect\(data\.onboarding_termine \? ESPACE_PRO\.tableauDeBord : '\/pro\/onboarding'\)/)
})
