/**
 * Banc de l'espace locataire — Sikaloc_Me.
 *
 *   supabase start · environnement pointant sur la pile LOCALE
 *   npm run banc:locataire
 *
 * ─── Ce que ce banc cherche à faire échouer ─────────────────────────────────
 *
 * Pas le chemin heureux : la surface d'accès du locataire tourne en
 * `security definer` sous `postgres`, propriétaire des tables. À l'intérieur de
 * ces fonctions, AUCUNE politique RLS ne protège plus rien — la clause `where`
 * est la seule sécurité. Ce banc existe pour vérifier qu'elle tient.
 *
 * Deux bailleurs, trois locataires, et la question posée à chaque ligne :
 * « est-ce que ce compte voit quelque chose qui ne lui appartient pas ? »
 *
 * ─── La leçon de l'étape 2, appliquée ───────────────────────────────────────
 *
 * Le banc des invitations insérait avec la clé de service, qui contourne les
 * droits : il ne testait pas le produit, et a laissé passer un
 * « permission denied » que le premier clic dans un navigateur a trouvé.
 *
 * Ici, TOUTE lecture sous test passe par une session réelle, ouverte avec la
 * clé publique. La clé de service ne sert qu'à préparer le décor et à compter
 * ce qui existe vraiment en base — jamais à interroger ce qu'on prétend tester.
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

/** Une session réelle, comme celle d'un navigateur. */
async function session(email) {
  const client = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: MDP })
  if (error) throw new Error(`connexion ${email} : ${error.message}`)
  return client
}

