import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { apercuDocumentPaiement } from '../src/lib/documents-paiement.ts'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

test('seule une quittance de loyer complète nécessite la signature du bailleur', () => {
  const complet = apercuDocumentPaiement({
    typePaiement: 'Loyer', montant: 100_000, loyerApplicable: 100_000, cumulValideAvant: 0,
  })
  const partiel = apercuDocumentPaiement({
    typePaiement: 'Loyer', montant: 99_000, loyerApplicable: 100_000, cumulValideAvant: 0,
  })
  const versementsFractionnesComplets = apercuDocumentPaiement({
    typePaiement: 'Loyer', montant: 70_000, loyerApplicable: 100_000, cumulValideAvant: 30_000,
  })
  const montantInconnu = apercuDocumentPaiement({
    typePaiement: 'Loyer', montant: 100_000, loyerApplicable: null, cumulValideAvant: null,
  })
  const charges = apercuDocumentPaiement({
    typePaiement: 'Charges', montant: 10_000, loyerApplicable: null, cumulValideAvant: null,
  })

  assert.equal(complet.typeDocument, 'Quittance')
  assert.equal(partiel.typeDocument, 'Reçu')
  assert.equal(versementsFractionnesComplets.typeDocument, 'Quittance')
  assert.equal(montantInconnu.typeDocument, 'Reçu')
  assert.equal(charges.typeDocument, 'Reçu')
})

test('le précontrôle serveur, limité au bailleur connecté, précède la RPC potentiellement mutante', async () => {
  const generator = await lire('src/lib/quittance.ts')
  const helperStart = generator.indexOf('async function verifierSignatureAvantPreparation(')
  const helperEnd = generator.indexOf('/**\n * Autorisation/validation atomiques', helperStart)
  const helper = generator.slice(helperStart, helperEnd)
  const precheckCall = generator.indexOf('await verifierSignatureAvantPreparation(')
  const preparationCall = generator.indexOf("rpc('preparer_emission_quittance'")

  assert.ok(helperStart >= 0 && helperEnd > helperStart)
  assert.ok(precheckCall >= 0 && precheckCall < preparationCall)
  assert.match(helper, /\.eq\('bailleur_id', acteur\)/)
  assert.match(helper, /from\('v_echeances'\)/)
  assert.match(helper, /apercuDocumentPaiement\(/)
  assert.match(helper, /apercu\.typeDocument !== 'Quittance'\) return/)
  assert.match(helper, /chargerSignature\(bailleur\.signature_chemin\)/)
  assert.match(helper, /throw new SignatureQuittanceRequiseError\(\)/)
})

test('l’absence de signature navigue vers une route intégrée sans donnée financière en query', async () => {
  const bouton = await lire('src/components/app/generer-document-paiement.tsx')
  const confirmation = await lire('src/app/pro/(shell)/paiements/[id]/confirmer/page.tsx')
  const quittance = await lire('src/app/pro/(shell)/quittances/[id]/page.tsx')
  const route = await lire('src/app/pro/(shell)/paiements/[id]/confirmer/signature/page.tsx')

  assert.doesNotMatch(bouton, /<dialog|showModal\(/)
  assert.match(bouton, /routeur\.push\(signatureHref\)/)
  assert.match(confirmation, /operation=valider/)
  assert.match(quittance, /operation=regenerer&origine=quittance/)
  assert.match(route, /recherche\.operation/)
  assert.match(route, /\.eq\('id', id\)[\s\S]*?\.eq\('bailleur_id', bailleur\.id\)/)
  assert.match(route, /select\('id,bailleur_id,statut,quittance:quittances\(id\)'\)/)
  assert.doesNotMatch(route, /formaterFCFA|formaterPeriode|resume-operation|Locataire|Logement/)
  assert.match(route, /<h1 className="page-title">Votre signature<\/h1>/)
  assert.match(route, /Signez pour finaliser votre quittance\./)
  assert.match(route, /← Retour/)
  assert.doesNotMatch(route.match(/confirmer\/signature\?[^`]+/)?.[0] ?? '', /montant|loyer|periode|locataire/i)
})

test('la signature persistée reprend exactement l’action initiale, avec retour et retry', async () => {
  const route = await lire('src/app/pro/(shell)/paiements/[id]/confirmer/signature/page.tsx')
  const etape = await lire('src/components/app/etape-signature-quittance.tsx')
  const capture = await lire('src/components/app/capture-signature.tsx')
  const dessin = await lire('src/components/app/signature-dessin.tsx')
  const action = await lire('src/lib/actions/parametres.ts')

  assert.match(route, /validerPaiement\.bind\(null, paiement\.id\)/)
  assert.match(route, /regenererQuittance\.bind\(null, paiement\.id\)/)
  assert.match(route, /← Retour/)
  assert.doesNotMatch(route, /Retour à|Paiement à confirmer|Document à générer/)
  assert.match(etape, /useActionState\([\s\S]*televerserSignature/)
  assert.match(etape, /if \(resultat\?\.erreur\)[\s\S]*setErreurReprise/)
  assert.match(etape, /Réessayer la génération/)
  assert.match(etape, /dernierSuccesTraite\.current = etatSignature/)
  assert.match(capture, /libelleEnregistrement = 'Enregistrer cette signature'/)
  assert.match(capture, /libelleEnregistrement\}/)
  assert.match(capture, /compact \? 'space-y-md' : 'space-y-lg'/)
  assert.match(etape, /compact\s+\/>/)
  assert.doesNotMatch(etape, /paiementDejaValide|Le paiement reste en attente/)
  assert.match(dessin, /touch-none/)
  assert.match(action, /profil\?\.signature_chemin !== chemin/)
  assert.match(action, /restaurer|Gardez votre tracé et réessayez/)
})

test('l’émission garde l’idempotence et les anciennes quittances restent consultables', async () => {
  const generator = await lire('src/lib/quittance.ts')
  const api = await lire('src/app/api/quittances/[id]/pdf/route.ts')
  const signaturePage = await lire('src/app/pro/(shell)/paiements/[id]/confirmer/signature/page.tsx')
  const migration = await lire('supabase/migrations/20261015193157_fiabiliser_paiements_fractionnes_documents.sql')

  assert.match(generator, /if \(emission\.deja_publiee\)/)
  assert.match(generator, /rpc\('publier_emission_quittance'/)
  assert.match(api, /if \(acces\.pdfChemin\)[\s\S]*?createSignedUrl|if \(acces\.pdfChemin\)[\s\S]*?download\(/)
  assert.match(signaturePage, /signatureBailleurDisponible\(bailleur\.signature_chemin\)/)
  assert.match(migration, /where paiement_id=p_paiement for update/)
  assert.match(migration, /deja_publiee/)
  assert.match(migration, /on conflict\(paiement_id\)/)
})

test('la défense SQL complémentaire reste locale et non appliquée à Test par ce parcours', async () => {
  const migration = await lire('supabase/migrations/20261107205525_exiger_signature_pour_quittance.sql')
  const route = await lire('src/app/pro/(shell)/paiements/[id]/confirmer/signature/page.tsx')
  assert.match(migration, /SIGNATURE_QUITTANCE_REQUISE/)
  assert.doesNotMatch(route, /apply_migration|db push|supabase\.rpc\('preparer_emission_quittance'/)
})
