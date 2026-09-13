/**
 * Banc des invitations — le chaînon entre Sikaloc_Pro et Sikaloc_Me.
 *
 *   supabase start · environnement pointant sur la pile LOCALE
 *   OTP_SECRET=… npm run banc:invitations
 *
 * ─── Ce qu'un jeton ouvre ───────────────────────────────────────────────────
 *
 * L'accès aux documents de loyer d'une personne. C'est pourquoi ce banc insiste
 * moins sur le chemin heureux que sur tout ce qui doit être refusé : un jeton
 * réutilisé, expiré, annulé, ou présenté pour une ligne déjà prise.
 */
const { createClient } = require('@supabase/supabase-js')
const { createHmac, randomBytes } = require('crypto')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SECRET = process.env.OTP_SECRET || ''

if (!/127\.0\.0\.1|localhost/.test(SUPABASE || '')) {
  console.error(`Refus : ${SUPABASE || '(aucune URL)'} n'est pas une pile locale.`)
  process.exit(1)
}
if (SECRET.length < 32) {
  console.error('OTP_SECRET absente ou trop courte (32 caractères minimum).')
  process.exit(1)
}

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const comparer = (nom, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu)
  etapes.push(ok)
  console.log(
    `  ${ok ? '✓' : '✗'} ${nom}` +
      (ok
        ? ` — ${JSON.stringify(obtenu)}`
        : `\n      attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`),
  )
}
const titre = (t) => console.log(`\n${t}`)

const empreinte = (jeton) => createHmac('sha256', SECRET).update(jeton).digest('hex')
const nouveauJeton = () => randomBytes(32).toString('base64url')

