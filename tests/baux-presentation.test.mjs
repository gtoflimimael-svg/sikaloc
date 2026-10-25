import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  formaterDateBail,
  normaliserFiltreBail,
} from '../src/lib/baux-presentation.ts'

test('les filtres acceptent uniquement les statuts du modèle', () => {
  assert.equal(normaliserFiltreBail('Actif'), 'Actif')
  assert.equal(normaliserFiltreBail('Résilié'), 'Résilié')
  assert.equal(normaliserFiltreBail(undefined), null)
  assert.equal(normaliserFiltreBail('Terminé'), null)
  assert.equal(normaliserFiltreBail('inconnu'), null)
})

test('la date de début est compacte et conserve la date civile', () => {
  assert.equal(formaterDateBail('2026-10-24'), '24 oct. 2026')
  assert.equal(formaterDateBail('2026-01-01'), '1er janv. 2026')
  assert.equal(formaterDateBail('2024-02-29'), '29 févr. 2024')
  assert.equal(formaterDateBail('2026-02-30'), null)
  assert.equal(formaterDateBail(undefined), null)
})

test('la liste reste centrée sur le logement et ne charge que les informations utiles', async () => {
  const page = await readFile(new URL('../src/app/pro/(shell)/baux/page.tsx', import.meta.url), 'utf8')

  assert.match(page, /bailleurOnboarde\(\)/)
  assert.match(page, /creerClientServeur\(\)/)
  assert.match(page, /id, statut, date_debut, loyer_mensuel, logement:logements\(id, adresse, ville, type\), locataire:locataires\(id, nom\)/)
  assert.match(page, /normaliserFiltreBail/)
  assert.match(page, /href=\{`\/pro\/baux\/\$\{bail\.id\}`\}/)
  assert.match(page, /Voir le bail/)
  assert.match(page, /Nouveau bail/)
  assert.match(page, /aria-current=\{actif \? 'page' : undefined\}/)
  assert.doesNotMatch(page, /jour_echeance|tolerance_jours|ResumeListe|échéance|tolérance|contrat qui relie/)
  assert.equal((page.match(/href="\/pro\/baux\/nouveau"/g) ?? []).length, 1)
})
