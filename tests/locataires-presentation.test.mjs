import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  peutSupprimerLocataire,
  presenterAccesMe as calculerAccesMe,
  presenterSituationLocative,
} from '../src/lib/locataires-presentation.ts'

const presenterAccesMe = (options) => calculerAccesMe({ delaiRenvoiSecondes: 120, ...options })

const invitation = (changements = {}) => ({
  cree_le: '2026-10-24T00:00:00.000Z',
  expire_le: '2026-11-01T00:00:00.000Z',
  utilisee_le: null,
  annulee_le: null,
  ...changements,
})

test('l’accès Me actif dépend du rattachement réel, jamais de la seule invitation', () => {
  assert.deepEqual(
    presenterAccesMe({ compteLie: true, invitation: invitation(), emailDisponible: true }),
    { libelle: 'Accès Me actif', ton: 'positive', action: null, emailRequis: false, renvoiTemporise: false },
  )
  assert.equal(
    presenterAccesMe({ compteLie: false, invitation: invitation(), emailDisponible: true, maintenant: Date.parse('2026-10-25T00:00:00Z') }).libelle,
    'Invitation en attente',
  )
})

test('l’envoi et le renvoi reflètent les états réels et exigent une adresse', () => {
  assert.deepEqual(
    presenterAccesMe({ compteLie: false, invitation: null, emailDisponible: true }),
    { libelle: 'Non invité', ton: 'neutral', action: 'inviter', emailRequis: false, renvoiTemporise: false },
  )
  assert.equal(
    presenterAccesMe({ compteLie: false, invitation: null, emailDisponible: false }).libelle,
    'E-mail requis pour Me',
  )
  assert.equal(
    presenterAccesMe({ compteLie: false, invitation: invitation(), emailDisponible: true, maintenant: Date.parse('2026-10-25T00:00:00Z') }).action,
    'renvoyer',
  )
  const invitationRecente = invitation({ cree_le: '2026-10-25T00:00:30.000Z' })
  const enDelai = presenterAccesMe({
    compteLie: false,
    invitation: invitationRecente,
    emailDisponible: true,
    maintenant: Date.parse('2026-10-25T00:01:00Z'),
  })
  assert.equal(enDelai.action, null)
  assert.equal(enDelai.renvoiTemporise, true)
  const expiration = invitation({ expire_le: '2026-10-20T00:00:00.000Z' })
  assert.equal(
    presenterAccesMe({ compteLie: false, invitation: expiration, emailDisponible: true, maintenant: Date.parse('2026-10-25T00:00:00Z') }).libelle,
    'Invitation expirée',
  )
  assert.equal(
    presenterAccesMe({ compteLie: false, invitation: expiration, emailDisponible: false, maintenant: Date.parse('2026-10-25T00:00:00Z') }).action,
    null,
  )
})

test('annulation, rattachement incohérent et erreur de lecture ne permettent pas une action risquée', () => {
  const annulee = invitation({ annulee_le: '2026-10-24T00:00:00.000Z' })
  assert.equal(
    presenterAccesMe({ compteLie: false, invitation: annulee, emailDisponible: true }).action,
    'inviter',
  )
  const utilisee = invitation({ utilisee_le: '2026-10-24T00:00:00.000Z' })
  assert.equal(
    presenterAccesMe({ compteLie: false, invitation: utilisee, emailDisponible: true }).libelle,
    'Rattachement à vérifier',
  )
  assert.equal(
    presenterAccesMe({ compteLie: false, invitation: null, erreurChargement: true, emailDisponible: true }).action,
    null,
  )
  assert.equal(
    presenterAccesMe({ compteLie: false, invitation: invitation({ expire_le: 'date invalide' }), emailDisponible: true }).libelle,
    'Statut Me indisponible',
  )
})

test('la situation locative distingue absence de bail, bail actif et historique résilié', () => {
  assert.equal(presenterSituationLocative([]), 'Sans bail')
  assert.equal(presenterSituationLocative([{ statut: 'Actif' }]), '1 bail actif')
  assert.equal(presenterSituationLocative([{ statut: 'Actif' }, { statut: 'Actif' }]), '2 baux actifs')
  assert.equal(presenterSituationLocative([{ statut: 'Résilié' }]), '1 bail résilié')
  assert.equal(presenterSituationLocative([{ statut: 'Inconnu' }]), 'Bail à vérifier')
})

test('la suppression reste réservée aux fiches sans bail associé', () => {
  assert.equal(peutSupprimerLocataire(0), true)
  assert.equal(peutSupprimerLocataire(1), false)
})

test('la liste minimise les données lues et l’état vide ne duplique pas l’action', async () => {
  const page = await readFile(new URL('../src/app/pro/(shell)/locataires/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /select\('id, nom, email, telephone, compte_id, baux\(id, statut\)'\)/)
  assert.match(page, /\.select\('locataire_id, expire_le, utilisee_le, annulee_le, cree_le'\)/)
  assert.match(page, /DELAI_RENVOI_SECONDES/)
  assert.match(page, /\.in\('locataire_id', liste\.map/)
  assert.doesNotMatch(page, /ResumeListe|Relations locataires|Les personnes à qui vous louez/)
  assert.match(page, /Ajoutez votre premier locataire\./)
  assert.equal((page.match(/href="\/pro\/locataires\/nouveau"/g) ?? []).length, 1)
})