;(async () => {
  console.log('\nSikaloc_Me : ce qu\'un locataire voit, et surtout ce qu\'il ne voit pas\n')

  const suffixe = Date.now()
  const nouveau = async (prefixe, meta) => {
    const email = `banc-me-${prefixe}-${suffixe}@exemple.test`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: MDP,
      email_confirm: true,
      user_metadata: meta,
    })
    if (error) throw new Error(`${prefixe} : ${error.message}`)
    return { id: data.user.id, email }
  }

  // ═══ Le décor ══════════════════════════════════════════════════════════════
  //
  // Deux bailleurs indépendants. C'est la seule façon de prouver l'isolation :
  // avec un seul bailleur, un filtre absent passerait inaperçu.
  titre('Décor')

  const compteBailleurA = await nouveau('bailleurA', { nom: 'Bailleur A', telephone: '0197000001' })
  const compteBailleurB = await nouveau('bailleurB', { nom: 'Bailleur B', telephone: '0197000002' })
  const compteLoc1 = await nouveau('loc1', { nom: 'Locataire Un', role: 'locataire' })
  const compteLoc2 = await nouveau('loc2', { nom: 'Locataire Deux', role: 'locataire' })

  noter('deux bailleurs et deux comptes locataire créés', true)

  /** Insère et lève si la base refuse : un `null` muet masquerait la cause. */
  const exige = (quoi, { data, error }) => {
    if (error || !data) throw new Error(`${quoi} : ${error?.message ?? 'aucune ligne rendue'}`)
    return data
  }

  const creerDecor = async (bailleurId, marque, loyer) => {
    const logement = exige(`logement ${marque}`, await admin
      .from('logements')
      .insert({
        bailleur_id: bailleurId,
        adresse: `Rue ${marque}`,
        ville: 'Cotonou',
        pays: 'Bénin',
        type: 'Appartement',
      })
      .select('id')
      .single())

    const locataire = exige(`locataire ${marque}`, await admin
      .from('locataires')
      .insert({
        bailleur_id: bailleurId,
        nom: `Locataire ${marque}`,
        telephone: '0190000000',
        consentement_donnees: true,
        date_consentement: '2026-01-01',
      })
      .select('id')
      .single())

    const bail = exige(`bail ${marque}`, await admin
      .from('baux')
      .insert({
        bailleur_id: bailleurId,
        logement_id: logement.id,
        locataire_id: locataire.id,
        loyer_mensuel: loyer,
        date_debut: '2026-01-01',
        jour_echeance: 5,
        tolerance_jours: 3,
        depot_garantie: loyer * 2,
        statut: 'Actif',
      })
      .select('id')
      .single())

    return { logementId: logement.id, locataireId: locataire.id, bailId: bail.id }
  }

  const decorA = await creerDecor(compteBailleurA.id, 'A', 60000)
  const decorB = await creerDecor(compteBailleurB.id, 'B', 90000)

  // Un versement validé chez A, avec sa quittance. Un brouillon aussi : il ne
  // doit JAMAIS apparaître côté locataire.
  const paiementValide = exige('paiement validé A', await admin
    .from('paiements')
    .insert({
      bailleur_id: compteBailleurA.id,
      bail_id: decorA.bailId,
      date_paiement: '2026-02-05',
      montant: 60000,
      periode_debut: '2026-02-01',
      periode_fin: '2026-02-28',
      mode_paiement: 'Mobile Money',
      type_paiement: 'Loyer',
      statut: 'Validé',
      valide_le: new Date().toISOString(),
    })
    .select('id')
    .single())

  const paiementBrouillon = exige('brouillon A', await admin
    .from('paiements')
    .insert({
      bailleur_id: compteBailleurA.id,
      bail_id: decorA.bailId,
      date_paiement: '2026-03-05',
      montant: 60000,
      periode_debut: '2026-03-01',
      periode_fin: '2026-03-31',
      mode_paiement: 'Espèces',
      type_paiement: 'Loyer',
      statut: 'Brouillon',
    })
    .select('id')
    .single())

  // Un loyer déclaré réglé AVANT Sikaloc : date inconnue, aucune quittance.
  await admin.from('paiements').insert({
    bailleur_id: compteBailleurA.id,
    bail_id: decorA.bailId,
    date_paiement: null,
    montant: 60000,
    periode_debut: '2026-01-01',
    periode_fin: '2026-01-31',
    mode_paiement: 'Espèces',
    type_paiement: 'Loyer',
    statut: 'Validé',
    valide_le: new Date().toISOString(),
    historique: true,
  })

  const quittanceA = exige('quittance A', await admin
    .from('quittances')
    .insert({
      bailleur_id: compteBailleurA.id,
      paiement_id: paiementValide.id,
      type: 'Quittance',
      pays: 'Bénin',
      date_generation: new Date('2026-02-06').toISOString(),
    })
    .select('id')
    .single())

  // Chez B, une quittance qui ne regarde personne d'autre.
  const paiementB = exige('paiement B', await admin
    .from('paiements')
    .insert({
      bailleur_id: compteBailleurB.id,
      bail_id: decorB.bailId,
      date_paiement: '2026-02-05',
      montant: 90000,
      periode_debut: '2026-02-01',
      periode_fin: '2026-02-28',
      mode_paiement: 'Virement bancaire',
      type_paiement: 'Loyer',
      statut: 'Validé',
      valide_le: new Date().toISOString(),
    })
    .select('id')
    .single())

  const quittanceB = exige('quittance B', await admin
    .from('quittances')
    .insert({
      bailleur_id: compteBailleurB.id,
      paiement_id: paiementB.id,
      type: 'Quittance',
      pays: 'Bénin',
      date_generation: new Date('2026-02-06').toISOString(),
    })
    .select('id')
    .single())

  noter('deux baux, quatre paiements, deux quittances en place', true)

  // Rattachement : loc1 → locataire de A, loc2 → locataire de B.
  await admin
    .from('locataires')
    .update({ compte_id: compteLoc1.id, compte_lie_le: new Date().toISOString() })
    .eq('id', decorA.locataireId)
  await admin
    .from('locataires')
    .update({ compte_id: compteLoc2.id, compte_lie_le: new Date().toISOString() })
    .eq('id', decorB.locataireId)

  noter('chaque compte locataire est rattaché à sa fiche', true)

  const loc1 = await session(compteLoc1.email)
  const loc2 = await session(compteLoc2.email)
  const bailleurA = await session(compteBailleurA.email)

  // ═══ 1. Le locataire voit le sien ══════════════════════════════════════════
  titre('1. Ce que le locataire voit')

  const { data: bauxLoc1, error: erreurBaux } = await loc1.rpc('mes_baux')
  noter('mes_baux() répond sans erreur', !erreurBaux, erreurBaux?.message)
  comparer('un seul bail rendu', bauxLoc1?.length, 1)
  comparer('c\'est bien le sien', bauxLoc1?.[0]?.bail_id, decorA.bailId)
  comparer('le loyer est celui de son bail', Number(bauxLoc1?.[0]?.loyer_mensuel), 60000)
  comparer('le dépôt de garantie est rendu', Number(bauxLoc1?.[0]?.depot_garantie), 120000)
  comparer('le nom du bailleur est rendu', bauxLoc1?.[0]?.bailleur_nom, 'Bailleur A')
  noter(
    'le téléphone du bailleur est rendu',
    typeof bauxLoc1?.[0]?.bailleur_telephone === 'string' &&
      bauxLoc1[0].bailleur_telephone.length > 0,
  )

  const { data: echLoc1, error: erreurEch } = await loc1.rpc('mes_echeances')
  noter('mes_echeances() répond sans erreur', !erreurEch, erreurEch?.message)
  noter('des échéances sont rendues', (echLoc1?.length ?? 0) > 0, `${echLoc1?.length} mois`)
  comparer(
    'toutes portent sur son bail',
    [...new Set((echLoc1 ?? []).map((e) => e.bail_id))],
    [decorA.bailId],
  )
  comparer(
    'les quatre états sont ceux de v_echeances',
    [...new Set((echLoc1 ?? []).map((e) => e.etat))].every((e) =>
      ['Réglé', 'Impayé', 'À venir', 'À déterminer'].includes(e),
    ),
    true,
  )
  comparer(
    'février est réglé',
    echLoc1?.find((e) => e.periode_debut === '2026-02-01')?.etat,
    'Réglé',
  )
  comparer(
    'janvier, déclaré réglé avant Sikaloc, est Réglé lui aussi',
    echLoc1?.find((e) => e.periode_debut === '2026-01-01')?.etat,
    'Réglé',
  )

  const { data: paieLoc1, error: erreurPaie } = await loc1.rpc('mes_paiements')
  noter('mes_paiements() répond sans erreur', !erreurPaie, erreurPaie?.message)
  comparer('deux versements validés rendus', paieLoc1?.length, 2)
  comparer(
    'le brouillon du bailleur est invisible',
    paieLoc1?.some((p) => p.paiement_id === paiementBrouillon.id),
    false,
  )
  comparer(
    'le paiement historique a une date NULLE, pas une date inventée',
    paieLoc1?.find((p) => p.historique === true)?.date_paiement,
    null,
  )
  comparer(
    'la quittance est rattachée à son versement',
    paieLoc1?.find((p) => p.paiement_id === paiementValide.id)?.quittance_id,
    quittanceA.id,
  )
  comparer(
    'le loyer historique ne porte aucune quittance',
    paieLoc1?.find((p) => p.historique === true)?.quittance_id,
    null,
  )

  const { data: qA } = await loc1.rpc('ma_quittance', { p_quittance_id: quittanceA.id })
  comparer('ma_quittance() rend sa propre quittance', qA?.length, 1)
  comparer('elle n\'est pas signée', qA?.[0]?.signee, false)
  comparer(
    'le chemin du fichier n\'est PAS rendu au navigateur',
    Object.prototype.hasOwnProperty.call(qA?.[0] ?? {}, 'pdf_chemin'),
    false,
  )
  comparer(
    'l\'email du bailleur n\'est PAS rendu',
    Object.prototype.hasOwnProperty.call(bauxLoc1?.[0] ?? {}, 'bailleur_email'),
    false,
  )

  // ═══ 2. Et rien d'autre ════════════════════════════════════════════════════
  titre('2. Ce que le locataire ne voit pas — le cœur du banc')

  const { data: bauxLoc2 } = await loc2.rpc('mes_baux')
  comparer('loc2 voit un bail, et un seul', bauxLoc2?.length, 1)
  comparer('c\'est celui de B, pas celui de A', bauxLoc2?.[0]?.bail_id, decorB.bailId)
  comparer(
    'loc2 ne voit jamais le bail de loc1',
    bauxLoc2?.some((b) => b.bail_id === decorA.bailId),
    false,
  )

  const { data: paieLoc2 } = await loc2.rpc('mes_paiements')
  comparer(
    'loc2 ne voit aucun paiement de loc1',
    paieLoc2?.some((p) => p.bail_id === decorA.bailId),
    false,
  )

  const { data: echLoc2 } = await loc2.rpc('mes_echeances')
  comparer(
    'loc2 ne voit aucune échéance de loc1',
    echLoc2?.some((e) => e.bail_id === decorA.bailId),
    false,
  )

  // La quittance d'un autre, demandée nommément. C'est l'attaque la plus
  // simple : on connaît l'identifiant, on le présente.
  const { data: volee } = await loc1.rpc('ma_quittance', { p_quittance_id: quittanceB.id })
  comparer('la quittance d\'un autre locataire est refusée', volee?.length, 0)

  const { data: voleeInverse } = await loc2.rpc('ma_quittance', {
    p_quittance_id: quittanceA.id,
  })
  comparer('et dans l\'autre sens aussi', voleeInverse?.length, 0)

  const { data: brouillonVole } = await loc1.rpc('ma_quittance', {
    p_quittance_id: quittanceA.id,
  })
  comparer('sa propre quittance reste accessible', brouillonVole?.length, 1)

  // Lecture directe des tables : les RLS d'origine doivent toujours tout fermer.
  for (const [table, libelle] of [
    ['baux', 'baux'],
    ['paiements', 'paiements'],
    ['quittances', 'quittances'],
    ['locataires', 'locataires'],
    ['logements', 'logements'],
    ['bailleurs', 'bailleurs'],
    ['v_echeances', 'v_echeances'],
  ]) {
    const { data } = await loc1.from(table).select('*')
    comparer(`lecture directe de ${libelle} : rien`, data?.length ?? 0, 0)
  }

  // ═══ 2 bis. Un paiement déplacé d'un bail à l'autre ════════════════════════
  //
  // Le scénario, atteignable par le parcours nominal :
  //
  //   1. le bailleur saisit un loyer sur le mauvais bail, et valide
  //      → la quittance est émise pour ce paiement
  //   2. dans la fenêtre de correction de 5 minutes, il déplace le paiement
  //      vers le bon bail → paiements.bail_id = B
  //   3. il revalide, et la régénération réécrit le PDF
  //
  // `quittances` portait jadis sa propre colonne `bail_id`, figée à l'insertion
  // et jamais réécrite : après l'étape 2, elle disait encore A quand le document
  // décrivait B. La migration 20260913000800 l'a retirée — la divergence n'est
  // plus représentable, et ce banc le vérifie d'abord.
  //
  // Le reste du scénario garde tout son sens : le document suit le paiement,
  // donc il change de locataire avec lui.
  titre('2 bis. Un paiement déplacé d\'un bail à l\'autre')

  const paiementDerive = exige('paiement dérivé', await admin
    .from('paiements')
    .insert({
      bailleur_id: compteBailleurA.id,
      bail_id: decorA.bailId,
      date_paiement: '2026-05-05',
      montant: 60000,
      periode_debut: '2026-05-01',
      periode_fin: '2026-05-31',
      mode_paiement: 'Espèces',
      type_paiement: 'Loyer',
      statut: 'Validé',
      valide_le: new Date().toISOString(),
    })
    .select('id')
    .single())

  const quittanceDerivee = exige('quittance dérivée', await admin
    .from('quittances')
    .insert({
      bailleur_id: compteBailleurA.id,
      paiement_id: paiementDerive.id,
      type: 'Quittance',
      pays: 'Bénin',
      date_generation: new Date('2026-05-06').toISOString(),
    })
    .select('id')
    .single())

  // La correction : le paiement change de bail, la quittance ne bouge pas.
  await admin
    .from('paiements')
    .update({ bail_id: decorB.bailId, bailleur_id: compteBailleurB.id })
    .eq('id', paiementDerive.id)

  // La divergence n'a plus de support : demander la colonne est une erreur de
  // schéma, pas une lecture qui rendrait une valeur périmée.
  const { error: eColonneBail } = await admin.from('quittances').select('bail_id').limit(1)
  noter(
    'quittances ne porte plus de bail_id — la dérive est irreprésentable',
    Boolean(eColonneBail),
    eColonneBail?.message,
  )

  // Le seul chemin restant désigne bien le nouveau bail.
  const { data: verif } = await admin
    .from('quittances')
    .select('paiement:paiements(bail_id)')
    .eq('id', quittanceDerivee.id)
    .single()
  comparer(
    'le document désigne le bail corrigé, par son paiement',
    (Array.isArray(verif.paiement) ? verif.paiement[0] : verif.paiement).bail_id,
    decorB.bailId,
  )

  const { data: derivePourLoc1 } = await loc1.rpc('ma_quittance', {
    p_quittance_id: quittanceDerivee.id,
  })
  comparer(
    'le locataire de l\'ancien bail est refusé',
    derivePourLoc1?.length,
    0,
  )

  const { data: derivePourLoc2 } = await loc2.rpc('ma_quittance', {
    p_quittance_id: quittanceDerivee.id,
  })
  comparer(
    'le locataire du bail RÉEL, celui du PDF, y a droit',
    derivePourLoc2?.length,
    1,
  )

  const { data: paieLoc2Derive } = await loc2.rpc('mes_paiements')
  comparer(
    'et mes_paiements() le lui annonce — les deux fonctions s\'accordent',
    paieLoc2Derive?.find((p) => p.paiement_id === paiementDerive.id)?.quittance_id,
    quittanceDerivee.id,
  )

  // ═══ 3. Aucune écriture, nulle part ════════════════════════════════════════
  titre('3. Sikaloc_Me est en lecture seule')

  const { error: eInsert } = await loc1
    .from('paiements')
    .insert({
      bailleur_id: compteBailleurA.id,
      bail_id: decorA.bailId,
      date_paiement: '2026-04-05',
      montant: 60000,
      periode_debut: '2026-04-01',
      periode_fin: '2026-04-30',
      mode_paiement: 'Espèces',
      type_paiement: 'Loyer',
      statut: 'Validé',
      valide_le: new Date().toISOString(),
    })
  const { count: paiementsApres } = await admin
    .from('paiements')
    .select('id', { count: 'exact', head: true })
    .eq('bail_id', decorA.bailId)
    .eq('periode_debut', '2026-04-01')
  // Le message de refus est indicatif ; c'est l'absence de la ligne qui prouve.
  noter('un locataire ne peut pas créer de paiement', Boolean(eInsert), eInsert?.message)
  comparer('et aucune ligne n\'est apparue', paiementsApres, 0)

  const { error: eUpdate } = await loc1
    .from('baux')
    .update({ loyer_mensuel: 1 })
    .eq('id', decorA.bailId)
  const { data: loyerApres } = await admin
    .from('baux')
    .select('loyer_mensuel')
    .eq('id', decorA.bailId)
    .single()
  noter(
    'un locataire ne peut pas baisser son loyer',
    Boolean(eUpdate) || Number(loyerApres.loyer_mensuel) === 60000,
    `loyer resté à ${loyerApres.loyer_mensuel}`,
  )

  const { error: eDelete } = await loc1.from('quittances').delete().eq('id', quittanceA.id)
  const { count: quittancesApres } = await admin
    .from('quittances')
    .select('id', { count: 'exact', head: true })
    .eq('id', quittanceA.id)
  noter(
    'un locataire ne peut pas supprimer une quittance',
    Boolean(eDelete) || quittancesApres === 1,
  )

  const { error: ePrive } = await loc1.rpc('fiches_du_compte')
  noter('la fonction de frontière n\'est pas exposée', Boolean(ePrive), ePrive?.message)

  // ═══ 4. Le bailleur n'a rien perdu ═════════════════════════════════════════
  titre('4. Le bailleur voit toujours exactement ce qu\'il voyait')

  const { data: bauxBailleur } = await bailleurA.from('baux').select('id')
  comparer('le bailleur A lit son bail', bauxBailleur?.length, 1)

  const { data: paieBailleur } = await bailleurA.from('paiements').select('id, statut')
  // Trois paiements créés chez A, plus celui de la dérive ; ce dernier a été
  // déplacé chez B, il n'en reste donc bien trois.
  comparer('il lit ses trois paiements, brouillon compris', paieBailleur?.length, 3)
  comparer(
    'y compris le brouillon',
    paieBailleur?.some((p) => p.statut === 'Brouillon'),
    true,
  )

  // Deux : celle de février, et celle de la section « dérive ». Cette dernière
  // garde `bailleur_id = A` — seul le PAIEMENT a été déplacé chez B. C'est
  // précisément la dérive que la section 2 bis met en scène.
  const { data: quittBailleur } = await bailleurA.from('quittances').select('id')
  comparer('il lit ses deux quittances', quittBailleur?.length, 2)

  const { data: echBailleur } = await bailleurA.from('v_echeances').select('bail_id')
  noter('il lit ses échéances', (echBailleur?.length ?? 0) > 0, `${echBailleur?.length} mois`)

  const { data: bauxAutre } = await bailleurA.from('baux').select('id').eq('id', decorB.bailId)
  comparer('et toujours rien de son confrère', bauxAutre?.length, 0)

  // Un bailleur n'est pas locataire : les fonctions de Me ne lui rendent rien.
  const { data: bauxMeBailleur } = await bailleurA.rpc('mes_baux')
  comparer('mes_baux() ne rend rien à un bailleur', bauxMeBailleur?.length, 0)

  // ═══ 5. Sans session ═══════════════════════════════════════════════════════
  titre('5. Sans session')

  const anonyme = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { error: eAnon } = await anonyme.rpc('mes_baux')
  noter('anon ne peut pas exécuter mes_baux()', Boolean(eAnon), eAnon?.message)
  const { error: eAnonQ } = await anonyme.rpc('ma_quittance', { p_quittance_id: quittanceA.id })
  noter('anon ne peut pas exécuter ma_quittance()', Boolean(eAnonQ), eAnonQ?.message)

  // ═══ 6. Le cas des deux bailleurs pour une même personne ═══════════════════
  //
  // `locataires.compte_id` n'est pas unique à dessein : la même personne peut
  // louer à deux bailleurs. Elle doit alors voir SES DEUX baux — et toujours
  // rien d'autre.
  titre('6. Une personne, deux bailleurs')

  await admin
    .from('locataires')
    .update({ compte_id: compteLoc1.id, compte_lie_le: new Date().toISOString() })
    .eq('id', decorB.locataireId)

  const loc1bis = await session(compteLoc1.email)
  const { data: bauxDeux } = await loc1bis.rpc('mes_baux')
  comparer('elle voit désormais ses deux baux', bauxDeux?.length, 2)
  comparer(
    'les deux lui appartiennent',
    (bauxDeux ?? []).map((b) => b.bail_id).sort(),
    [decorA.bailId, decorB.bailId].sort(),
  )

  // Quatre : les deux versements validés de A, celui de B, et le paiement
  // dérivé — qui vit désormais sur le bail de B, donc lui revient.
  const { data: paieDeux } = await loc1bis.rpc('mes_paiements')
  comparer('et les paiements des deux', paieDeux?.length, 4)

  const { data: qDeux } = await loc1bis.rpc('ma_quittance', { p_quittance_id: quittanceB.id })
  comparer('la quittance de son second bailleur lui est maintenant rendue', qDeux?.length, 1)

  // ═══ Ménage ════════════════════════════════════════════════════════════════
  for (const compte of [compteLoc1, compteLoc2, compteBailleurA, compteBailleurB]) {
    await admin.auth.admin.deleteUser(compte.id).catch(() => {})
  }

  const reussis = etapes.filter(Boolean).length
  console.log(`\n${reussis}/${etapes.length} vérifications passent\n`)
  process.exit(reussis === etapes.length ? 0 : 1)
})().catch((erreur) => {
  console.error('\nBanc interrompu :', erreur.message, '\n')
  process.exit(1)
})
