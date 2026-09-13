/**
 * Banc des notifications — et de la seule écriture de Sikaloc_Me.
 *
 *   supabase start
 *   set -a && . ./.env.development.local && set +a && npm run banc:notifications
 *
 * ─── Ce que ce banc cherche à faire échouer ─────────────────────────────────
 *
 * L'étape 4 ouvre une porte que l'étape 3 avait volontairement laissée fermée :
 * `definir_mes_notifications` écrit dans `public.locataires`. Une porte
 * d'écriture dans un espace jusque-là en lecture seule mérite qu'on essaie de
 * la pousser plus loin qu'elle ne va.
 *
 * Trois questions, dans l'ordre :
 *
 *   1. le réglage fait-il ce qu'il dit, pour celui qui le pose ?
 *   2. touche-t-il la fiche de quelqu'un d'autre ?
 *   3. ouvre-t-il, par ricochet, l'accès à autre chose dans `locataires` ?
 *
 * Comme le banc de l'étape 3, TOUTE opération sous test passe par une session
 * réelle ouverte avec la clé publique. La clé de service ne sert qu'au décor et
 * au constat.
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
const MDP = 'Jonquille7Mn!'

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
/** Comparaison explicite : `noter(nom, 0)` échouerait là où 0 est la bonne réponse. */
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
const exige = (quoi, { data, error }) => {
  if (error || !data) throw new Error(`${quoi} : ${error?.message ?? 'aucune ligne rendue'}`)
  return data
}

async function session(email) {
  const client = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: MDP })
  if (error) throw new Error(`connexion ${email} : ${error.message}`)
  return client
}

