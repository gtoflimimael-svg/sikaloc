import assert from 'node:assert/strict'
import test from 'node:test'

import {
  premiereRelation,
  presenterStatutAnnonce,
  trouverAnnonceVivante,
  trouverBailActif,
} from '../src/lib/logements-presentation.ts'

test('normalise les relations Supabase objet, tableau et absence', () => {
  const bail = { id: 'bail-1' }
  assert.equal(premiereRelation(bail), bail)
  assert.equal(premiereRelation([bail]), bail)
  assert.equal(premiereRelation([]), undefined)
  assert.equal(premiereRelation(null), undefined)
})

test('ignore une annonce clôturée et conserve le statut actif réel', () => {
  const brouillon = { id: 'annonce-2', statut: 'brouillon' }
  assert.equal(
    trouverAnnonceVivante([
      { id: 'annonce-1', statut: 'cloturee' },
      brouillon,
    ]),
    brouillon,
  )
  assert.equal(trouverAnnonceVivante([{ id: 'annonce-1', statut: 'cloturee' }]), undefined)
})

test('un logement est occupé uniquement par un bail au statut actif', () => {
  const actif = { id: 'bail-actif', statut: 'Actif' }
  assert.equal(trouverBailActif([{ id: 'bail-termine', statut: 'Résilié' }, actif]), actif)
  assert.equal(trouverBailActif([{ id: 'bail-termine', statut: 'Résilié' }]), undefined)
  assert.equal(trouverBailActif([]), undefined)
})

test('présente les états d’annonce sans confondre publication et disponibilité', () => {
  assert.deepEqual(presenterStatutAnnonce('brouillon'), {
    libelle: 'Annonce en préparation',
    ton: 'neutral',
  })
  assert.deepEqual(presenterStatutAnnonce('publiee'), {
    libelle: 'Annonce publiée',
    ton: 'positive',
  })
  assert.deepEqual(presenterStatutAnnonce('suspendue'), {
    libelle: 'Annonce suspendue',
    ton: 'warning',
  })
  assert.equal(presenterStatutAnnonce('cloturee'), null)
})
