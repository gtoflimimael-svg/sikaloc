import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

test('la signature d’onboarding ne passe pas par le garde qui exige déjà un onboarding terminé', async () => {
  const actions = await lire('src/lib/actions/parametres.ts')
  const debut = actions.indexOf('export async function televerserSignatureOnboarding(')
  const fin = actions.indexOf('async function enregistrerSignaturePourBailleur(', debut)
  const action = actions.slice(debut, fin)

  assert.notEqual(debut, -1)
  assert.notEqual(fin, -1)
  assert.match(action, /const bailleur = await bailleurCourant\(\)/)
  assert.match(action, /if \(!droits\(bailleur\)\.peutEcrire\)/)
  assert.doesNotMatch(action, /bailleurAvecEcriture\(\)/)
  assert.match(action, /redirect\(`\$\{ESPACE_PRO\.tableauDeBord\}\?bienvenue=1`\)/)
})

test('la signature est persistée et relue avant de marquer l’onboarding terminé', async () => {
  const actions = await lire('src/lib/actions/parametres.ts')
  const debut = actions.indexOf('export async function televerserSignatureOnboarding(')
  const fin = actions.indexOf('async function enregistrerSignaturePourBailleur(', debut)
  const action = actions.slice(debut, fin)
  const helper = actions.slice(fin, actions.indexOf('export async function supprimerSignature(', fin))

  const upload = helper.indexOf(".upload(chemin, fichier")
  const rpc = helper.indexOf("rpc('definir_signature_bailleur'")
  const lectureSignature = helper.indexOf(".select('signature_chemin')")
  const completion = action.indexOf(".update({ onboarding_termine: true })")
  const lectureCompletion = action.indexOf(".select('onboarding_termine')")
  const redirection = action.indexOf('redirect(')

  assert.ok(upload >= 0 && upload < rpc)
  assert.ok(rpc < lectureSignature)
  assert.ok(completion < lectureCompletion)
  assert.ok(lectureCompletion < redirection)
  assert.match(helper, /profil\?\.signature_chemin !== chemin/)
  assert.match(action, /onboardingTermine = !error && profil\?\.onboarding_termine === true/)
  assert.match(action, /if \(!onboardingTermine\) \{[\s\S]*?return \{[\s\S]*?erreur:/)
})

test('les parcours “plus tard” et “tableau de bord” ne redirigent qu’après confirmation SQL', async () => {
  const actions = await lire('src/lib/actions/onboarding.ts')
  const finalisation = actions.slice(actions.indexOf('async function marquerTermineEtRediriger('))

  assert.match(actions, /export async function terminerOnboarding\([\s\S]*?return marquerTermineEtRediriger\(\)/)
  assert.match(actions, /export async function ignorerOnboarding\([\s\S]*?return marquerTermineEtRediriger\(\)/)
  assert.match(finalisation, /\.update\(\{ onboarding_termine: true \}\)[\s\S]*?\.select\('onboarding_termine'\)[\s\S]*?\.single\(\)/)
  assert.match(finalisation, /termine = !error && data\?\.onboarding_termine === true/)
  assert.match(finalisation, /if \(!termine\) \{[\s\S]*?return \{ erreur:/)
  assert.ok(finalisation.indexOf('return { erreur:') < finalisation.indexOf('redirect('))
})

test('une erreur d’enregistrement conserve le fichier choisi pour permettre un nouvel essai', async () => {
  const onboarding = await lire('src/components/app/onboarding.tsx')
  const capture = await lire('src/components/app/capture-signature.tsx')

  assert.match(onboarding, /useActionState\(televerserSignatureOnboarding/)
  assert.match(onboarding, /restaurerApresEchec=\{etat\.erreur \? etat : null\}/)
  assert.match(onboarding, /etat\.erreur \? <Alerte ton="erreur">\{etat\.erreur\}<\/Alerte>/)
  assert.match(capture, /const \[fichierRetenu, setFichierRetenu\] = useState<File \| null>\(null\)/)
  assert.match(capture, /transfert\.items\.add\(fichierRetenu\)/)
  assert.match(capture, /champFichier\.current\.files = transfert\.files/)
})

test('l’enregistrement normal des paramètres garde son garde d’écriture et la RPC reste liée à auth.uid()', async () => {
  const actions = await lire('src/lib/actions/parametres.ts')
  const migration = await lire('supabase/migrations/20261020102334_securiser_mutations_metier.sql')
  const debut = actions.indexOf('export async function televerserSignature(')
  const fin = actions.indexOf('export async function televerserSignatureOnboarding(', debut)
  const actionParametres = actions.slice(debut, fin)

  assert.match(actionParametres, /bailleurAvecEcriture\(\)/)
  assert.match(migration, /function public\.definir_signature_bailleur\(p_chemin text\)[\s\S]*?auth\.uid\(\)/)
  assert.match(migration, /p_chemin is not null and p_chemin !~ \([\s\S]*?v_acteur::text/)
  assert.match(migration, /grant execute on function public\.definir_signature_bailleur\(text\) to authenticated/i)
})
