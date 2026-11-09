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
 *   4. Les données d'un autre bailleur survivent à une fermeture de compte.
 *
 * Ce banc écrit : il refuse toute base qui n'est pas locale.
 */
const { createClient } = require('@supabase/supabase-js')

const { exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

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

/** Un compte de test administré par le banc local. */
async function compte(cle, nom) {
  const email = `banc-s8e-${cle}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`
  const telephone = `+22901${String(Date.now()).slice(-8)}`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom, telephone },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user.id)
  return { id: data.user.id, nom, telephone }
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
  const e1 = await fermer(b1.id)
  noter('Le compte se ferme', e1 === null, e1 ?? '')
  noter('…son profil bailleur est parti', !(await existe('bailleurs', 'id', b1.id)))

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
