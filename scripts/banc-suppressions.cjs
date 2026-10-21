/**
 * Banc de l'intégrité des suppressions — Sikaloc, S8-E.
 *
 *   supabase start · set -a && . ./.env.development.local && set +a
 *   npm run banc:suppressions
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. Un compte se ferme entièrement, quel que soit son historique — sans
 *      violation de clé étrangère, sans blocage d'un trigger d'immuabilité.
 *   2. L'historique comptable d'un AUTRE bailleur ne bouge pas.
 *   3. Les protections d'immuabilité tiennent encore pour un compte VIVANT :
 *      un paiement figé, une signature apposée ne se suppriment pas seuls.
 *   4. Un candidat s'efface : profil parti, candidature anonymisée, notifications
 *      non envoyées annulées, notifications déjà parties conservées.
 *   5. Un compte multi-rôles se ferme sans détruire ce qui appartient à d'autres.
 *
 * Ce banc écrit : il refuse toute base qui n'est pas locale.
 */
const { createClient } = require('@supabase/supabase-js')
const sharp = require('sharp')
const { randomUUID } = require('node:crypto')

const { exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

exigerPileLocale('Ce banc')

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'
const comptes = []

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)

/** Un compte, du rôle voulu (bailleur si role omis). */
async function compte(cle, nom, role) {
  const email = `banc-s8e-${cle}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`
  const telephone = `+22901${String(Date.now()).slice(-8)}`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom, telephone, ...(role ? { role } : {}) },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user.id)
  const db = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await db.auth.signInWithPassword({ email, password: MDP })
  return { id: data.user.id, email, nom, telephone, db }
}

/** Un logement, un locataire, un bail — avec un historique déclaré. */
async function bailAvecHistorique(b) {
  const { data: logement } = await admin
    .from('logements')
    .insert({ bailleur_id: b.id, adresse: 'Lot 12, quartier Zogbo', type: 'Appartement', ville: 'Cotonou' })
    .select('id').single()
  const { data: loc } = await admin
    .from('locataires')
    .insert({ bailleur_id: b.id, nom: 'Locataire du banc', telephone: '+2290196000010', consentement_donnees: true, date_consentement: new Date().toISOString().slice(0, 10) })
    .select('id').single()
  const { data: bail } = await admin
    .from('baux')
    .insert({ bailleur_id: b.id, locataire_id: loc.id, logement_id: logement.id, loyer_mensuel: 50000, jour_echeance: 5, date_debut: new Date().toISOString().slice(0, 10), historique_declare_par: b.id, historique_declare_le: new Date().toISOString() })
    .select('id').single()
  return { logement, loc, bail }
}

/** Un paiement validé et FIGÉ (validé il y a plus de 5 minutes), sa quittance, sa signature. */
async function quittanceSignee(b, bail) {
  const debut = new Date(); debut.setDate(1)
  const fin = new Date(debut); fin.setMonth(fin.getMonth() + 1); fin.setDate(0)
  const { data: p, error: ep } = await admin
    .from('paiements')
    .insert({
      bailleur_id: b.id, bail_id: bail.id, montant: 50000,
      periode_debut: debut.toISOString().slice(0, 10), periode_fin: fin.toISOString().slice(0, 10),
      mode_paiement: 'Espèces', type_paiement: 'Loyer', est_partiel: false,
      statut: 'Validé', valide_le: new Date(Date.now() - 10 * 60000).toISOString(), date_paiement: new Date().toISOString().slice(0, 10),
    })
    .select('id').single()
  if (ep) throw new Error(`paiement : ${ep.message}`)
  const { data: q, error: eq } = await admin
    .from('quittances').insert({ bailleur_id: b.id, paiement_id: p.id, type: 'Quittance' }).select('id').single()
  if (eq) throw new Error(`quittance : ${eq.message}`)
  const { data: s, error: es } = await admin
    .from('signatures_apposees').insert({ quittance_id: q.id, bailleur_id: b.id, nom_signataire: b.nom }).select('id').single()
  if (es) throw new Error(`signature : ${es.message}`)
  return { paiement: p, quittance: q, signature: s }
}

