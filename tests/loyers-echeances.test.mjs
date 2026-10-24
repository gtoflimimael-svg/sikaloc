import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { parAnnee } from '../src/lib/echeances.ts'
import {
  apercuDocumentPaiement,
  apercuQuittanceFinance,
  typeDocumentPaiement,
} from '../src/lib/documents-paiement.ts'

const racine = new URL('../', import.meta.url)
const migration = await readFile(
  new URL('supabase/migrations/20261020185126_fiabiliser_loyers_echeances.sql', racine),
  'utf8',
)
const pdf = await readFile(new URL('src/lib/pdf/document-quittance.tsx', racine), 'utf8')
const confirmation = await readFile(
  new URL('src/app/pro/(shell)/paiements/[id]/confirmer/page.tsx', racine),
  'utf8',
)

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
  assert.match(confirmation, /apercuDocumentPaiement\(/)
  assert.match(confirmation, /ne constitue pas une quittance de loyer/)
  assert.match(pdf, /estLoyer && donnees\.type === 'Reçu'/)
  assert.match(pdf, /'Reçu de paiement'/)
  assert.match(pdf, /n'atteste pas le règlement intégral de la période/)
  assert.match(pdf, /au titre de \$\{donnees\.typePaiement\.toLowerCase\(\)\}/)
})

test('l’aperçu d’une quittance préfère le snapshot et ne confond pas charges/dépôt avec un loyer', () => {
  assert.deepEqual(
    apercuQuittanceFinance({
      typePaiementPaiement: 'Loyer',
      montantPaiement: 50000,
      finances: { type_paiement: 'Loyer', montant: 30000, loyer_mensuel: 100000 },
    }),
    { typePaiement: 'Loyer', montant: 30000, loyerMensuel: 100000 },
  )

  assert.deepEqual(
    apercuQuittanceFinance({
      typePaiementPaiement: 'Charges',
      montantPaiement: 12000,
      finances: { type_paiement: 'Charges', montant: 12000, loyer_mensuel: 100000 },
    }),
    { typePaiement: 'Charges', montant: 12000, loyerMensuel: null },
  )

  assert.deepEqual(
    apercuQuittanceFinance({
      typePaiementPaiement: 'Dépôt de garantie',
      montantPaiement: 90000,
      finances: null,
    }),
    { typePaiement: 'Dépôt de garantie', montant: 90000, loyerMensuel: null },
  )
})

test('le retour « modifier la saisie » rouvre le paiement concerné, sans en créer un autre', async () => {
  const confirmation = await readFile(
    new URL('src/app/pro/(shell)/paiements/[id]/confirmer/page.tsx', racine),
    'utf8',
  )
  assert.match(confirmation, /href=\{`\/pro\/paiements\/\$\{paiement\.id\}\/modifier`\}/)
})

test('l’aperçu de quittance utilise la lecture SQL autorisée et les données figées', async () => {
  const quittancePage = await readFile(
    new URL('src/app/pro/(shell)/quittances/[id]/page.tsx', racine),
    'utf8',
  )
  assert.match(quittancePage, /obtenirDocumentAutorise\(id\)/)
  assert.match(quittancePage, /contexte\?\.finances/)
  assert.match(quittancePage, /finances\.typePaiement === 'Charges'/)
  assert.doesNotMatch(quittancePage, /definition=\{formaterFCFA\(bail\?\.loyer_mensuel/)
})

test('l’export annonce les baux et les loyers historiques réellement conservés', async () => {
  const exportSource = await readFile(new URL('src/lib/export.ts', racine), 'utf8')
  const pageDonnees = await readFile(
    new URL('src/app/pro/(shell)/parametres/donnees/page.tsx', racine),
    'utf8',
  )
  assert.match(exportSource, /fichiers\['baux\.csv'\]/)
  assert.match(exportSource, /fichiers\['loyers-historiques\.csv'\]/)
  assert.match(exportSource, /identifiantsBaux/)
  assert.match(pageDonnees, /loyers historiques disponibles/)
  assert.match(pageDonnees, /ne peuvent pas\s+être reconstruits/)
})

test('l’aperçu de confirmation prend le loyer historisé et ne devine pas si la donnée manque', () => {
  assert.match(confirmation, /\.from\('v_echeances'\)[\s\S]*\.eq\('periode_debut', paiement\.periode_debut\)/)
  assert.match(confirmation, /Le loyer historique de cette période n’est pas disponible dans l’aperçu/)
  assert.match(confirmation, /paiementDejaValide \? 'Générer le document' : 'Confirmer et générer le document'/)
  assert.match(confirmation, /Le paiement déjà validé est de/)

  const historiquePartiel = apercuDocumentPaiement({
    typePaiement: 'Loyer',
    montant: 30000,
    loyerApplicable: 60000,
    cumulValideAvant: 20000,
  })
  assert.deepEqual(historiquePartiel, {
    cumul: 50000,
    solde: 10000,
    estPartiel: true,
    typeDocument: 'Reçu',
  })

  const historiqueSolde = apercuDocumentPaiement({
    typePaiement: 'Loyer',
    montant: 30000,
    loyerApplicable: 50000,
    cumulValideAvant: 20000,
  })
  assert.equal(historiqueSolde.typeDocument, 'Quittance')
  assert.equal(historiqueSolde.solde, 0)

  const inconnu = apercuDocumentPaiement({
    typePaiement: 'Loyer',
    montant: 30000,
    loyerApplicable: null,
    cumulValideAvant: null,
  })
  assert.equal(inconnu.typeDocument, null)

  const loyerInvalide = apercuDocumentPaiement({
    typePaiement: 'Loyer',
    montant: Number.NaN,
    loyerApplicable: 50000,
    cumulValideAvant: 0,
  })
  assert.deepEqual(loyerInvalide, {
    cumul: null,
    solde: null,
    estPartiel: null,
    typeDocument: null,
  })

  const depot = apercuDocumentPaiement({
    typePaiement: 'Dépôt de garantie',
    montant: 80000,
    loyerApplicable: null,
    cumulValideAvant: null,
  })
  assert.equal(depot.typeDocument, 'Reçu')
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
