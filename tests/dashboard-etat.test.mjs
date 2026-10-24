import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compterEtapesConfigurees,
  determinerActionPrincipaleDemarrage,
  determinerEtatDashboardPro,
  peutCreerBail,
} from '../src/lib/dashboard/etat.ts'

test('un bailleur sans logement voit l’état de démarrage', () => {
  assert.equal(determinerEtatDashboardPro(0, 0), 'demarrage')
})

test('un bailleur avec logement mais sans bail voit l’état intermédiaire', () => {
  assert.equal(determinerEtatDashboardPro(1, 0), 'intermediaire')
})

test('tout bail enregistré conserve le dashboard opérationnel, y compris historique', () => {
  assert.equal(determinerEtatDashboardPro(1, 1), 'operationnel')
  assert.equal(determinerEtatDashboardPro(0, 1), 'operationnel')
})

test('la progression compte les entités enregistrées, jamais les clics', () => {
  assert.equal(compterEtapesConfigurees({ nbLogements: 0, nbLocataires: 0, nbBaux: 0 }), 0)
  assert.equal(compterEtapesConfigurees({ nbLogements: 1, nbLocataires: 0, nbBaux: 0 }), 1)
  assert.equal(compterEtapesConfigurees({ nbLogements: 1, nbLocataires: 1, nbBaux: 1 }), 3)
})

test('la création d’un bail est proposée seulement avec logement libre et locataire', () => {
  assert.equal(peutCreerBail({ nbLogementsLibres: 0, nbLocataires: 1 }), false)
  assert.equal(peutCreerBail({ nbLogementsLibres: 1, nbLocataires: 0 }), false)
  assert.equal(peutCreerBail({ nbLogementsLibres: 1, nbLocataires: 1 }), true)
})

test('un logement vacant sans locataire met Find en avant sans imposer de fiche locataire', () => {
  assert.equal(determinerActionPrincipaleDemarrage({ nbLogements: 0, nbLocataires: 0 }), 'logement')
  assert.equal(determinerActionPrincipaleDemarrage({ nbLogements: 1, nbLocataires: 0 }), 'find')
  assert.equal(determinerActionPrincipaleDemarrage({ nbLogements: 1, nbLocataires: 1 }), 'bail')
})
