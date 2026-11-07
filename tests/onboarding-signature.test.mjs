import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

test('l’inscription conserve les informations saisies sans demander la signature', async () => {
  const auth = await lire('src/lib/actions/auth.ts')
  const onboarding = await lire('src/app/pro/onboarding/page.tsx')
  assert.match(auth, /data:\s*\{[\s\S]*?nom,[\s\S]*?telephone,[\s\S]*?code_parrain/)
  assert.doesNotMatch(auth, /signature|onboarding_termine/)
  assert.match(onboarding, /redirect\(ESPACE_PRO\.tableauDeBord\)/)
  assert.doesNotMatch(onboarding, /AssistantOnboarding/)
})

test('les paramètres gardent le dessin/import, le contrôle d’écriture et la confirmation de persistance', async () => {
  const actions = await lire('src/lib/actions/parametres.ts')
  const settings = await lire('src/components/app/parametres.tsx')
  const page = await lire('src/app/pro/(shell)/parametres/signature/page.tsx')
  const debut = actions.indexOf('export async function televerserSignature(')
  const fin = actions.indexOf('async function enregistrerSignaturePourBailleur(', debut)
  const action = actions.slice(debut, fin)
  const helper = actions.slice(fin, actions.indexOf('export async function supprimerSignature(', fin))

  assert.match(action, /bailleurAvecEcriture\(\)/)
  assert.ok(helper.indexOf('.upload(chemin, fichier') < helper.indexOf("rpc('definir_signature_bailleur'") )
  assert.ok(helper.indexOf("rpc('definir_signature_bailleur'") < helper.indexOf(".select('signature_chemin')"))
  assert.match(helper, /profil\?\.signature_chemin !== chemin/)
  assert.match(settings, /CaptureSignature/)
  assert.match(settings, /restaurerApresEchec/)
  assert.match(settings, /Modifier votre signature ne change jamais les documents déjà émis/)
  assert.match(page, /requise pour générer une nouvelle quittance/)
})

test('la migration contrôle le bailleur et l’objet Storage avant de créer une quittance', async () => {
  const migration = await lire('supabase/migrations/20261107205525_exiger_signature_pour_quittance.sql')
  const preparation = migration.slice(
    migration.indexOf('create or replace function public.preparer_emission_quittance'),
    migration.indexOf('revoke all on function public.preparer_emission_quittance'),
  )
  const verification = preparation.indexOf('SIGNATURE_QUITTANCE_REQUISE')
  const insertion = preparation.indexOf('insert into public.quittances')

  assert.ok(verification >= 0 && insertion > verification)
  assert.match(preparation, /type_paiement' = 'Loyer'/)
  assert.match(preparation, /est_partiel' = 'false'::jsonb/)
  assert.match(preparation, /join storage\.objects o/)
  assert.match(preparation, /o\.bucket_id = 'signatures'/)
  assert.match(preparation, /a\.id = p_acteur/)
  assert.match(preparation, /SIGNATURE_QUITTANCE_REQUISE' using errcode = 'P0001'/)
  assert.match(migration, /revoke all on function public\.preparer_emission_quittance[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.preparer_emission_quittance[\s\S]*to service_role/)
})

test('la reclassification SQL correspond au type documentaire : seul un loyer explicitement complet est une quittance', async () => {
  const migration = await lire('supabase/migrations/20261107205525_exiger_signature_pour_quittance.sql')
  assert.match(migration, /exige_signature := c->'finances'->>'type_paiement' = 'Loyer'[\s\S]*?est_partiel' = 'false'::jsonb/)
  assert.match(migration, /when c->'finances'->>'type_paiement' = 'Loyer'[\s\S]*?then 'Quittance'::public\.type_document[\s\S]*?else 'Reçu'::public\.type_document/)
  assert.match(migration, /when exige_signature[\s\S]*?then 'Quittance'::public\.type_document[\s\S]*?else 'Reçu'::public\.type_document/)
})

test('la publication revérifie signature originale et snapshot sans ouvrir la RPC aux utilisateurs', async () => {
  const migration = await lire('supabase/migrations/20261107205525_exiger_signature_pour_quittance.sql')
  const publication = migration.slice(migration.indexOf('create or replace function public.publier_emission_quittance'))
  assert.match(publication, /p_snapshot is null[\s\S]*?p_hash_signature is null/)
  assert.match(publication, /join storage\.objects original/)
  assert.match(publication, /join storage\.objects copie/)
  assert.match(publication, /original\.bucket_id = 'signatures'/)
  assert.match(publication, /copie\.name = p_snapshot/)
  assert.match(publication, /SIGNATURE_QUITTANCE_REQUISE/)
  assert.match(publication, /revoke all[\s\S]*from public, anon, authenticated/)
  assert.match(publication, /grant execute[\s\S]*to service_role/)
})

test('une quittance déjà publiée retourne avant le contrôle de la signature actuelle', async () => {
  const migration = await lire('supabase/migrations/20261107205525_exiger_signature_pour_quittance.sql')
  const preparation = migration.slice(
    migration.indexOf('create or replace function public.preparer_emission_quittance'),
    migration.indexOf('revoke all on function public.preparer_emission_quittance'),
  )
  assert.ok(preparation.indexOf("'deja_publiee'") < preparation.indexOf('SIGNATURE_QUITTANCE_REQUISE'))
})

test('le serveur exige une signature valide avant toute validation pouvant émettre une quittance', async () => {
  const generator = await lire('src/lib/quittance.ts')
  const actions = await lire('src/lib/actions/paiements.ts')
  const actionClient = await lire('src/components/app/generer-document-paiement.tsx')
  const etape = await lire('src/components/app/etape-signature-quittance.tsx')
  const route = await lire('src/app/pro/(shell)/paiements/[id]/confirmer/signature/page.tsx')
  const api = await lire('src/app/api/quittances/[id]/pdf/route.ts')
  const appelPreparation = generator.indexOf("rpc('preparer_emission_quittance'")
  const appelPrecontrole = generator.indexOf('await verifierSignatureAvantPreparation(')

  assert.match(generator, /chargerSignature\(bailleur\.signature_chemin\)/)
  assert.ok(appelPrecontrole >= 0 && appelPrecontrole < appelPreparation)
  assert.match(generator, /apercu\.typeDocument !== 'Quittance'\) return/)
  assert.match(generator, /\.eq\('bailleur_id', acteur\)/)
  assert.match(generator, /typeDocument === 'Quittance' && signatureBailleur\.etat !== 'apposee'/)
  assert.match(generator, /throw new SignatureQuittanceRequiseError\(\)/)
  assert.match(generator, /if \(erreur instanceof SignatureQuittanceRequiseError\) throw erreur/)
  assert.match(actions, /return \{ signatureRequise: true \}/)
  assert.doesNotMatch(actionClient, /<dialog|showModal\(/)
  assert.match(actionClient, /routeur\.push\(signatureHref\)/)
  assert.match(etape, /useActionState\([\s\S]*televerserSignature/)
  assert.match(etape, /libelleEnregistrement="Enregistrer et continuer"/)
  assert.match(etape, /restaurerApresEchec=\{etatSignature\.erreur \? etatSignature : null\}/)
  assert.match(etape, /dernierSuccesTraite\.current === etatSignature/)
  assert.match(etape, /actionReprise\(\)/)
  assert.match(route, /searchParams: Promise/)
  assert.match(route, /\.eq\('bailleur_id', bailleur\.id\)/)
  assert.match(route, /signatureBailleurDisponible\(bailleur\.signature_chemin\)/)
  assert.match(route, /validerPaiement\.bind\(null, paiement\.id\)/)
  assert.match(route, /regenererQuittance\.bind\(null, paiement\.id\)/)
  assert.match(api, /SignatureQuittanceRequiseError/)
  assert.match(api, /status: 409/)
})

test('les PDF historiques servent leur fichier autorisé sans consulter la signature actuelle', async () => {
  const api = await lire('src/app/api/quittances/[id]/pdf/route.ts')
  const lecture = api.indexOf('if (acces.pdfChemin)')
  const fallback = api.indexOf('rassemblerDonnees(acces.paiementId')
  assert.ok(lecture >= 0 && fallback > lecture)
  assert.match(api.slice(lecture, fallback), /createSignedUrl|download\(/)
  assert.match(api.slice(fallback), /SignatureQuittanceRequiseError/)
})

test('les reçus restent sans exigence de signature et les actions gardent le garde d’écriture', async () => {
  const helper = await lire('src/lib/documents-paiement.ts')
  const actions = await lire('src/lib/actions/parametres.ts')
  assert.match(helper, /typePaiement === 'Loyer' && estPartiel === false \? 'Quittance' : 'Reçu'/)
  assert.match(actions, /export async function televerserSignature\([\s\S]*?bailleurAvecEcriture\(\)/)
})