async function invitation(b, loc) {
  await admin.from('invitations_locataire').insert({
    bailleur_id: b.id, locataire_id: loc.id, email: 'inv@exemple.test',
    empreinte: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_par: b.id,
  })
}

/** Une annonce publiée, avec une photo (la publication exige au moins une). */
async function annoncePubliee(b) {
  const { data: logement } = await admin
    .from('logements').insert({ bailleur_id: b.id, adresse: 'Lot 3, Fidjrossè', type: 'Appartement', ville: 'Cotonou' }).select('id').single()
  const { data: a } = await admin
    .from('annonces').insert({ bailleur_id: b.id, logement_id: logement.id, type: 'Appartement', ville: 'Cotonou', quartier: 'Fidjrossè', chambres: 2, loyer: 90000, description: 'Deux chambres salon, banc S8-E.' })
    .select('id, reference').single()
  const fichier = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#8a5a3e' } }).jpeg({ quality: 70 }).toBuffer()
  const chemin = `${b.id}/${a.id}/${randomUUID()}.jpg`
  await admin.storage.from('annonces').upload(chemin, fichier, { contentType: 'image/jpeg' })
  await admin.from('annonce_photos').insert({ annonce_id: a.id, bailleur_id: b.id, chemin, position: 0, largeur: 1200, hauteur: 900, type_mime: 'image/jpeg', poids: fichier.length })
  await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
  return a
}

/** Supprime un compte, et rend l'erreur éventuelle (null = réussi). */
async function fermer(id) {
  const { error } = await admin.auth.admin.deleteUser(id)
  return error ? error.message : null
}

const existe = async (table, col, val) =>
  ((await admin.from(table).select('*', { count: 'exact', head: true }).eq(col, val)).count ?? 0) > 0

