import assert from 'node:assert/strict'
import test from 'node:test'

import { peutSupprimerBail } from '../src/lib/baux-presentation.ts'
import { peutSupprimerLocataire } from '../src/lib/locataires-presentation.ts'
import { estCorrigeable, libelleActionDocumentManquant } from '../src/lib/paiement-utils.ts'

test('la suppression d’un bail exige un historique de paiements chargé et vide', () => {
  assert.equal(peutSupprimerBail(0, true), true)
  assert.equal(peutSupprimerBail(1, true), false)
  assert.equal(peutSupprimerBail(0, false), false)
})

test('un locataire rattaché à un bail ne reçoit pas d’action de suppression', () => {
  assert.equal(peutSupprimerLocataire(0), true)
  assert.equal(peutSupprimerLocataire(1), false)
  assert.equal(peutSupprimerLocataire(3), false)
})

test('le libellé distingue un paiement à confirmer d’un document manquant', () => {
  assert.equal(libelleActionDocumentManquant('Brouillon'), 'À confirmer')
  assert.equal(libelleActionDocumentManquant('Validé'), 'Générer le document')
})

test('les actions de correction suivent la même fenêtre que la règle du paiement', () => {
  const maintenant = Date.now()
  assert.equal(estCorrigeable(new Date(maintenant - 60_000).toISOString(), 'Validé'), true)
  assert.equal(estCorrigeable(new Date(maintenant - 6 * 60_000).toISOString(), 'Validé'), false)
  assert.equal(estCorrigeable(null, 'Brouillon'), true)
})
