import assert from 'node:assert/strict'
import test from 'node:test'

import {
  presenterLocalisationLogement,
  presenterQuotaLogements,
  peutSupprimerLogement,
  premiereRelation,
  trouverBailActif,
} from '../src/lib/logements-presentation.ts'

test('normalise les relations Supabase objet, tableau et absence', () => {
  const bail = { id: 'bail-1' }
  assert.equal(premiereRelation(bail), bail)
  assert.equal(premiereRelation([bail]), bail)
  assert.equal(premiereRelation([]), undefined)
  assert.equal(premiereRelation(null), undefined)
})

test('un logement est occupé uniquement par un bail au statut actif', () => {
  const actif = { id: 'bail-actif', statut: 'Actif' }
  assert.equal(trouverBailActif([{ id: 'bail-termine', statut: 'Résilié' }, actif]), actif)
  assert.equal(trouverBailActif([{ id: 'bail-termine', statut: 'Résilié' }]), undefined)
  assert.equal(trouverBailActif([]), undefined)
})

test('présente le plan effectif et le quota sans inventer une limite Standard', () => {
  assert.equal(presenterQuotaLogements('Gratuit', 0, 2), 'Gratuit · 0/2 logements')
  assert.equal(presenterQuotaLogements('Gratuit', 1, 2), 'Gratuit · 1/2 logements')
  assert.equal(presenterQuotaLogements('Gratuit', 2, 2), 'Gratuit · 2/2 logements')
  assert.equal(presenterQuotaLogements('Standard', 3, null), 'Standard · 3 logements')
})

test('raccourcit la localisation au Bénin et conserve les autres pays', () => {
  assert.equal(presenterLocalisationLogement('Appartement', 'Cotonou', 'Bénin'), 'Appartement · Cotonou')
  assert.equal(presenterLocalisationLogement('Maison', 'Lomé', 'Togo'), 'Maison · Lomé, Togo')
  assert.equal(presenterLocalisationLogement('Studio', '', 'Bénin'), 'Studio')
})

test('ne propose la suppression que lorsque les relations connues ne la bloquent pas', () => {
  assert.equal(peutSupprimerLogement(0), true)
  assert.equal(peutSupprimerLogement(1), false)
})
