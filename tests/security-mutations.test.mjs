import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const racine = new URL('../', import.meta.url)
const lire = async (chemin) => readFile(new URL(chemin, racine), 'utf8')
const migration = await lire('supabase/migrations/20261020102334_securiser_mutations_metier.sql')
const migrationSignature = await lire('supabase/migrations/20261020103659_corriger_signature_locataire.sql')
const migrationAbonnements = await lire('supabase/migrations/20261015141119_securiser_quittances_et_abonnements.sql')
const migrationCredit = await lire('supabase/migrations/20261015190840_finaliser_abonnements_fedapay_atomiquement.sql')
const migrationFinances = await lire('supabase/migrations/20261015193157_fiabiliser_paiements_fractionnes_documents.sql')
const migrationSoldeHistorique = await lire('supabase/migrations/20261020174549_corriger_solde_recu_historique.sql')
const scenarioSoldeHistorique = await lire('tests/receipt-historique-asof.integration.sql')

function corps(source, nom, suivant) {
  const debut = source.indexOf(`export async function ${nom}(`)
  assert.notEqual(debut, -1, `fonction absente: ${nom}`)
  const fin = suivant ? source.indexOf(`export async function ${suivant}(`, debut + 1) : source.length
  return source.slice(debut, fin === -1 ? source.length : fin)
}

test('les écritures directes logements, locataires et baux exigent un bailleur actif ou en grâce', () => {
  assert.match(migration, /foreach t in array array\['logements', 'locataires', 'baux'\]/)
  assert.match(migration, /create policy %I on public\.%I as restrictive for insert/i)
  assert.match(migration, /create policy %I on public\.%I as restrictive for update/i)
  assert.match(migration, /create policy %I on public\.%I as restrictive for delete/i)
  assert.match(migration, /statut_abonnement in \('actif'::public\.statut_abonnement, 'grace'::public\.statut_abonnement\)/)
  assert.match(migration, /Nouveau bail nécessairement actif/)
})

test('les paiements ne sont plus modifiables directement et les RPC dérivent l’acteur de la session', async () => {
  assert.match(migration, /revoke insert, update, delete on public\.paiements from public, anon, authenticated/i)
  for (const fn of ['creer_paiement_brouillon', 'corriger_paiement', 'supprimer_paiement', 'declarer_paiements_historiques']) {
    const debut = migration.indexOf(`function public.${fn}(`)
    assert.notEqual(debut, -1, `RPC absente: ${fn}`)
    const corpsFonction = migration.slice(debut, migration.indexOf('$$;', debut) + 3)
    assert.match(corpsFonction, /security definer/i)
    assert.match(corpsFonction, /set search_path = ''/i)
    assert.match(corpsFonction, /auth\.uid\(\)/)
    assert.doesNotMatch(corpsFonction, /p_acteur|p_bailleur/i)
    assert.match(migration.slice(migration.indexOf(`grant execute on function public.${fn}(`)), /to authenticated/i)
  }
  const actions = await lire('src/lib/actions/paiements.ts')
  assert.doesNotMatch(actions, /\.from\('paiements'\)\s*\.(?:insert|update|delete|upsert)/)
  for (const fn of ['creer_paiement_brouillon', 'corriger_paiement', 'supprimer_paiement']) {
    assert.ok(actions.includes(`rpc('${fn}'`), `l’action n’appelle pas ${fn}`)
  }
})