;(async () => {
  console.log('\nSikaloc — intégrité des suppressions (S8-E)\n')

  // ═══ 1. Un bailleur sans historique ══════════════════════════════════════
  titre('1. Un bailleur sans historique')
  const b1 = await compte('nu', 'Bailleur Nu')
  await annoncePubliee(b1)
  const e1 = await fermer(b1.id)
  noter('Le compte se ferme', e1 === null, e1 ?? '')
  noter('…son profil bailleur est parti', !(await existe('bailleurs', 'id', b1.id)))
  noter('…et ses annonces avec', !(await existe('annonces', 'bailleur_id', b1.id)))

  // ═══ 2. Un bailleur avec quittances ══════════════════════════════════════
  titre('2. Un bailleur avec quittances (paiements figés)')
  const b2 = await compte('quittances', 'Bailleur Quittances')
  const d2 = await bailAvecHistorique(b2)
  const q2 = await quittanceSignee(b2, d2.bail)
  const e2 = await fermer(b2.id)
  noter('Le compte se ferme malgré un paiement figé', e2 === null, e2 ?? '')
  noter('…la quittance est partie', !(await existe('quittances', 'id', q2.quittance.id)))
  noter('…le paiement figé aussi', !(await existe('paiements', 'id', q2.paiement.id)))

  // ═══ 3. Un bailleur avec signatures apposées ═════════════════════════════
  titre('3. Un bailleur avec signatures apposées')
  const b3 = await compte('signatures', 'Bailleur Signatures')
  const d3 = await bailAvecHistorique(b3)
  const q3 = await quittanceSignee(b3, d3.bail)
  const e3 = await fermer(b3.id)
  noter('Le compte se ferme malgré une signature apposée', e3 === null, e3 ?? '')
  noter('…la signature est partie avec son document', !(await existe('signatures_apposees', 'id', q3.signature.id)))

  // ═══ 4. Un bailleur avec historique de bail ══════════════════════════════
  titre('4. Un bailleur ayant déclaré un historique de bail')
  const b4 = await compte('histo', 'Bailleur Histo')
  const d4 = await bailAvecHistorique(b4)
  const e4 = await fermer(b4.id)
  noter('Le compte se ferme (historique_declare_par)', e4 === null, e4 ?? '')
  noter('…le bail est parti', !(await existe('baux', 'id', d4.bail.id)))

  // ═══ 5. Un bailleur ayant créé des invitations ═══════════════════════════
  titre('5. Un bailleur ayant créé des invitations')
  const b5 = await compte('invit', 'Bailleur Invit')
  const d5 = await bailAvecHistorique(b5)
  await invitation(b5, d5.loc)
  const e5 = await fermer(b5.id)
  noter('Le compte se ferme (cree_par)', e5 === null, e5 ?? '')
  noter('…l’invitation est partie', !(await existe('invitations_locataire', 'bailleur_id', b5.id)))

  // ═══ 6. Tout à la fois, et un AUTRE bailleur intact ══════════════════════
  titre('6. Un bailleur avec tout l’historique, un voisin à préserver')
  const temoin = await compte('temoin', 'Bailleur Témoin')
  const dT = await bailAvecHistorique(temoin)
  const qT = await quittanceSignee(temoin, dT.bail)
  await invitation(temoin, dT.loc)

  const b6 = await compte('tout', 'Bailleur Tout')
  const d6 = await bailAvecHistorique(b6)
  await quittanceSignee(b6, d6.bail)
  await invitation(b6, d6.loc)
  await annoncePubliee(b6)
  const e6 = await fermer(b6.id)
  noter('Le compte chargé se ferme d’un coup', e6 === null, e6 ?? '')
  noter('Le voisin garde son profil', await existe('bailleurs', 'id', temoin.id))
  noter('…sa quittance', await existe('quittances', 'id', qT.quittance.id))
  noter('…sa signature', await existe('signatures_apposees', 'id', qT.signature.id))
  noter('…son bail', await existe('baux', 'id', dT.bail.id))
  noter('…son invitation', await existe('invitations_locataire', 'bailleur_id', temoin.id))

  // ═══ 7. La protection d’un compte VIVANT tient toujours ══════════════════
  titre('7. On ne supprime toujours pas les pièces d’un compte vivant')
  const { error: refusPaiement } = await admin.from('paiements').delete().eq('id', qT.paiement.id)
  noter('Un paiement figé ne se supprime pas seul', Boolean(refusPaiement), refusPaiement?.message?.slice(0, 40))
  noter('…et il est toujours là', await existe('paiements', 'id', qT.paiement.id))
  const { error: refusSignature } = await admin.from('signatures_apposees').delete().eq('id', qT.signature.id)
  noter('Une signature apposée ne se supprime pas seule', Boolean(refusSignature), refusSignature?.message?.slice(0, 40))
  noter('…et elle est toujours là', await existe('signatures_apposees', 'id', qT.signature.id))

  // ═══ 8. Un candidat, et sa candidature ═══════════════════════════════════
  titre('8. Un candidat qui a candidaté')
  const bailleurAnnonce = await compte('recoit', 'Bailleur Reçoit')
  const annonce = await annoncePubliee(bailleurAnnonce)
  const cand = await compte('cand', 'Candidate Amina', 'candidat')
  const envoi = await cand.db.rpc('soumettre_candidature', { p_reference: annonce.reference, p_message: 'Bonjour, je suis intéressée.' })
  noter('La candidature part', envoi.data?.[0]?.motif === 'ok', envoi.error?.code)
  const { data: candLignes } = await admin.from('candidatures').select('id').eq('candidat_id', cand.id)
  const candidatureId = candLignes[0].id

  const e8 = await fermer(cand.id)
  noter('Le candidat se ferme', e8 === null, e8 ?? '')
  noter('…son profil candidat est parti', !(await existe('candidats', 'id', cand.id)))
  noter('…mais la candidature demeure', await existe('candidatures', 'id', candidatureId))
  const { data: apres } = await admin.from('candidatures').select('candidat_id, message').eq('id', candidatureId).single()
  noter('…dissociée du compte (candidat_id NULL)', apres.candidat_id === null)
  noter('…le message, lui, reste l’historique du bailleur', apres.message.includes('intéressée'))
  const { data: vueBailleur } = await bailleurAnnonce.db.rpc('candidatures_de_mes_annonces', { p_reference: annonce.reference })
  noter('Le bailleur voit une candidature anonymisée', vueBailleur[0]?.candidat_nom === null)
  noter('…et aucune trace du nom du candidat', !JSON.stringify(vueBailleur).includes('Amina'))

  // ═══ 9. Candidat avec notification non envoyée → annulée ═════════════════
  titre('9. Une notification non envoyée est annulée')
  const cand9 = await compte('cand9', 'Candidat Neuf', 'candidat')
  const env9 = await cand9.db.rpc('soumettre_candidature', { p_reference: annonce.reference, p_message: 'Bonjour.' })
  noter('La candidature part', env9.data?.[0]?.motif === 'ok')
  const { data: c9 } = await admin.from('candidatures').select('id').eq('candidat_id', cand9.id).single()
  await bailleurAnnonce.db.rpc('repondre_candidature', { p_candidature_id: c9.id, p_statut: 'en_etude' })
  const { count: avant9 } = await admin.from('notifications_candidature').select('id', { count: 'exact', head: true }).eq('candidature_id', c9.id).eq('destinataire_role', 'candidat').is('envoye_le', null)
  noter('Une notification attend le candidat', avant9 === 1, `${avant9}`)
  await fermer(cand9.id)
  const { count: apres9 } = await admin.from('notifications_candidature').select('id', { count: 'exact', head: true }).eq('candidature_id', c9.id).eq('destinataire_role', 'candidat').is('envoye_le', null)
  noter('…elle est annulée à la fermeture du compte', apres9 === 0, `${apres9}`)

  // ═══ 10. Candidat avec notification déjà envoyée → conservée ═════════════
  titre('10. Une notification déjà envoyée est conservée')
  const cand10 = await compte('cand10', 'Candidat Dix', 'candidat')
  const env10 = await cand10.db.rpc('soumettre_candidature', { p_reference: annonce.reference, p_message: 'Bonjour.' })
  noter('La candidature part', env10.data?.[0]?.motif === 'ok')
  const { data: c10 } = await admin.from('candidatures').select('id').eq('candidat_id', cand10.id).single()
  await bailleurAnnonce.db.rpc('repondre_candidature', { p_candidature_id: c10.id, p_statut: 'acceptee' })
  // On simule l'envoi : la notification passe à « envoyée ».
  await admin.from('notifications_candidature').update({ envoye_le: new Date().toISOString() }).eq('candidature_id', c10.id).eq('destinataire_role', 'candidat')
  const { count: envoyees } = await admin.from('notifications_candidature').select('id', { count: 'exact', head: true }).eq('candidature_id', c10.id).eq('destinataire_role', 'candidat').not('envoye_le', 'is', null)
  noter('Une notification a été envoyée', envoyees === 1)
  await fermer(cand10.id)
  const { count: conservees } = await admin.from('notifications_candidature').select('id', { count: 'exact', head: true }).eq('candidature_id', c10.id).eq('destinataire_role', 'candidat').not('envoye_le', 'is', null)
  noter('…elle reste après la fermeture du compte', conservees === 1, `${conservees}`)

  // ═══ 11. Un compte multi-rôles ═══════════════════════════════════════════
  titre('11. Un compte à trois casquettes')
  // Bailleur (son annonce), candidat (candidature chez un AUTRE bailleur),
  // et locataire (fiche écrite par le bailleur-témoin).
  const multi = await compte('multi', 'Multi Rôles', 'candidat')
  // On lui greffe un profil bailleur : le déclencheur ne l'a pas fait (rôle candidat).
  await admin.from('bailleurs').insert({
    id: multi.id, nom: 'Multi Rôles', telephone: multi.telephone, email: multi.email,
    code_parrainage: 'S8E' + Math.random().toString(36).slice(2, 8).toUpperCase(),
  })
  const monAnnonce = await annoncePubliee(multi)
  // Il candidate chez le bailleur-témoin (autre annonce).
  const annonceVoisin = await annoncePubliee(bailleurAnnonce)
  const envMulti = await multi.db.rpc('soumettre_candidature', { p_reference: annonceVoisin.reference, p_message: 'Candidature multi.' })
  noter('Le multi-rôles candidate ailleurs', envMulti.data?.[0]?.motif === 'ok', envMulti.error?.code)
  const { data: candMulti } = await admin.from('candidatures').select('id').eq('candidat_id', multi.id).single()
  // Et il est rattaché comme locataire par le bailleur-témoin.
  const { data: ficheLoc } = await admin.from('locataires')
    .insert({ bailleur_id: bailleurAnnonce.id, nom: 'Multi comme locataire', telephone: '+2290196000077', consentement_donnees: true, date_consentement: new Date().toISOString().slice(0, 10), compte_id: multi.id, compte_lie_le: new Date().toISOString() })
    .select('id').single()

  const eM = await fermer(multi.id)
  noter('Le compte multi-rôles se ferme', eM === null, eM ?? '')
  noter('…profil bailleur parti', !(await existe('bailleurs', 'id', multi.id)))
  noter('…profil candidat parti', !(await existe('candidats', 'id', multi.id)))
  noter('…son annonce partie', !(await existe('annonces', 'id', monAnnonce.id)))
  const { data: ficheApres } = await admin.from('locataires').select('compte_id').eq('id', ficheLoc.id).single()
  noter('La fiche locataire SURVIT, dissociée du compte', ficheApres && ficheApres.compte_id === null)
  noter('La candidature déposée chez le voisin SURVIT', await existe('candidatures', 'id', candMulti.id))
  const { data: vueVoisin } = await bailleurAnnonce.db.rpc('candidatures_de_mes_annonces', { p_reference: annonceVoisin.reference })
  noter('…anonymisée chez le voisin', vueVoisin[0]?.candidat_nom === null)
  noter('L’annonce du voisin, elle, est intacte', await existe('annonces', 'id', annonceVoisin.id))

  // ═══ 12. Aucune donnée personnelle résiduelle ════════════════════════════
  titre('12. Rien du candidat supprimé ne subsiste indûment')
  const { data: toutesCand } = await admin.from('candidatures').select('*').in('id', [candidatureId, candMulti.id])
  const brut = JSON.stringify(toutesCand)
  noter('Aucun candidat_id vers un compte supprimé', !brut.includes(cand.id) && !brut.includes(multi.id))
  const { count: profilsPartis } = await admin.from('candidats').select('id', { count: 'exact', head: true }).in('id', [cand.id, cand9.id, cand10.id, multi.id])
  noter('Aucun profil candidat supprimé ne subsiste', profilsPartis === 0, `${profilsPartis}`)

  // ═══ 13. Aucune suppression en cascade inattendue ════════════════════════
  titre('13. Le bailleur-témoin, après tout cela')
  noter('Le bailleur-témoin existe toujours', await existe('bailleurs', 'id', temoin.id))
  noter('Le bailleur qui reçoit les candidatures existe toujours', await existe('bailleurs', 'id', bailleurAnnonce.id))
  noter('Son annonce initiale est intacte', await existe('annonces', 'id', annonce.id))
  const { count: candResiduelles } = await admin.from('candidatures').select('id', { count: 'exact', head: true }).eq('annonce_id', annonce.id)
  noter('Les candidatures anonymisées restent sur son annonce', candResiduelles >= 2, `${candResiduelles}`)

  // ─── Ménage garanti ────────────────────────────────────────────────────
  await rangerComptes(admin, comptes)

  const reussies = etapes.filter(Boolean).length
  console.log(`\n${reussies}/${etapes.length} vérifications passent\n`)
  process.exit(reussies === etapes.length ? 0 : 1)
})().catch(async (e) => {
  console.error(e)
  await rangerComptes(admin, comptes)
  process.exit(1)
})
