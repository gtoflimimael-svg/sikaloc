import assert from 'node:assert/strict'
import test from 'node:test'

import {
  presenterActionAnnonce,
  presenterQuotaLogements,
  peutSupprimerLogement,
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

test('une annonce existante reste gérable même si le logement est occupé', () => {
  assert.deepEqual(presenterActionAnnonce('annonce-1', 'logement-1', true), {
    href: '/pro/annonces/annonce-1',
    libelle: 'Gérer l’annonce',
  })
})

test('un logement occupé sans annonce ne reçoit pas de CTA ordinaire de mise en location', () => {
  assert.equal(presenterActionAnnonce(undefined, 'logement-1', true), null)
})

test('un logement sans bail actif ouvre le parcours réel de préparation d’annonce', () => {
  assert.deepEqual(presenterActionAnnonce(undefined, 'logement-1', false), {
    href: '/pro/annonces/nouvelle?logement=logement-1',
    libelle: 'Préparer une annonce',
  })
  assert.deepEqual(presenterActionAnnonce(undefined, 'logement-2', false), {
    href: '/pro/annonces/nouvelle?logement=logement-2',
    libelle: 'Préparer une annonce',
  })
})

test('présente le plan effectif et le quota sans inventer une limite Standard', () => {
  assert.equal(presenterQuotaLogements('Gratuit', 0, 2), 'Plan Gratuit · 0 sur 2 logements')
  assert.equal(presenterQuotaLogements('Gratuit', 1, 2), 'Plan Gratuit · 1 logement sur 2')
  assert.equal(presenterQuotaLogements('Gratuit', 2, 2), 'Plan Gratuit · 2 logements sur 2')
  assert.equal(presenterQuotaLogements('Standard', 3, null), 'Plan Standard · 3 logements')
})

test('ne propose la suppression que lorsque les relations connues ne la bloquent pas', () => {
  assert.equal(peutSupprimerLogement(0, false), true)
  assert.equal(peutSupprimerLogement(1, false), false)
  assert.equal(peutSupprimerLogement(0, true), false)
})
