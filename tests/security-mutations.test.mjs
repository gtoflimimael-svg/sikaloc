import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const racine = new URL('../', import.meta.url)
const lire = async (chemin) => readFile(new URL(chemin, racine), 'utf8')
const migration = await lire('supabase/migrations/20261020102334_securiser_mutations_metier.sql')
const migrationSignature = await lire('supabase/migrations/20261020103659_corriger_signature_locataire.sql')

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