;(async () => {
  console.log('\nInvitations : Sikaloc_Pro → Sikaloc_Me\n')

  const suffixe = Date.now()
  const creerCompte = async (nom, meta) => {
    const email = `banc-invit-${nom}-${suffixe}@exemple.test`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: MDP,
      email_confirm: true,
      user_metadata: meta,
    })
    if (error) throw new Error(`${nom} : ${error.message}`)
    return { id: data.user.id, email }
  }

  /** Accepte une invitation SOUS L'IDENTITÉ du compte, jamais en service_role. */
  const accepter = async (email, jeton) => {
    const client = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
    const { error } = await client.auth.signInWithPassword({ email, password: MDP })
    if (error) return { motif: 'connexion_impossible' }
    const { data, error: e } = await client.rpc('accepter_invitation', {
      p_empreinte: empreinte(jeton),
    })
    if (e) return { motif: 'erreur_rpc', detail: e.message }
    return Array.isArray(data) ? data[0] : data
  }

  /**
   * Émet une invitation SOUS L'IDENTITÉ du bailleur.
   *
   * Passer par la clé de service contournerait les droits et masquerait
   * exactement le défaut qui a été trouvé dans le navigateur : `authenticated`
   * n'avait que `select`, et le bouton « Inviter » échouait sur « permission
   * denied ». Un banc qui écrit en service_role ne teste pas le produit.
   */
  const clientBailleur = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  let bailleurConnecte = false

  const inviter = async (locataireId, bailleurId, email, options = {}) => {
    if (!bailleurConnecte) {
      await clientBailleur.auth.signInWithPassword({ email: bailleur.email, password: MDP })
      bailleurConnecte = true
    }
    const jeton = nouveauJeton()
    const { error } = await clientBailleur.from('invitations_locataire').insert({
      locataire_id: locataireId,
      bailleur_id: bailleurId,
      email,
      empreinte: empreinte(jeton),
      expire_le: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      cree_par: bailleurId,
    })
    if (error) throw new Error(error.message)

    // Expiration passée ou annulation d'emblée : des états qu'aucun bailleur ne
    // peut poser lui-même, et qu'on fabrique donc en service_role pour les
    // éprouver.
    if (options.expireLe || options.annulee) {
      await admin
        .from('invitations_locataire')
        .update({
          ...(options.expireLe ? { expire_le: options.expireLe } : {}),
          ...(options.annulee ? { annulee_le: new Date().toISOString() } : {}),
        })
        .eq('empreinte', empreinte(jeton))
    }

    return jeton
  }

  // ── Terrain ──────────────────────────────────────────────────────────────
  const bailleur = await creerCompte('pro', {
    nom: 'Moussa Adjovi',
    telephone: '+2290190459821',
  })

  const { data: logement } = await admin
    .from('logements')
    .insert({
      bailleur_id: bailleur.id,
      adresse: 'Lot 42, Fidjrossè',
      ville: 'Cotonou',
      type: 'Appartement',
    })
    .select('id')
    .single()

  const creerLocataire = async (nom, email) => {
    const { data } = await admin
      .from('locataires')
      .insert({
        bailleur_id: bailleur.id,
        nom,
        telephone: '+2290196554433',
        email,
        consentement_donnees: true,
        date_consentement: new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single()
    return data.id
  }

  // ═══ 1 — le chemin heureux ═════════════════════════════════════════════════
  titre('1. Le bailleur invite, le locataire rejoint')

  const paul = await creerCompte('paul', {
    nom: 'Paul Aholou',
    telephone: '+2290197223344',
    role: 'locataire',
  })
  const lignePaul = await creerLocataire('Paul Aholou', paul.email)

  comparer('le compte locataire n’a pas de profil bailleur',
    (await admin.from('bailleurs').select('id').eq('id', paul.id).maybeSingle()).data, null)

  const jeton = await inviter(lignePaul, bailleur.id, paul.email)
  const r1 = await accepter(paul.email, jeton)

  comparer('l’invitation est acceptée', r1.motif, 'ok')
  comparer('elle désigne la bonne ligne locataire', r1.locataire_id, lignePaul)
  comparer('et le bon bailleur', r1.bailleur_id, bailleur.id)

  const { data: apres } = await admin
    .from('locataires')
    .select('compte_id, compte_lie_le')
    .eq('id', lignePaul)
    .single()
  comparer('le compte est rattaché', apres.compte_id, paul.id)
  noter('la date de liaison est posée', Boolean(apres.compte_lie_le), apres.compte_lie_le)

  // ═══ 2 — usage unique ══════════════════════════════════════════════════════
  titre('2. Un jeton ne sert qu’une fois')

  const r2 = await accepter(paul.email, jeton)
  comparer('le même jeton est refusé', r2.motif, 'deja_utilisee')

  const { data: invit } = await admin
    .from('invitations_locataire')
    .select('utilisee_le')
    .eq('empreinte', empreinte(jeton))
    .single()
  noter('l’invitation est marquée consommée', Boolean(invit.utilisee_le))

  // ═══ 3 — le jeton n'est pas en base ════════════════════════════════════════
  titre('3. Le jeton n’est jamais stocké')

  const { data: toutes } = await admin.from('invitations_locataire').select('*')
  noter(
    'aucune colonne ne contient le jeton',
    !JSON.stringify(toutes).includes(jeton),
    'seule son empreinte',
  )
  noter(
    'l’empreinte est bien un HMAC de 64 caractères',
    toutes.every((i) => /^[0-9a-f]{64}$/.test(i.empreinte)),
  )

  // ═══ 4 — un jeton inventé ══════════════════════════════════════════════════
  titre('4. Un jeton inventé n’ouvre rien')

  const r4 = await accepter(paul.email, nouveauJeton())
  comparer('refusé', r4.motif, 'introuvable')

  // ═══ 5 — expiration ════════════════════════════════════════════════════════
  titre('5. Une invitation expirée')

  const awa = await creerCompte('awa', {
    nom: 'Awa Kponou',
    telephone: '+2290196554433',
    role: 'locataire',
  })
  const ligneAwa = await creerLocataire('Awa Kponou', awa.email)

  const perime = await inviter(ligneAwa, bailleur.id, awa.email, {
    expireLe: new Date(Date.now() - 1000).toISOString(),
  })
  comparer('refusée', (await accepter(awa.email, perime)).motif, 'expiree')
  comparer(
    'et la ligne reste libre',
    (await admin.from('locataires').select('compte_id').eq('id', ligneAwa).single()).data
      .compte_id,
    null,
  )

  // ═══ 6 — annulation ════════════════════════════════════════════════════════
  titre('6. Une invitation annulée')

  const annulee = await inviter(ligneAwa, bailleur.id, awa.email, { annulee: true })
  comparer('refusée', (await accepter(awa.email, annulee)).motif, 'annulee')

  // ═══ 7 — un nouvel envoi périme le précédent ═══════════════════════════════
  titre('7. Un nouvel envoi annule le lien précédent')

  const ancien = await inviter(ligneAwa, bailleur.id, awa.email)
  // Ce que fait l'action d'envoi avant d'insérer le nouveau jeton.
  await admin
    .from('invitations_locataire')
    .update({ annulee_le: new Date().toISOString() })
    .eq('locataire_id', ligneAwa)
    .is('utilisee_le', null)
    .is('annulee_le', null)
  const recent = await inviter(ligneAwa, bailleur.id, awa.email)

  comparer('l’ancien lien ne vaut plus rien', (await accepter(awa.email, ancien)).motif, 'annulee')
  comparer('le nouveau fonctionne', (await accepter(awa.email, recent)).motif, 'ok')

  // ═══ 8 — une ligne déjà prise ══════════════════════════════════════════════
  titre('8. Deux comptes ne peuvent pas se partager une ligne')

  const intrus = await creerCompte('intrus', {
    nom: 'Quelqu’un d’autre',
    telephone: '+2290190000001',
    role: 'locataire',
  })
  const pourIntrus = await inviter(lignePaul, bailleur.id, intrus.email)

  comparer(
    'le second compte est refusé',
    (await accepter(intrus.email, pourIntrus)).motif,
    'deja_rattache',
  )
  comparer(
    'et le rattachement d’origine tient',
    (await admin.from('locataires').select('compte_id').eq('id', lignePaul).single()).data
      .compte_id,
    paul.id,
  )

  // ═══ 8bis — inviter le locataire d'un autre ════════════════════════════════
  titre('8bis. Un bailleur ne peut pas inviter le locataire d’un autre')

  const proTiers = await creerCompte('tiers', {
    nom: 'Tiers Curieux',
    telephone: '+2290190000009',
  })
  const clientTiers = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await clientTiers.auth.signInWithPassword({ email: proTiers.email, password: MDP })

  // Son propre identifiant, mais la ligne locataire de quelqu'un d'autre.
  // Sans la vérification d'appartenance dans `with check`, un complice aurait
  // pu accepter cette invitation et voir les quittances d'un inconnu.
  const { error: vol } = await clientTiers.from('invitations_locataire').insert({
    locataire_id: ligneAwa,
    bailleur_id: proTiers.id,
    email: 'complice@exemple.test',
    empreinte: empreinte(nouveauJeton()),
    expire_le: new Date(Date.now() + 3600_000).toISOString(),
  })
  noter('refusé par la politique', Boolean(vol), vol?.message?.slice(0, 60))

  // Et se faire passer pour le bailleur légitime ne marche pas non plus.
  const { error: usurpation } = await clientTiers.from('invitations_locataire').insert({
    locataire_id: ligneAwa,
    bailleur_id: bailleur.id,
    email: 'complice@exemple.test',
    empreinte: empreinte(nouveauJeton()),
    expire_le: new Date(Date.now() + 3600_000).toISOString(),
  })
  noter('usurper le bailleur ne marche pas', Boolean(usurpation), usurpation?.message?.slice(0, 60))

  // ═══ 9 — étanchéité de la table ════════════════════════════════════════════
  titre('9. Un locataire ne lit aucune invitation')

  const clientPaul = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await clientPaul.auth.signInWithPassword({ email: paul.email, password: MDP })
  const { data: vues } = await clientPaul.from('invitations_locataire').select('id')
  comparer('aucune ligne visible', (vues ?? []).length, 0)

  const clientPro = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await clientPro.auth.signInWithPassword({ email: bailleur.email, password: MDP })
  const { data: vuesPro } = await clientPro.from('invitations_locataire').select('id')
  noter('le bailleur voit les siennes', (vuesPro ?? []).length > 0, `${(vuesPro ?? []).length} invitations`)

  // ═══ 10 — un bailleur tiers ════════════════════════════════════════════════
  titre('10. Un autre bailleur ne voit rien')

  const autrePro = await creerCompte('pro2', {
    nom: 'Clarius Tchaloko',
    telephone: '+2290157812140',
  })
  const clientAutre = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await clientAutre.auth.signInWithPassword({ email: autrePro.email, password: MDP })
  const { data: vuesAutre } = await clientAutre.from('invitations_locataire').select('id')
  comparer('aucune invitation d’autrui', (vuesAutre ?? []).length, 0)

  // ═══ 11 — le locataire reste étanche après rattachement ════════════════════
  titre('11. Rattaché, mais toujours étanche')

  // Le rattachement ne donne AUCUN droit sur les tables du bailleur : elles
  // restent scopées par `bailleur_id`. Sikaloc_Me lira par une surface dédiée.
  for (const [table, libelle] of [
    ['baux', 'baux'],
    ['paiements', 'paiements'],
    ['quittances', 'quittances'],
    ['logements', 'logements'],
    ['bailleurs', 'profils bailleurs'],
  ]) {
    const { data } = await clientPaul.from(table).select('id')
    comparer(`aucun ${libelle} lisible`, (data ?? []).length, 0)
  }

  // ── Ménage ───────────────────────────────────────────────────────────────
  for (const c of [bailleur, autrePro, proTiers, paul, awa, intrus]) {
    await admin.auth.admin.deleteUser(c.id)
  }
  void logement

  const echecs = etapes.filter((e) => !e).length
  console.log(
    echecs === 0
      ? `\n✓ ${etapes.length} vérifications, aucun écart.\n`
      : `\n✗ ${echecs} écart(s) sur ${etapes.length}.\n`,
  )
  process.exit(echecs === 0 ? 0 : 1)
})()