;(async () => {
  console.log('\nNotifications : le réglage du locataire, et rien de plus\n')

  const suffixe = Date.now()
  const nouveau = async (prefixe, meta) => {
    const email = `banc-notif-${prefixe}-${suffixe}@exemple.test`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: MDP,
      email_confirm: true,
      user_metadata: meta,
    })
    if (error) throw new Error(`${prefixe} : ${error.message}`)
    return { id: data.user.id, email }
  }

  // ═══ Décor ═════════════════════════════════════════════════════════════════
  titre('Décor')

  const cptBailleur = await nouveau('bailleur', { nom: 'Bailleur N', telephone: '0197000011' })
  const cptLoc1 = await nouveau('loc1', { nom: 'Locataire Un', role: 'locataire' })
  const cptLoc2 = await nouveau('loc2', { nom: 'Locataire Deux', role: 'locataire' })

  const logement = exige(
    'logement',
    await admin
      .from('logements')
      .insert({
        bailleur_id: cptBailleur.id,
        adresse: 'Rue N',
        ville: 'Cotonou',
        pays: 'Bénin',
        type: 'Studio',
      })
      .select('id')
      .single(),
  )

  const creerLocataire = async (nom, compteId) =>
    exige(
      `locataire ${nom}`,
      await admin
        .from('locataires')
        .insert({
          bailleur_id: cptBailleur.id,
          nom,
          telephone: '0190000001',
          email: `${nom.toLowerCase()}-${suffixe}@exemple.test`,
          consentement_donnees: true,
          date_consentement: '2026-01-01',
          compte_id: compteId,
          compte_lie_le: new Date().toISOString(),
        })
        .select('id, notif_email')
        .single(),
    )

  const locA = await creerLocataire('Alice', cptLoc1.id)
  const locB = await creerLocataire('Bob', cptLoc2.id)

  noter('deux locataires rattachés à deux comptes distincts', true)
  comparer('la préférence naît à « oui »', [locA.notif_email, locB.notif_email], [true, true])

  const loc1 = await session(cptLoc1.email)
  const loc2 = await session(cptLoc2.email)
  const bailleur = await session(cptBailleur.email)

  // ═══ 1. Le réglage fait ce qu'il dit ═══════════════════════════════════════
  titre('1. Le réglage, pour celui qui le pose')

  const { data: pref1, error: ePref } = await loc1.rpc('mes_preferences')
  noter('mes_preferences() répond', !ePref, ePref?.message)
  comparer('et dit « oui » au départ', pref1?.[0]?.notif_email, true)

  const { error: eCoupe } = await loc1.rpc('definir_mes_notifications', { p_actif: false })
  noter('Alice peut couper ses emails', !eCoupe, eCoupe?.message)

  const { data: apres } = await admin
    .from('locataires')
    .select('notif_email')
    .eq('id', locA.id)
    .single()
  comparer('la base a bien enregistré le refus', apres.notif_email, false)

  const { data: pref1bis } = await loc1.rpc('mes_preferences')
  comparer('et l’écran le relit', pref1bis?.[0]?.notif_email, false)

  const { error: eRallume } = await loc1.rpc('definir_mes_notifications', { p_actif: true })
  noter('elle peut revenir en arrière', !eRallume, eRallume?.message)
  const { data: apres2 } = await admin
    .from('locataires')
    .select('notif_email')
    .eq('id', locA.id)
    .single()
  comparer('la base suit', apres2.notif_email, true)

  // ═══ 2. Et surtout : rien d'autre ══════════════════════════════════════════
  titre('2. Ce que la porte d’écriture ne permet PAS')

  await loc1.rpc('definir_mes_notifications', { p_actif: false })
  const { data: bobIntact } = await admin
    .from('locataires')
    .select('notif_email')
    .eq('id', locB.id)
    .single()
  comparer('couper ses emails ne touche pas la fiche de Bob', bobIntact.notif_email, true)

  // La fonction ne prend aucun identifiant : il n'y a rien à falsifier. On
  // vérifie qu'aucune signature alternative n'a été laissée ouverte.
  const { error: eFalsifie } = await loc1.rpc('definir_mes_notifications', {
    p_actif: false,
    p_locataire_id: locB.id,
  })
  noter(
    'aucune variante acceptant un identifiant de cible n’existe',
    Boolean(eFalsifie),
    eFalsifie?.message?.slice(0, 60),
  )

  // Le vrai risque d'un `grant update` : la porte n'en est pas un.
  const { error: eNom } = await loc1
    .from('locataires')
    .update({ nom: 'Nom détourné' })
    .eq('id', locA.id)
  const { data: nomApres } = await admin
    .from('locataires')
    .select('nom')
    .eq('id', locA.id)
    .single()
  noter(
    'un locataire ne peut pas réécrire son propre nom',
    Boolean(eNom) || nomApres.nom === 'Alice',
    `nom resté « ${nomApres.nom} »`,
  )

  const { error: eDetache } = await loc1
    .from('locataires')
    .update({ compte_id: cptLoc2.id })
    .eq('id', locB.id)
  const { data: rattachementB } = await admin
    .from('locataires')
    .select('compte_id')
    .eq('id', locB.id)
    .single()
  noter(
    'ni s’accrocher à la fiche d’un autre',
    Boolean(eDetache) || rattachementB.compte_id === cptLoc2.id,
  )

  const { data: lectureDirecte } = await loc1.from('locataires').select('*')
  comparer('la table reste illisible en direct', lectureDirecte?.length ?? 0, 0)

  const { error: ePriveFiches } = await loc1.rpc('fiches_du_compte')
  noter('la fonction de frontière reste fermée', Boolean(ePriveFiches))

  // ═══ 3. Le bailleur n'a rien gagné ni perdu ════════════════════════════════
  titre('3. Côté bailleur')

  const { data: sesLocataires } = await bailleur.from('locataires').select('id, notif_email')
  comparer('il lit ses deux locataires', sesLocataires?.length, 2)
  comparer(
    'et voit le refus d’Alice, ce qui lui évite un envoi inutile',
    sesLocataires?.find((l) => l.id === locA.id)?.notif_email,
    false,
  )

  const { data: prefBailleur } = await bailleur.rpc('mes_preferences')
  comparer('mes_preferences() ne rend rien à un bailleur', prefBailleur?.[0]?.notif_email, true)

  // Un bailleur qui appellerait la fonction n'a aucune fiche : rien ne bouge.
  await bailleur.rpc('definir_mes_notifications', { p_actif: false })
  const { data: inchange } = await admin
    .from('locataires')
    .select('id, notif_email')
    .eq('bailleur_id', cptBailleur.id)
  comparer(
    'et l’appeler depuis un compte bailleur ne touche aucune fiche',
    inchange.map((l) => l.notif_email).sort(),
    [false, true],
  )

  // ═══ 4. Sans session ═══════════════════════════════════════════════════════
  titre('4. Sans session')

  const anonyme = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { error: eAnonLire } = await anonyme.rpc('mes_preferences')
  noter('anon ne lit pas les préférences', Boolean(eAnonLire), eAnonLire?.message)
  const { error: eAnonEcrire } = await anonyme.rpc('definir_mes_notifications', { p_actif: false })
  noter('anon n’écrit pas les préférences', Boolean(eAnonEcrire), eAnonEcrire?.message)

  // ═══ 5. Deux fiches, un seul réglage ═══════════════════════════════════════
  //
  // Une même personne peut louer à deux bailleurs. Son refus doit valoir pour
  // les deux : le contraire l'obligerait à le redire autant de fois qu'elle a
  // de bailleurs, ce qu'elle ne peut même pas deviner.
  titre('5. Une personne, deux bailleurs, un seul refus')

  const cptBailleur2 = await nouveau('bailleur2', { nom: 'Bailleur P', telephone: '0197000022' })
  const secondeFiche = exige(
    'seconde fiche',
    await admin
      .from('locataires')
      .insert({
        bailleur_id: cptBailleur2.id,
        nom: 'Alice',
        telephone: '0190000001',
        email: `alice2-${suffixe}@exemple.test`,
        consentement_donnees: true,
        date_consentement: '2026-01-01',
        compte_id: cptLoc1.id,
        compte_lie_le: new Date().toISOString(),
      })
      .select('id, notif_email')
      .single(),
  )
  comparer('la nouvelle fiche naît à « oui »', secondeFiche.notif_email, true)

  const loc1ter = await session(cptLoc1.email)
  const { data: prefDeux } = await loc1ter.rpc('mes_preferences')
  comparer(
    'bool_and : une seule fiche à « non » suffit à dire « non »',
    prefDeux?.[0]?.notif_email,
    false,
  )

  await loc1ter.rpc('definir_mes_notifications', { p_actif: false })
  const { data: lesDeux } = await admin
    .from('locataires')
    .select('notif_email')
    .eq('compte_id', cptLoc1.id)
  comparer(
    'et un seul geste coupe les deux fiches',
    lesDeux.map((l) => l.notif_email),
    [false, false],
  )

  comparer(
    'la fiche de Bob n’a toujours pas bougé',
    (await admin.from('locataires').select('notif_email').eq('id', locB.id).single()).data
      .notif_email,
    true,
  )

  // ═══ Ménage ════════════════════════════════════════════════════════════════
  for (const compte of [cptLoc1, cptLoc2, cptBailleur, cptBailleur2]) {
    await admin.auth.admin.deleteUser(compte.id).catch(() => {})
  }
  void logement

  const reussis = etapes.filter(Boolean).length
  console.log(`\n${reussis}/${etapes.length} vérifications passent\n`)
  process.exit(reussis === etapes.length ? 0 : 1)
})().catch((erreur) => {
  console.error('\nBanc interrompu :', erreur.message, '\n')
  process.exit(1)
})
