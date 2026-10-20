import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { parAnnee } from '../src/lib/echeances.ts'
import { typeDocumentPaiement } from '../src/lib/documents-paiement.ts'

const racine = new URL('../', import.meta.url)
const migration = await readFile(
  new URL('supabase/migrations/20261020185126_fiabiliser_loyers_echeances.sql', racine),
  'utf8',
)
const pdf = await readFile(new URL('src/lib/pdf/document-quittance.tsx', racine), 'utf8')

test('les échéances incluent les baux résiliés jusqu’à leur date de fin', () => {
  assert.match(migration, /where b\.statut in \('Actif'::public\.statut_bail, 'Résilié'::public\.statut_bail\)/)
  assert.match(migration, /date_trunc\('month', coalesce\(b\.date_fin, current_date\)::timestamp\)/)
})

test('les tarifs mensuels sont historisés et un changement ne réécrit pas les mois passés', () => {
  assert.match(migration, /create table if not exists public\.baux_loyers/)
  assert.match(migration, /primary key \(bail_id, periode_debut\)/)
  assert.match(migration, /check \(loyer_mensuel > 0\)/)
  assert.match(migration, /date_trunc\('month', b\.date_debut::timestamp\)::date, b\.loyer_mensuel/)
  assert.match(migration, /date_trunc\('month', current_date::timestamp\)::date/)
  assert.match(migration, /do update set loyer_mensuel = excluded\.loyer_mensuel/)
  assert.match(migration, /p\.periode_debut = v_periode[\s\S]*p\.type_paiement = 'Loyer'/)
})

test('les échéances utilisent le tarif applicable et ne produisent jamais un solde négatif', () => {
  assert.match(migration, /h\.periode_debut <= serie::date[\s\S]*order by h\.periode_debut desc/)
  assert.match(migration, /greatest\(0, e\.loyer_mensuel - coalesce\(regle\.montant_paye, 0\)\) as montant_du/)
  assert.match(migration, /greatest\(0, coalesce\(regle\.montant_paye, 0\) - e\.loyer_mensuel\) as montant_excedentaire/)
  assert.match(migration, /pa\.type_paiement = 'Loyer'::public\.type_paiement[\s\S]*pa\.periode_debut = e\.periode_debut/)
})

test('les paiements fractionnés et leurs documents utilisent le tarif de la période', () => {
  assert.equal((migration.match(/prive\.loyer_bail_pour_periode\(/g) ?? []).length >= 3, true)
  assert.match(migration, /x\.valide_le <= p_date_reference/)
  assert.match(migration, /'trop_percu', greatest\(0, cumul - v_loyer\)/)
})

test('charges et dépôt donnent toujours un reçu, jamais une quittance de loyer', () => {
  assert.equal(typeDocumentPaiement('Loyer', false), 'Quittance')
  assert.equal(typeDocumentPaiement('Loyer', true), 'Reçu')
  assert.equal(typeDocumentPaiement('Charges', false), 'Reçu')
  assert.equal(typeDocumentPaiement('Dépôt de garantie', false), 'Reçu')
  assert.match(migration, /if v_type <> 'Loyer'::public\.type_paiement then\s+new\.type := 'Reçu'/)
  assert.match(pdf, /estLoyer && donnees\.estPartiel[\s\S]*'Reçu de paiement partiel'[\s\S]*'Reçu de paiement'/)
  assert.match(pdf, /au titre de \$\{donnees\.typePaiement\.toLowerCase\(\)\}/)
})

test('le regroupement annuel ascendant et descendant partage une seule implémentation', () => {
  const lignes = [
    { periode_debut: '2025-12-01', montant: 1 },
    { periode_debut: '2026-01-01', montant: 2 },
    { periode_debut: '2025-02-01', montant: 3 },
  ]
  assert.deepEqual(parAnnee(lignes).map((g) => [g.annee, g.mois.map((m) => m.periode_debut)]), [
    ['2025', ['2025-02-01', '2025-12-01']],
    ['2026', ['2026-01-01']],
  ])
  assert.deepEqual(parAnnee(lignes, 'desc').map((g) => [g.annee, g.mois.map((m) => m.periode_debut)]), [
    ['2026', ['2026-01-01']],
    ['2025', ['2025-12-01', '2025-02-01']],
  ])
})
