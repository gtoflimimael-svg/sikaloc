import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { parAnnee } from '../src/lib/echeances.ts'
import {
  apercuDocumentPaiement,
  apercuQuittanceFinance,
  etatPaiementFinance,
  typeDocumentPaiement,
} from '../src/lib/documents-paiement.ts'
import { verifierConditionsPremierLoyer } from '../src/lib/premier-loyer.ts'

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

test('les tarifs mensuels sont historisés sans inventer un tarif avant la période connue', () => {
  assert.match(migration, /create table if not exists public\.baux_loyers/)
  assert.match(migration, /primary key \(bail_id, periode_debut\)/)
  assert.match(migration, /check \(loyer_mensuel > 0\)/)
  assert.match(migration, /date_trunc\('month', current_date::timestamp\) \+ interval '1 month'/)
  assert.match(migration, /greatest\([\s\S]*date_trunc\('month', b\.date_debut::timestamp\)::date[\s\S]*date_trunc\('month', current_date::timestamp\)[\s\S]*interval '1 month'/)
  assert.match(migration, /b\.statut = 'Actif'::public\.statut_bail/)
  assert.doesNotMatch(migration, /coalesce\(tarif\.loyer_mensuel, b\.loyer_mensuel\)/)
  assert.match(migration, /do update set loyer_mensuel = excluded\.loyer_mensuel/)
  assert.match(migration, /p\.periode_debut = v_periode[\s\S]*p\.type_paiement = 'Loyer'/)
})

test('le premier loyer exige des conditions explicites et ne crée pas de dette rétrospective', () => {
  assert.match(migration, /premier_loyer_montant numeric/)
  assert.match(migration, /premier_loyer_du_le date/)
  assert.match(migration, /grant insert \(premier_loyer_montant, premier_loyer_du_le\)[\s\S]*to authenticated/)
  assert.match(migration, /grant update \(premier_loyer_montant, premier_loyer_du_le\)[\s\S]*to authenticated/)
  assert.match(migration, /premier_loyer_du_le >= date_debut/)
  assert.match(migration, /when p\.periode_debut = p\.premiere_periode[\s\S]*then p\.premier_loyer_du_le/)
  assert.match(migration, /when p\.periode_debut = p\.premiere_periode[\s\S]*then p\.premier_loyer_montant/)
  assert.match(migration, /when e\.montant_exigible is null or e\.date_echeance is null then 'À déterminer'/)
  assert.match(migration, /case when e\.montant_exigible is null then null[\s\S]*as montant_du/)
  assert.match(migration, /case when e\.montant_exigible is null or e\.date_echeance is null then null[\s\S]*as jours_de_retard/)
  assert.doesNotMatch(migration, /premier_loyer_montant\s*=\s*loyer_mensuel\s*\/|premier_loyer_montant\s*=\s*loyer_mensuel\s*\*/)
})

test('saisie du premier loyer accepte uniquement les conditions contractuelles explicites', () => {
  const cas = (dateDebut, montant, exigibleLe) =>
    verifierConditionsPremierLoyer({ dateDebut, montant, exigibleLe })

  assert.deepEqual(cas('2026-10-01', 100000, '2026-10-01'), {
    etat: 'valide', montant: 100000, exigibleLe: '2026-10-01',
  })
  assert.equal(cas('2026-10-01', 100000, '2026-10-05').etat, 'valide') // bail avant l’échéance habituelle
  assert.equal(cas('2026-10-05', 100000, '2026-10-05').etat, 'valide') // bail à l’échéance
  assert.equal(cas('2026-10-20', 100000, '2026-11-05').etat, 'valide') // bail après l’échéance, date contractuelle ultérieure
  assert.equal(cas('2026-10-20', 40000, '2026-10-20').etat, 'valide') // prorata saisi, non calculé
  assert.equal(cas('2026-10-20', 100000, '2026-10-05').etat, 'date_avant_debut')
  assert.equal(cas('2026-10-20', 100000, '2026-02-30').etat, 'date_invalide')
  assert.equal(cas('2026-10-20', undefined, undefined).etat, 'indetermine')
  assert.equal(cas('2026-10-20', 100000, undefined).etat, 'incomplet')
  assert.equal(cas('2026-10-20', -1, '2026-10-20').etat, 'montant_invalide')
})

test('les échéances utilisent le tarif prouvé et ne produisent jamais un solde négatif', () => {
  assert.match(migration, /h\.periode_debut <= serie::date[\s\S]*order by h\.periode_debut desc/)
  assert.match(migration, /greatest\(0, e\.montant_exigible - coalesce\(regle\.montant_paye, 0\)\)/)
  assert.match(migration, /greatest\(0, coalesce\(regle\.montant_paye, 0\) - e\.montant_exigible\)/)
  assert.match(migration, /pa\.type_paiement = 'Loyer'::public\.type_paiement[\s\S]*pa\.periode_debut = e\.periode_debut/)
})

test('les paiements fractionnés et leurs documents utilisent le tarif de la période', () => {
  assert.equal((migration.match(/prive\.loyer_bail_pour_periode\(/g) ?? []).length >= 3, true)
  assert.match(migration, /x\.valide_le <= p_date_reference/)
  assert.match(migration, /'trop_percu', case when p\.type_paiement = 'Loyer'::public\.type_paiement[\s\S]*cumul - v_montant_exigible/)
  assert.match(migration, /alter table public\.paiements alter column est_partiel drop not null/)
  assert.match(migration, /when v_loyer is null then null else v_cumul \+ p_montant < v_loyer end/)
})

test('charges et dépôt donnent toujours un reçu, jamais une quittance de loyer', () => {
  assert.equal(typeDocumentPaiement('Loyer', false), 'Quittance')
  assert.equal(typeDocumentPaiement('Loyer', true), 'Reçu')
  assert.equal(typeDocumentPaiement('Charges', false), 'Reçu')
  assert.equal(typeDocumentPaiement('Dépôt de garantie', false), 'Reçu')
  assert.equal(typeDocumentPaiement('Loyer', null), 'Reçu')
  assert.match(migration, /v_type <> 'Loyer'::public\.type_paiement[\s\S]*new\.donnees_financieres->>'est_partiel' is distinct from 'false'[\s\S]*new\.type := 'Reçu'/)
  assert.match(migration, /update of paiement_id, type, donnees_financieres on public\.quittances/)
  assert.match(migration, /case when q\.donnees_financieres \? 'est_partiel'[\s\S]*else p\.est_partiel end/)
  assert.match(confirmation, /apercuDocumentPaiement\(/)
  assert.match(confirmation, /ne constitue pas une quittance de loyer/)
  assert.match(pdf, /estLoyer && donnees\.type === 'Reçu'/)
  assert.match(pdf, /'Reçu de paiement'/)
  assert.match(pdf, /n'atteste pas le règlement intégral de la période/)
  assert.match(pdf, /montant exigible de cette période n’est pas déterminé/)
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

test('le snapshot publié prévaut sur est_partiel historique contradictoire', () => {
  assert.equal(etatPaiementFinance({
    statut: 'Validé', typePaiement: 'Loyer', estPartiel: false,
    finances: { est_partiel: true, solde_restant: 1000 },
  }), 'Partiel')
  assert.equal(etatPaiementFinance({
    statut: 'Validé', typePaiement: 'Loyer', estPartiel: false,
    finances: { est_partiel: null, solde_restant: null },
  }), 'À déterminer')
  assert.equal(etatPaiementFinance({
    statut: 'Validé', typePaiement: 'Loyer', estPartiel: true,
    finances: { est_partiel: false },
  }), 'Payé')
  assert.equal(etatPaiementFinance({
    statut: 'Brouillon', typePaiement: 'Loyer', estPartiel: null,
  }), 'Brouillon')
})

test('un montant exigible inconnu permet seulement un reçu, sans solde inventé', () => {
  assert.deepEqual(apercuDocumentPaiement({
    typePaiement: 'Loyer', montant: 99000, loyerApplicable: null, cumulValideAvant: 0,
  }), { cumul: 99000, solde: null, estPartiel: null, typeDocument: 'Reçu' })
  assert.deepEqual(apercuDocumentPaiement({
    typePaiement: 'Loyer', montant: 99000, loyerApplicable: 100000, cumulValideAvant: 0,
  }), { cumul: 99000, solde: 1000, estPartiel: true, typeDocument: 'Reçu' })
  assert.deepEqual(apercuDocumentPaiement({
    typePaiement: 'Loyer', montant: 50000, loyerApplicable: 100000, cumulValideAvant: 50000,
  }), { cumul: 100000, solde: 0, estPartiel: false, typeDocument: 'Quittance' })
  assert.deepEqual(apercuDocumentPaiement({
    typePaiement: 'Loyer', montant: 20000, loyerApplicable: 100000, cumulValideAvant: 90000,
  }), { cumul: 110000, solde: 0, estPartiel: false, typeDocument: 'Quittance' })
})

test('la confirmation ne propose la modification que pendant la fenêtre autorisée', async () => {
  const confirmation = await readFile(
    new URL('src/app/pro/(shell)/paiements/[id]/confirmer/page.tsx', racine),
    'utf8',
  )
  assert.match(
    confirmation,
    /actionsCorrectionDisponibles \? `\/pro\/paiements\/\$\{paiement\.id\}\/modifier` : '\/pro\/paiements'/,
  )
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
  assert.match(confirmation, /Le montant exigible de cette période n’est pas disponible dans l’aperçu/)
  assert.match(confirmation, /select\('montant_exigible, montant_paye'\)/)
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
  assert.deepEqual(inconnu, { cumul: null, solde: null, estPartiel: null, typeDocument: 'Reçu' })

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
