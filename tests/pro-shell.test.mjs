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
  'src/app/pro/(shell)/annonces/page.tsx',
  'src/app/pro/(shell)/annonces/nouvelle/page.tsx',
  'src/app/pro/(shell)/annonces/[id]/page.tsx',
  'src/app/pro/(shell)/annonces/[id]/candidatures/page.tsx',
  'src/app/pro/(shell)/paiements/page.tsx',
  'src/app/pro/(shell)/paiements/nouveau/page.tsx',
  'src/app/pro/(shell)/paiements/[id]/modifier/page.tsx',
  'src/app/pro/(shell)/paiements/[id]/confirmer/page.tsx',
]

const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

test('les 21 routes opérationnelles Pro du périmètre existent sans doublon', async () => {
  assert.equal(new Set(cheminsPages).size, 21)
  await Promise.all(cheminsPages.map((chemin) => access(new URL(chemin, racine))))
})

test('la navigation Pro est regroupée par tâche et marque la route courante', async () => {
  const navigation = await lire('src/components/app/navigation.tsx')
  assert.match(navigation, /titre: 'Pilotage'/)
  assert.match(navigation, /titre: 'Gestion locative'/)
  assert.match(navigation, /titre: 'Commercialisation'/)
  assert.match(navigation, /titre: 'Compte'/)
  assert.match(navigation, /aria-current=\{courant\}/)
  assert.match(navigation, /chemin === lien\.href \? 'page' : actif \? 'location'/)
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

test('le tableau de bord décrit les actions réelles sans promettre une relance automatique', async () => {
  const dashboard = await lire('src/app/pro/(shell)/tableau-de-bord/page.tsx')
  assert.match(dashboard, /Consulter les impayés/)
  assert.doesNotMatch(dashboard, /Envoyer une relance/)
  assert.match(dashboard, /TableauListe id="derniers-paiements"/)
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
