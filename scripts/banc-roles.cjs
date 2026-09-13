/**
 * Banc des rôles — le socle de l'écosystème Pro / Me.
 *
 *   supabase start · environnement pointant sur la pile LOCALE
 *   npm run banc:roles
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 * Trois choses, toutes trois capables de casser en silence :
 *
 *   1. Une inscription ordinaire continue de produire un bailleur. C'est la
 *      régression la plus coûteuse possible : elle casserait la création de
 *      compte pour tout le monde.
 *   2. Une inscription annoncée « locataire » n'en produit AUCUN. Sans ce
 *      garde-fou, le premier locataire inscrit deviendrait bailleur — avec un
 *      code de parrainage et l'accès à l'espace de gestion.
 *   3. `mes_roles()` répond juste, y compris pour un compte qui porte les deux
 *      rôles — situation ordinaire de quelqu'un qui possède un logement et en
 *      loue un autre.
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!/127\.0\.0\.1|localhost/.test(SUPABASE || '')) {
  console.error(`Refus : ${SUPABASE || '(aucune URL)'} n'est pas une pile locale.`)
  process.exit(1)
}

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })

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

const MDP = 'Jonquille7Mn!'

;(async () => {
  console.log('\nRôles : Sikaloc_Pro et Sikaloc_Me\n')

  const suffixe = Date.now()
  const creer = async (nom, meta) => {
    const email = `banc-roles-${nom}-${suffixe}@exemple.test`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: MDP,
      email_confirm: true,
      user_metadata: meta,
    })
    if (error) throw new Error(`${nom} : ${error.message}`)
    return { id: data.user.id, email }
  }

  const profilBailleur = async (id) => {
    const { data } = await admin.from('bailleurs').select('*').eq('id', id).maybeSingle()
    return data
  }

  /** `mes_roles()` vu par le compte lui-même, jamais par le service_role. */
  const rolesVusParLuiMeme = async (email) => {
    const client = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
    const { error } = await client.auth.signInWithPassword({ email, password: MDP })
    if (error) return { erreur: error.message }
    const { data, error: e } = await client.rpc('mes_roles')
    if (e) return { erreur: e.message }
    return Array.isArray(data) ? data[0] : data
  }

  // ═══ 1 — l'inscription ordinaire n'a pas changé ════════════════════════════
  titre('1. Une inscription ordinaire produit toujours un bailleur')

  const pro = await creer('pro', { nom: 'Moussa Adjovi', telephone: '+2290190459821' })
  const profilPro = await profilBailleur(pro.id)

  noter('le profil bailleur existe', Boolean(profilPro), profilPro?.nom)
  comparer('le nom est repris', profilPro.nom, 'Moussa Adjovi')
  comparer('le téléphone aussi', profilPro.telephone, '+2290190459821')
  noter('un code de parrainage est attribué', Boolean(profilPro.code_parrainage), profilPro.code_parrainage)
  noter(
    'la période d’avatar temporaire est ouverte',
    Boolean(profilPro.avatar_temporaire_depuis),
  )

  // ═══ 2 — le locataire ne devient PAS bailleur ══════════════════════════════
  titre('2. Une inscription « locataire » ne produit aucun bailleur')

  const me = await creer('me', {
    nom: 'Awa Kponou',
    telephone: '+2290196554433',
    role: 'locataire',
  })

  comparer('aucun profil bailleur', await profilBailleur(me.id), null)

  const { count: bailleursTotal } = await admin
    .from('bailleurs')
    .select('id', { count: 'exact', head: true })
    .eq('id', me.id)
  comparer('ni sous une autre forme', bailleursTotal, 0)

  // ═══ 3 — mes_roles() dit la vérité ═════════════════════════════════════════
  titre('3. « Qui suis-je ? »')

  comparer('le bailleur se sait bailleur', await rolesVusParLuiMeme(pro.email), {
    est_bailleur: true,
    est_locataire: false,
  })
  comparer('le compte locataire n’est encore rien', await rolesVusParLuiMeme(me.email), {
    est_bailleur: false,
    est_locataire: false,
  })

  // ═══ 4 — le rattachement fait le locataire ═════════════════════════════════
  titre('4. Rattacher un compte à une ligne locataire')

  const { data: locataire } = await admin
    .from('locataires')
    .insert({
      bailleur_id: pro.id,
      nom: 'Awa Kponou',
      telephone: '+2290196554433',
      consentement_donnees: true,
      date_consentement: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()

  await admin
    .from('locataires')
    .update({ compte_id: me.id, compte_lie_le: new Date().toISOString() })
    .eq('id', locataire.id)

  comparer('il devient locataire', await rolesVusParLuiMeme(me.email), {
    est_bailleur: false,
    est_locataire: true,
  })
  comparer('et pas bailleur pour autant', (await profilBailleur(me.id)) === null, true)

  // ═══ 5 — les deux rôles à la fois ══════════════════════════════════════════
  titre('5. Un compte peut être bailleur ET locataire')

  // Le cas réel : quelqu'un possède un logement, et en loue un autre ailleurs.
  const { data: autreBailleur } = await admin
    .from('locataires')
    .insert({
      bailleur_id: me.id === pro.id ? pro.id : pro.id,
      nom: 'Moussa Adjovi',
      telephone: '+2290190459821',
      consentement_donnees: true,
      date_consentement: new Date().toISOString().slice(0, 10),
      compte_id: pro.id,
      compte_lie_le: new Date().toISOString(),
    })
    .select('id')
    .single()

  comparer('les deux rôles cohabitent', await rolesVusParLuiMeme(pro.email), {
    est_bailleur: true,
    est_locataire: true,
  })
  noter('aucune contrainte ne l’a empêché', Boolean(autreBailleur?.id))

  // ═══ 6 — la cohérence du lien ══════════════════════════════════════════════
  titre('6. Le lien ne se pose pas à moitié')

  const { error: sansDate } = await admin
    .from('locataires')
    .update({ compte_id: me.id, compte_lie_le: null })
    .eq('id', locataire.id)
  noter(
    'un compte sans date de liaison est refusé',
    Boolean(sansDate),
    sansDate?.message?.slice(0, 55),
  )

  // ═══ 7 — plusieurs bailleurs pour un même locataire ════════════════════════
  titre('7. Une même personne peut louer chez deux bailleurs')

  const pro2 = await creer('pro2', { nom: 'Clarius Tchaloko', telephone: '+2290157812140' })
  const { error: doublon } = await admin.from('locataires').insert({
    bailleur_id: pro2.id,
    nom: 'Awa Kponou',
    telephone: '+2290196554433',
    consentement_donnees: true,
    date_consentement: new Date().toISOString().slice(0, 10),
    compte_id: me.id,
    compte_lie_le: new Date().toISOString(),
  })
  noter('un second rattachement du même compte est accepté', !doublon, doublon?.message?.slice(0, 55))

  const { count: lignes } = await admin
    .from('locataires')
    .select('id', { count: 'exact', head: true })
    .eq('compte_id', me.id)
  comparer('le compte porte bien deux lignes locataires', lignes, 2)

  // ═══ 8 — étanchéité ════════════════════════════════════════════════════════
  titre('8. Un compte locataire ne voit rien du bailleur')

  const client = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await client.auth.signInWithPassword({ email: me.email, password: MDP })

  const { data: vusBailleurs } = await client.from('bailleurs').select('id')
  comparer('aucun profil bailleur lisible', (vusBailleurs ?? []).length, 0)

  const { data: vusLocataires } = await client.from('locataires').select('id')
  comparer(
    'aucune ligne locataire lisible non plus (politiques bailleur)',
    (vusLocataires ?? []).length,
    0,
  )

  const { data: vusBaux } = await client.from('baux').select('id')
  comparer('aucun bail lisible', (vusBaux ?? []).length, 0)

  const { data: vusPaiements } = await client.from('paiements').select('id')
  comparer('aucun paiement lisible', (vusPaiements ?? []).length, 0)

  // ── Ménage ───────────────────────────────────────────────────────────────
  for (const c of [pro, pro2, me]) await admin.auth.admin.deleteUser(c.id)

  const echecs = etapes.filter((e) => !e).length
  console.log(
    echecs === 0
      ? `\n✓ ${etapes.length} vérifications, aucun écart.\n`
      : `\n✗ ${echecs} écart(s) sur ${etapes.length}.\n`,
  )
  process.exit(echecs === 0 ? 0 : 1)
})()
