import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const racine = new URL('../', import.meta.url)
const cheminsPages = [
  'src/app/pro/(shell)/tableau-de-bord/page.tsx',
  'src/app/pro/(shell)/impayes/page.tsx',
  'src/app/pro/(shell)/logements/page.tsx',
  'src/app/pro/(shell)/logements/nouveau/page.tsx',
  'src/app/pro/(shell)/logements/[id]/modifier/page.tsx',
  'src/app/pro/(shell)/locataires/page.tsx',
  'src/app/pro/(shell)/locataires/nouveau/page.tsx',
  'src/app/pro/(shell)/locataires/[id]/modifier/page.tsx',
  'src/app/pro/(shell)/baux/page.tsx',
  'src/app/pro/(shell)/baux/nouveau/page.tsx',
  'src/app/pro/(shell)/baux/[id]/page.tsx',
  'src/app/pro/(shell)/baux/[id]/modifier/page.tsx',
  'src/app/pro/(shell)/baux/[id]/historique/page.tsx',
  'src/app/pro/(shell)/paiements/page.tsx',
  'src/app/pro/(shell)/paiements/nouveau/page.tsx',
  'src/app/pro/(shell)/paiements/[id]/modifier/page.tsx',
  'src/app/pro/(shell)/paiements/[id]/confirmer/page.tsx',
]

const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

test('les 17 routes opérationnelles Pro du périmètre existent sans doublon', async () => {
  assert.equal(new Set(cheminsPages).size, 17)
  await Promise.all(cheminsPages.map((chemin) => access(new URL(chemin, racine))))
})

test('la navigation Pro est regroupée par tâche et marque la route courante', async () => {
  const navigation = await lire('src/components/app/navigation.tsx')
  assert.match(navigation, /titre: 'Pilotage'/)
  assert.match(navigation, /titre: 'Gestion locative'/)
  assert.doesNotMatch(navigation, /Annonces|Commercialisation|\/pro\/annonces/)
  assert.match(navigation, /titre: 'Compte'/)
  assert.match(navigation, /aria-current=\{courant\}/)
  assert.match(navigation, /chemin === lien\.href \? 'page' : actif \? 'location'/)
})

test('le shell ne duplique pas le titre ni les actions de paiement propres aux pages', async () => {
  const navigation = await lire('src/components/app/navigation.tsx')
  const layout = await lire('src/app/pro/(shell)/layout.tsx')
  const tableauDeBord = await lire('src/app/pro/(shell)/tableau-de-bord/page.tsx')
  const paiements = await lire('src/app/pro/(shell)/paiements/page.tsx')
  assert.match(navigation, /function groupeContexte\(chemin: string\)/)
  assert.doesNotMatch(navigation, /contexte\.page/)
  assert.doesNotMatch(navigation, /ActionPaiementTopbar|afficherRaccourciPaiement|bouton-paiement/)
  assert.doesNotMatch(layout, /ActionPaiementTopbar|Enregistrer un paiement/)
  assert.match(tableauDeBord, /Enregistrer un paiement/)
  assert.match(paiements, /Nouveau paiement/)
})

test('les états vides métier Pro ne réutilisent pas les anciennes illustrations 3D', async () => {
  const pages = [
    'src/app/pro/(shell)/logements/page.tsx',
    'src/app/pro/(shell)/locataires/page.tsx',
    'src/app/pro/(shell)/baux/page.tsx',
    'src/app/pro/(shell)/baux/[id]/page.tsx',
    'src/app/pro/(shell)/paiements/page.tsx',
  ]
  const contenus = await Promise.all(pages.map(lire))
  for (const contenu of contenus) assert.doesNotMatch(contenu, /IllustrationMarque/)
})

test('les actions de page et les tableaux restent utilisables sur petits écrans et au clavier', async () => {
  const styles = await lire('src/app/globals.css')
  const listes = await lire('src/components/ui/listes.tsx')
  const retours = await lire('src/components/ui/retours.tsx')
  assert.match(styles, /\.page-header-actions \{ width: 100%/)
  assert.match(styles, /\.table-defilante:focus-visible/)
  assert.match(listes, /role="region"[\s\S]*tabIndex=\{0\}/)
  assert.match(retours, /className="page-header-actions shrink-0"/)
})

test('le tableau de bord priorise un suivi réel sans promettre une relance automatique', async () => {
  const dashboard = await lire('src/app/pro/(shell)/tableau-de-bord/page.tsx')
  assert.match(dashboard, /À surveiller/)
  assert.match(dashboard, /Paiement à confirmer/)
  assert.match(dashboard, /suiviUrgentConnu,/)
  assert.match(dashboard, /nbImpayes: Number\(impayesReponse\.count/)
  assert.match(dashboard, /nbBrouillons: Number\(brouillonsReponse\.count/)
  assert.match(dashboard, /determinerActionContextuelleDashboard/)
  assert.match(dashboard, /from\('v_echeances'\)/)
  assert.match(dashboard, /Versements validés/)
  assert.match(dashboard, /metriquesReponse\.error/)
  assert.doesNotMatch(dashboard, /Envoyer une relance/)
  assert.match(dashboard, /TableauListe id="derniers-paiements"/)
})

test('les données du dashboard restent bornées au bailleur et les vues conservent RLS', async () => {
  const dashboard = await lire('src/app/pro/(shell)/tableau-de-bord/page.tsx')
  const migration = await lire('supabase/migrations/20261020185126_fiabiliser_loyers_echeances.sql')
  assert.match(dashboard, /bailleurOnboarde\(\)/)
  assert.equal((dashboard.match(/\.eq\('bailleur_id', bailleur\.id\)/g) ?? []).length, 9)
  assert.match(migration, /create or replace view public\.v_metriques_dashboard[\s\S]*?security_invoker = true/)
  assert.match(migration, /create or replace view public\.v_echeances[\s\S]*?security_invoker = true/)
})

test('les paiements récents ne montrent les justificatifs que s’ils sont réellement liés', async () => {
  const dashboard = await lire('src/app/pro/(shell)/tableau-de-bord/page.tsx')
  assert.match(dashboard, /\.eq\('statut', 'Validé'\)/)
  assert.match(dashboard, /quittance:quittances\(id, type\)/)
  assert.match(dashboard, /\/pro\/quittances\/\$\{encodeURIComponent\(/)
  assert.match(dashboard, /Voir le justificatif/)
})

test('le détail d’un bail expose son historique de paiements dans une région accessible', async () => {
  const detailBail = await lire('src/app/pro/(shell)/baux/[id]/page.tsx')
  assert.match(detailBail, /TableauListe id="paiements-bail" libelle="Historique des paiements du bail"/)
})

test('la confirmation du paiement garde la propriété SQL et utilise le loyer historisé pour son aperçu', async () => {
  const confirmation = await lire('src/app/pro/(shell)/paiements/[id]/confirmer/page.tsx')
  const actions = await lire('src/lib/actions/paiements.ts')
  assert.match(confirmation, /\.from\('v_echeances'\)/)
  assert.match(confirmation, /apercuDocumentPaiement\(/)
  assert.match(confirmation, /Déterminé à la validation/)
  assert.match(actions, /export async function validerPaiement[\s\S]*bailleurAvecEcriture\(\)/)
  assert.match(actions, /genererEtStocker\(id, true\)/)
})
