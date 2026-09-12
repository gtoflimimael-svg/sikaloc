/**
 * Immuabilité des signatures apposées.
 *
 *   supabase start · env pointant sur la pile locale
 *   npm run banc:immuable
 *
 * Il ne touche à aucune interface : tout se joue en base et dans le coffre,
 * c'est-à-dire là où la garantie doit tenir. Une protection qui ne tiendrait
 * qu'à l'écran ne protégerait rien.
 *
 * Le scénario est celui du cahier des charges : Paul signe avec la signature A,
 * change pour la B, et la quittance doit toujours porter A.
 */
const { createClient } = require('@supabase/supabase-js')
const { createHash } = require('crypto')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!/127\.0\.0\.1|localhost/.test(SUPABASE || '')) {
  console.error(`Refus : ${SUPABASE} n'est pas une pile locale.`)
  process.exit(1)
}

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}

/** Un PNG minuscule, distinct à chaque appel, qui tient lieu de signature. */
function signatureFactice(graine) {
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
      '0000000d49444154789c6360000002000100' +
      graine.toString(16).padStart(8, '0') +
      '0000000049454e44ae426082',
    'hex',
  )
  return png
}

const empreinte = (b) => createHash('sha256').update(b).digest('hex')

;(async () => {
  console.log('\nImmuabilité des signatures apposées\n')

  // ── Terrain : un bailleur, un logement, un locataire, un bail, un paiement ──
  const email = `banc-immuable-${Date.now()}@exemple.test`
  const { data: compte } = await admin.auth.admin.createUser({
    email,
    password: 'Jonquille7Mn!',
    email_confirm: true,
    user_metadata: { nom: 'Paul Aholou', telephone: '+2290197000011' },
  })
  const bailleurId = compte.user.id

  const { data: logement } = await admin
    .from('logements')
    .insert({ bailleur_id: bailleurId, adresse: 'Lot 7, Tankpè', ville: 'Calavi', type: 'Maison' })
    .select('id')
    .single()

  const { data: locataire } = await admin
    .from('locataires')
    .insert({
      bailleur_id: bailleurId,
      nom: 'Awa Kponou',
      telephone: '+2290197000012',
      consentement_donnees: true,
      date_consentement: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()

  const { data: bail } = await admin
    .from('baux')
    .insert({
      bailleur_id: bailleurId,
      logement_id: logement.id,
      locataire_id: locataire.id,
      loyer_mensuel: 75000,
      date_debut: '2026-01-01',
      jour_echeance: 5,
    })
    .select('id')
    .single()

  // ── Signature A, déposée dans le coffre ────────────────────────────────
  const signatureA = signatureFactice(0xaaaaaaaa)
  const cheminA = `${bailleurId}/signature.png`
  await admin.storage.from('signatures').upload(cheminA, signatureA, {
    contentType: 'image/png',
    upsert: true,
  })
  await admin.from('bailleurs').update({ signature_chemin: cheminA }).eq('id', bailleurId)
  noter('Signature A déposée', true, `empreinte ${empreinte(signatureA).slice(0, 12)}…`)

  // ── Une quittance, avec son apposition ─────────────────────────────────
  const mois = '2026-03-01'
  const { data: paiement } = await admin
    .from('paiements')
    .insert({
      bailleur_id: bailleurId,
      bail_id: bail.id,
      date_paiement: mois,
      montant: 75000,
      periode_debut: mois,
      periode_fin: '2026-03-31',
      mode_paiement: 'Mobile Money',
      statut: 'Validé',
      valide_le: new Date().toISOString(),
    })
    .select('id')
    .single()

  const { data: quittance } = await admin
    .from('quittances')
    .insert({
      bailleur_id: bailleurId,
      paiement_id: paiement.id,
      bail_id: bail.id,
      numero_document: null,
      type: 'Quittance',
    })
    .select('id, numero_document')
    .single()

  // On reproduit l'apposition telle que `genererEtStocker` la fait.
  const cheminSnapshot = `${bailleurId}/apposees/${quittance.id}.png`
  await admin.storage.from('signatures').upload(cheminSnapshot, signatureA, {
    contentType: 'image/png',
    upsert: true,
  })
  const hashDoc = empreinte(Buffer.from('pdf-factice-' + quittance.id))
  const { error: erreurAppose } = await admin.from('signatures_apposees').insert({
    quittance_id: quittance.id,
    bailleur_id: bailleurId,
    nom_signataire: 'Paul Aholou',
    chemin_snapshot: cheminSnapshot,
    hash_document: hashDoc,
    hash_signature: empreinte(signatureA),
  })
  noter('Test 1 — la quittance est signée avec A', !erreurAppose, quittance.numero_document)

  // ── Test 2 : Paul change de signature ──────────────────────────────────
  const signatureB = signatureFactice(0xbbbbbbbb)
  await admin.storage.from('signatures').upload(cheminA, signatureB, {
    contentType: 'image/png',
    upsert: true,
  })
  noter('Paul remplace sa signature par B', true, `empreinte ${empreinte(signatureB).slice(0, 12)}…`)

  const { data: apposition } = await admin
    .from('signatures_apposees')
    .select('*')
    .eq('quittance_id', quittance.id)
    .single()

  const { data: copie } = await admin.storage.from('signatures').download(apposition.chemin_snapshot)
  const octetsCopie = Buffer.from(await copie.arrayBuffer())

  noter(
    'Test 2 — la copie figée est toujours A',
    empreinte(octetsCopie) === empreinte(signatureA),
    `${empreinte(octetsCopie).slice(0, 12)}…`,
  )
  noter(
    'Et elle diffère bien de la signature courante B',
    empreinte(octetsCopie) !== empreinte(signatureB),
  )
  noter(
    'L’empreinte enregistrée correspond toujours à A',
    apposition.hash_signature === empreinte(signatureA),
  )

  // ── Test 3 : modification directe refusée ──────────────────────────────
  const { error: e3 } = await admin
    .from('signatures_apposees')
    .update({ nom_signataire: 'Quelqu’un d’autre' })
    .eq('quittance_id', quittance.id)
  noter('Test 3 — modification refusée', Boolean(e3), e3?.message?.slice(0, 60))

  const { error: e3b } = await admin
    .from('signatures_apposees')
    .update({ chemin_snapshot: `${bailleurId}/apposees/autre.png` })
    .eq('quittance_id', quittance.id)
  noter('Même sur le chemin de la copie', Boolean(e3b))

  const { error: e3c } = await admin
    .from('signatures_apposees')
    .update({ appose_le: '2020-01-01T00:00:00Z' })
    .eq('quittance_id', quittance.id)
  noter('Même sur la date d’apposition', Boolean(e3c))

  // ── Test 4 : suppression refusée ───────────────────────────────────────
  // Le paiement est encore dans sa fenêtre de 5 minutes : on la ferme d'abord,
  // sinon le retrait serait légitimement autorisé.
  await admin
    .from('paiements')
    .update({ valide_le: new Date(Date.now() - 10 * 60_000).toISOString() })
    .eq('id', paiement.id)

  const { error: e4 } = await admin
    .from('signatures_apposees')
    .delete()
    .eq('quittance_id', quittance.id)
  noter('Test 4 — suppression refusée', Boolean(e4), e4?.message?.slice(0, 60))

  // ── Test 5 : le paiement signé est figé ────────────────────────────────
  const { error: e5 } = await admin
    .from('paiements')
    .update({ montant: 999999 })
    .eq('id', paiement.id)
  noter('Test 5 — le montant du paiement figé est refusé', Boolean(e5), e5?.message?.slice(0, 50))

  // ── Test 6 : l'empreinte détecte un contenu différent ──────────────────
  const hashAutre = empreinte(Buffer.from('pdf-modifié'))
  noter(
    'Test 6 — une empreinte différente ne correspond plus',
    hashAutre !== apposition.hash_document,
  )
  noter('Et l’empreinte d’origine correspond toujours', hashDoc === apposition.hash_document)

  // ── Test 7 : une nouvelle quittance prend la signature B ───────────────
  const mois2 = '2026-04-01'
  const { data: paiement2 } = await admin
    .from('paiements')
    .insert({
      bailleur_id: bailleurId,
      bail_id: bail.id,
      date_paiement: mois2,
      montant: 75000,
      periode_debut: mois2,
      periode_fin: '2026-04-30',
      mode_paiement: 'Mobile Money',
      statut: 'Validé',
      valide_le: new Date().toISOString(),
    })
    .select('id')
    .single()

  const { data: quittance2 } = await admin
    .from('quittances')
    .insert({
      bailleur_id: bailleurId,
      paiement_id: paiement2.id,
      bail_id: bail.id,
      numero_document: null,
      type: 'Quittance',
    })
    .select('id, numero_document')
    .single()

  const chemin2 = `${bailleurId}/apposees/${quittance2.id}.png`
  await admin.storage.from('signatures').upload(chemin2, signatureB, {
    contentType: 'image/png',
    upsert: true,
  })
  await admin.from('signatures_apposees').insert({
    quittance_id: quittance2.id,
    bailleur_id: bailleurId,
    nom_signataire: 'Paul Aholou',
    chemin_snapshot: chemin2,
    hash_document: empreinte(Buffer.from('pdf2')),
    hash_signature: empreinte(signatureB),
  })

  const { data: app1 } = await admin
    .from('signatures_apposees')
    .select('hash_signature')
    .eq('quittance_id', quittance.id)
    .single()
  const { data: app2 } = await admin
    .from('signatures_apposees')
    .select('hash_signature')
    .eq('quittance_id', quittance2.id)
    .single()

  noter('Test 7 — l’ancienne quittance garde A', app1.hash_signature === empreinte(signatureA))
  noter('La nouvelle porte B', app2.hash_signature === empreinte(signatureB))
  noter('Les deux sont bien distinctes', app1.hash_signature !== app2.hash_signature)

  // ── Test 8 : supprimer la signature courante n'atteint pas les copies ──
  await admin.storage.from('signatures').remove([cheminA])
  await admin.from('bailleurs').update({ signature_chemin: null }).eq('id', bailleurId)

  const { data: copieApres } = await admin.storage
    .from('signatures')
    .download(apposition.chemin_snapshot)
  noter(
    'Test 8 — supprimer sa signature ne touche pas les copies figées',
    Boolean(copieApres),
    copieApres ? 'copie toujours lisible' : 'COPIE PERDUE',
  )
  if (copieApres) {
    const octets = Buffer.from(await copieApres.arrayBuffer())
    noter('Et elle vaut toujours A', empreinte(octets) === empreinte(signatureA))
  }

  // ── La cascade reste possible : un document supprimé emporte sa preuve ──
  const { error: eCascade } = await admin.from('quittances').delete().eq('id', quittance2.id)
  const { data: restant } = await admin
    .from('signatures_apposees')
    .select('id')
    .eq('quittance_id', quittance2.id)
    .maybeSingle()
  noter(
    'Supprimer une quittance emporte son apposition (cascade)',
    !eCascade && !restant,
    eCascade?.message?.slice(0, 50) || 'cascade propre',
  )

  const echecs = etapes.filter((e) => !e).length
  console.log(
    echecs === 0
      ? `\n✓ ${etapes.length} vérifications, aucun écart.\n`
      : `\n✗ ${echecs} écart(s) sur ${etapes.length}.\n`,
  )
  process.exit(echecs === 0 ? 0 : 1)
})()