test('la déclaration historique appelle une RPC atomique et ne réalise plus deux écritures séparées', async () => {
  const action = await lire('src/lib/actions/historique.ts')
  assert.match(action, /rpc\('declarer_paiements_historiques'/)
  assert.doesNotMatch(action, /from\('paiements'\)\.insert/)
  assert.doesNotMatch(action, /from\('baux'\)\s*\.update/)
})

test('les statuts de bail et chemins de signature passent par des RPC à portée propriétaire', async () => {
  assert.match(migration, /revoke update \(statut\) on public\.baux from public, anon, authenticated/i)
  assert.match(migration, /revoke update \(signature_chemin\) on public\.bailleurs from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.definir_signature_bailleur\(text\) to authenticated/i)
  assert.match(migration, /grant execute on function public\.definir_signature_locataire\(uuid,text\) to authenticated/i)
  assert.match(migration, /bucket_id <> 'signatures' or exists/i)

  const baux = await lire('src/lib/actions/baux.ts')
  assert.match(baux, /rpc\('definir_statut_bail'/)
  const locataires = await lire('src/lib/actions/locataires.ts')
  assert.match(locataires, /rpc\('definir_signature_locataire'/)
  const parametres = await lire('src/lib/actions/parametres.ts')
  assert.match(parametres, /rpc\('definir_signature_bailleur'/)
  assert.doesNotMatch(locataires, /\.update\(\{\s*signature_chemin/)
  assert.doesNotMatch(parametres, /\.update\(\{\s*signature_chemin/)
})

test('le chemin de signature du locataire accepte le point littéral sans lire ni réécrire les anciennes références', () => {
  assert.match(migrationSignature, /'\[\.\]\(png\|jpe\?g\|webp\)\$'/)
  assert.match(migrationSignature, /locataires_signature_chemin_scope[\s\S]*?not valid/i)
  assert.match(migrationSignature, /where id = p_locataire_id\s+and bailleur_id = v_acteur/i)
  assert.match(migrationSignature, /security definer[\s\S]*?set search_path = ''[\s\S]*?auth\.uid\(\)/i)
})

test('toutes les Server Actions de mutation visées exigent le garde d’écriture', async () => {
  const attentes = [
    ['src/lib/actions/logements.ts', [['modifierLogement', 'supprimerLogement'], ['supprimerLogement']]],
    ['src/lib/actions/locataires.ts', [['modifierLocataire', 'supprimerLocataire'], ['supprimerLocataire'], ['televerserSignatureLocataire', 'supprimerSignatureLocataire'], ['supprimerSignatureLocataire']]],
    ['src/lib/actions/baux.ts', [['modifierBail', 'resilierBail'], ['resilierBail', 'reactiverBail'], ['reactiverBail', 'supprimerBail'], ['supprimerBail']]],
    [
      'src/lib/actions/paiements.ts',
      [
        ['enregistrerPaiement', 'validerPaiement'],
        ['validerPaiement', 'regenererQuittance'],
        ['regenererQuittance', 'corrigerPaiement'],
        ['corrigerPaiement', 'supprimerPaiement'],
        ['supprimerPaiement', 'verifierIntegrite'],
      ],
    ],
  ]
  for (const [chemin, fonctions] of attentes) {
    const source = await lire(chemin)
    for (const [nom, suivant] of fonctions) {
      assert.match(corps(source, nom, suivant), /bailleurAvecEcriture\(\)/, `${nom} doit vérifier le droit d’écriture`)
    }
  }
})

test('les champs commerciaux et les transactions ne sont pas modifiables directement par authenticated', () => {
  assert.match(migrationAbonnements, /revoke all on public\.bailleurs from public, anon, authenticated/i)
  assert.match(migrationAbonnements, /grant update \([\s\S]*?on public\.bailleurs to authenticated/i)
  const colonnesModifiables = migrationAbonnements.match(/grant update \(([\s\S]*?)\) on public\.bailleurs to authenticated/i)?.[1] ?? ''
  const nomsModifiables = colonnesModifiables.split(',').map((nom) => nom.trim())
  for (const sensible of ['plan', 'date_fin_abonnement', 'statut_abonnement', 'date_echec_paiement']) {
    assert.ok(!nomsModifiables.includes(sensible), `${sensible} ne doit pas être modifiable directement`)
    assert.ok(migrationAbonnements.includes(`has_column_privilege('authenticated','public.bailleurs','${sensible}','UPDATE')`))
  }
  assert.match(migrationAbonnements, /revoke all on public\.abonnements_transactions, public\.recompenses_parrainage from public, anon, authenticated/i)
  assert.match(migrationAbonnements, /grant select on public\.abonnements_transactions, public\.recompenses_parrainage to authenticated/i)
  assert.match(migrationCredit, /revoke all on public\.abonnements_transactions from public,anon,authenticated/i)
})

test('le crédit Standard, les récompenses et le statut REGLEE sont atomiques et idempotents', () => {
  const debut = migrationCredit.indexOf('create function public.finaliser_abonnement_fedapay(')
  const fin = migrationCredit.indexOf('end $$;', debut)
  assert.notEqual(debut, -1)
  assert.notEqual(fin, -1)
  const finaliser = migrationCredit.slice(debut, fin + 6)
  assert.match(finaliser, /security definer set search_path=''/i)
  assert.match(finaliser, /pg_advisory_xact_lock\(72150301\)/)
  assert.match(finaliser, /where transaction_id=p_transaction_id for update/i)
  assert.match(finaliser, /if exists\(select 1 from prive\.credits_abonnement where transaction_id=t\.id\) then\s*return 'deja_regle'/i)
  assert.match(finaliser, /insert into public\.recompenses_parrainage[\s\S]*?on conflict\(parrain_id,filleul_id\) do nothing/i)
  assert.match(finaliser, /update public\.bailleurs set plan='Standard'/i)
  assert.match(finaliser, /insert into prive\.credits_abonnement[\s\S]*?update public\.abonnements_transactions set statut='REGLEE'/i)
  assert.match(migrationCredit, /unique\(environnement_fedapay,reference_fedapay\)/i)
  assert.match(migrationCredit, /grant execute on function public\.finaliser_abonnement_fedapay[\s\S]*?to service_role/i)
})

test('le reçu historique sans snapshot borne ses versements à la date de publication', () => {
  assert.match(migrationFinances, /Les versements ultérieurs ne réécrivent pas un reçu antérieur/i)
  assert.match(migrationFinances, /x\.statut='Validé'/)
  assert.match(migrationFinances, /'solde_restant',greatest\(0,loyer-cumul\)/)
  assert.match(migrationSoldeHistorique, /x\.valide_le<=p_date_reference/i)
  assert.match(migrationSoldeHistorique, /q\.pdf_chemin is not null[\s\S]*?q\.date_generation/i)
  assert.match(migrationSoldeHistorique, /q\.donnees_financieres[\s\S]*?prive\.finances_paiement_locatif_a_date/i)
  assert.match(migrationSoldeHistorique, /grant execute on function public\.lire_quittance_autorisee\(uuid,uuid\) to service_role/i)
})

test('le scénario SQL compare plusieurs versements et annule ses fixtures', () => {
  assert.match(scenarioSoldeHistorique, /doc_at timestamptz/i)
  assert.match(scenarioSoldeHistorique, /doc_at\+interval '1 minute'/i)
  assert.match(scenarioSoldeHistorique, /ROLLBACK_FIXTURES_AFTER_PASS/)
  assert.match(scenarioSoldeHistorique, /cumul_loyer[^\n]*distinct from 30000/)
  assert.match(scenarioSoldeHistorique, /solde_restant[^\n]*distinct from 70000/)
  assert.match(scenarioSoldeHistorique, /numero_document,type,date_generation,pdf_chemin/)
})
