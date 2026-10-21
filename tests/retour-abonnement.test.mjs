import assert from 'node:assert/strict'
import { test } from 'node:test'
import { etatSansTransaction, retourAbonnementConfirme } from '../src/lib/retour-abonnement.ts'

test('un retour sans transaction ne prouve pas le règlement, même avec un plan actif', () => {
  const etat = etatSansTransaction()
  assert.equal(etat, 'inconnu')
  assert.equal(retourAbonnementConfirme(etat, true), false)
})

test('seul un crédit confirmé ou déjà réglé avec plan actif affiche une confirmation', () => {
  assert.equal(retourAbonnementConfirme('credite', false), true)
  assert.equal(retourAbonnementConfirme('deja_regle', true), true)
  assert.equal(retourAbonnementConfirme('deja_regle', false), false)
  for (const etat of ['en_attente', 'echec', 'inconnu', 'indisponible', 'a_reconcilier']) {
    assert.equal(retourAbonnementConfirme(etat, true), false, etat)
  }
})
