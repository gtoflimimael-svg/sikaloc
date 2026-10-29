import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extraire } from '../scripts/generer-objets-schema.ts'
import { OBJETS_DECLARES } from '../src/lib/schema-objets.ts'

test('l’inventaire embarqué correspond aux migrations du dépôt', () => {
  assert.deepEqual(OBJETS_DECLARES, extraire())
})

test('l’inventaire comprend les objets essentiels des migrations récentes', () => {
  for (const [categorie, nom] of [
    ['fonction', 'creer_paiement_brouillon'],
    ['fonction', 'definir_signature_locataire'],
    ['fonction', 'consommer_limite_questions'],
    ['declencheur', 'baux_tarif_initial'],
    ['politique', 'baux_loyers_lecture_proprietaire'],
  ]) {
    assert.ok(OBJETS_DECLARES.some((objet) => objet.categorie === categorie && objet.nom === nom), nom)
  }
})
