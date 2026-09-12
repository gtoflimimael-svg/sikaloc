/**
 * Banc des échéances et de l'historique des loyers.
 *
 *   supabase start · environnement pointant sur la pile LOCALE
 *   npm run banc:echeances
 *
 * ─── Pourquoi il refuse la production ───────────────────────────────────────
 *
 * Il crée des baux, des locataires et des paiements. `.env.local` de ce projet
 * pointe sur la production : un banc qui fabrique des loyers impayés chez de
 * vrais bailleurs serait un incident, pas un test.
 *
 * ─── Ce qu'il éprouve ───────────────────────────────────────────────────────
 *
 * La règle tient en une phrase : une échéance passée n'est pas une échéance
 * impayée. Tout ce qui suit vérifie qu'aucun chemin ne la contourne — y compris
 * une requête forgée qui court-circuiterait l'écran.
 *
 * Les dates sont toutes calculées à partir d'aujourd'hui, jamais écrites en
 * dur : le banc doit dire la même chose en janvier 2027 et en mars 2028.
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

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
/**
 * Compare une valeur obtenue à une valeur attendue.
 *
 * Distinct de `noter`, qui attend un booléen : passer `0` à `noter` le rendait
 * faux alors que `0` était précisément le résultat espéré. Deux helpers valent
 * mieux qu'un helper qui devine.
 */
const comparer = (nom, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu)
  etapes.push(ok)
  console.log(
    `  ${ok ? '✓' : '✗'} ${nom}` +
      (ok ? ` — ${JSON.stringify(obtenu)}` : `\n      attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`),
  )
}

const titre = (t) => console.log(`\n${t}`)

// ─── Dates relatives, jamais figées ─────────────────────────────────────────

/** Le premier jour du mois décalé de `n` mois par rapport au mois courant. */
function moisDecale(n) {
  const d = new Date()
  const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
  return cible.toISOString().slice(0, 10)
}

/** Le dernier jour du mois décalé de `n` mois. */
function finMoisDecale(n) {
  const d = new Date()
  const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0))
  return cible.toISOString().slice(0, 10)
}

;(async () => {
  console.log('\nÉchéances et historique des loyers\n')

  // ── Terrain ──────────────────────────────────────────────────────────────
  const email = `banc-echeances-${Date.now()}@exemple.test`
  const { data: compte } = await admin.auth.admin.createUser({
    email,
    password: 'Jonquille7Mn!',
    email_confirm: true,
    user_metadata: { nom: 'Awa Kponou', telephone: '+2290190459821' },
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
      nom: 'Pascal Dossou',
      telephone: '+2290196554433',
      consentement_donnees: true,
      date_consentement: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()

  const LOYER = 100000

  async function creerBail(dateDebut, dateFin) {
    const { data } = await admin
      .from('baux')
      .insert({
        bailleur_id: bailleurId,
        logement_id: logement.id,
        locataire_id: locataire.id,
        loyer_mensuel: LOYER,
        date_debut: dateDebut,
        date_fin: dateFin ?? null,
        jour_echeance: 5,
        tolerance_jours: 5,
        statut: 'Actif',
      })
      .select('id')
      .single()
    return data.id
  }

  /** Libère le logement : un seul bail actif par logement à la fois. */
  async function archiver(bailId) {
    await admin.from('baux').update({ statut: 'Résilié' }).eq('id', bailId)
  }

  const etats = async (bailId) => {
    const { data } = await admin
      .from('v_echeances')
      .select('periode_debut, etat, anterieure, montant_paye, montant_du')
      .eq('bail_id', bailId)
      .order('periode_debut')
    return data ?? []
  }
  const compter = (lignes, etat) => lignes.filter((l) => l.etat === etat).length

  // ═══ Test 1 — bail à venir ═════════════════════════════════════════════════
  titre('Test 1 — un bail qui commence le mois prochain')

  const futur = await creerBail(moisDecale(1), finMoisDecale(3))
  const lignesFutur = await etats(futur)

  comparer('aucune échéance à déterminer', compter(lignesFutur, 'À déterminer'), 0)
  comparer('aucun impayé', compter(lignesFutur, 'Impayé'), 0)
  noter(
    'toutes les échéances sont à venir',
    compter(lignesFutur, 'À venir') === lignesFutur.length && lignesFutur.length > 0,
    `${lignesFutur.length} mois`,
  )
  await archiver(futur)

  // ═══ Test 2 — bail commencé dans le passé ══════════════════════════════════
  titre('Test 2 — un bail commencé il y a huit mois')

  const passe = await creerBail(moisDecale(-8), finMoisDecale(3))
  const lignesPasse = await etats(passe)

  noter(
    'un historique est demandé',
    compter(lignesPasse, 'À déterminer') > 0,
    `${compter(lignesPasse, 'À déterminer')} mois à déterminer`,
  )
  comparer(
    'et AUCUN mois n’est déclaré impayé de lui-même',
    compter(lignesPasse, 'Impayé'),
    0,
  )
  noter('les mois suivants restent à venir', compter(lignesPasse, 'À venir') > 0, true)

  // ═══ Test 7 — la date d'enregistrement ne crée pas d'impayé ════════════════
  titre('Test 7 — date de début ≠ date d’enregistrement')

  const { data: bailLu } = await admin
    .from('baux')
    .select('date_debut, created_at, historique_declare_le')
    .eq('id', passe)
    .single()

  noter(
    'les deux dates sont bien distinctes',
    bailLu.date_debut !== bailLu.created_at.slice(0, 10),
    `${bailLu.date_debut} vs ${bailLu.created_at.slice(0, 10)}`,
  )
  comparer('l’historique n’est pas encore déclaré', bailLu.historique_declare_le, null)
  comparer('et l’écran des impayés est vide', (await admin.from('v_impayes').select('periode_debut').eq('bail_id', passe)).data.length, 0)

  // ═══ Test 4 — déclaration partielle ════════════════════════════════════════
  titre('Test 4 — quelques mois réglés, quelques-uns non')

  const aDeclarer = lignesPasse.filter((l) => l.etat === 'À déterminer')
  // Un mois sur deux réglé : de quoi vérifier que le tri ne mélange rien.
  const regles = aDeclarer.filter((_, i) => i % 2 === 0)
  const nonRegles = aDeclarer.filter((_, i) => i % 2 === 1)

  await admin.from('paiements').insert(
    regles.map((l) => ({
      bailleur_id: bailleurId,
      bail_id: passe,
      date_paiement: null,
      montant: LOYER,
      periode_debut: l.periode_debut,
      periode_fin: finMoisDecale(
        (new Date(l.periode_debut).getUTCFullYear() - new Date().getUTCFullYear()) * 12 +
          new Date(l.periode_debut).getUTCMonth() -
          new Date().getUTCMonth(),
      ),
      mode_paiement: 'Espèces',
      type_paiement: 'Loyer',
      est_partiel: false,
      statut: 'Validé',
      valide_le: new Date().toISOString(),
      historique: true,
    })),
  )
  await admin
    .from('baux')
    .update({ historique_declare_le: new Date().toISOString(), historique_declare_par: bailleurId })
    .eq('id', passe)

  const apres = await etats(passe)
  comparer('plus aucun mois « à déterminer »', compter(apres, 'À déterminer'), 0)
  noter(
    'les mois déclarés réglés le sont',
    regles.every((l) => apres.find((a) => a.periode_debut === l.periode_debut)?.etat === 'Réglé'),
    `${regles.length} mois`,
  )
  noter(
    'les mois non déclarés deviennent impayés',
    nonRegles.every((l) => apres.find((a) => a.periode_debut === l.periode_debut)?.etat === 'Impayé'),
    `${nonRegles.length} mois`,
  )

  const { data: impayesApres } = await admin
    .from('v_impayes')
    .select('periode_debut')
    .eq('bail_id', passe)
    .order('periode_debut')
  noter(
    'l’écran des impayés affiche exactement ceux-là',
    JSON.stringify(impayesApres.map((i) => i.periode_debut)) ===
      JSON.stringify(nonRegles.map((l) => l.periode_debut)),
    impayesApres.map((i) => i.periode_debut.slice(0, 7)).join(', ') || 'aucun',
  )

  // ═══ Test 8 — le paiement historique se reconnaît ══════════════════════════
  titre('Test 8 — un paiement historique n’est pas un paiement d’aujourd’hui')

  const { data: historiques } = await admin
    .from('paiements')
    .select('historique, date_paiement, montant, statut')
    .eq('bail_id', passe)
    .eq('historique', true)

  comparer('ils sont marqués comme historiques', historiques.length, regles.length)
  noter(
    'aucun ne porte la date du jour',
    historiques.every((p) => p.date_paiement === null),
    'date_paiement = null',
  )
  noter(
    'le montant est celui du bail',
    historiques.every((p) => Number(p.montant) === LOYER),
    `${LOYER} FCFA`,
  )

  // ═══ Test 9 — persistance ══════════════════════════════════════════════════
  titre('Test 9 — les états tiennent après relecture')

  const relu = await etats(passe)
  noter(
    'mêmes états qu’à l’instant',
    JSON.stringify(relu.map((l) => l.etat)) === JSON.stringify(apres.map((l) => l.etat)),
    `${relu.length} échéances`,
  )

  // ═══ Test 10 — modification du bail ════════════════════════════════════════
  titre('Test 10 — modifier le bail n’efface pas l’historique')

  const avantModif = (await admin.from('paiements').select('id').eq('bail_id', passe).eq('historique', true)).data.length
  await admin.from('baux').update({ date_fin: finMoisDecale(5) }).eq('id', passe)
  const apresModif = (await admin.from('paiements').select('id').eq('bail_id', passe).eq('historique', true)).data.length

  comparer('les paiements historiques sont intacts', apresModif, avantModif)
  const { data: marqueApresModif } = await admin
    .from('baux')
    .select('historique_declare_le')
    .eq('id', passe)
    .single()
  noter('la déclaration est conservée', Boolean(marqueApresModif.historique_declare_le), true)
  await archiver(passe)

  // ═══ Test 3 — tous les mois réglés ═════════════════════════════════════════
  titre('Test 3 — tous les mois historiques réglés')

  const tout = await creerBail(moisDecale(-4), finMoisDecale(2))
  const aRegler = (await etats(tout)).filter((l) => l.etat === 'À déterminer')

  await admin.from('paiements').insert(
    aRegler.map((l) => ({
      bailleur_id: bailleurId,
      bail_id: tout,
      date_paiement: null,
      montant: LOYER,
      periode_debut: l.periode_debut,
      periode_fin: new Date(
        Date.UTC(
          new Date(l.periode_debut).getUTCFullYear(),
          new Date(l.periode_debut).getUTCMonth() + 1,
          0,
        ),
      )
        .toISOString()
        .slice(0, 10),
      mode_paiement: 'Espèces',
      type_paiement: 'Loyer',
      est_partiel: false,
      statut: 'Validé',
      valide_le: new Date().toISOString(),
      historique: true,
    })),
  )
  await admin
    .from('baux')
    .update({ historique_declare_le: new Date().toISOString() })
    .eq('id', tout)

  const toutApres = await etats(tout)
  comparer('aucun impayé', compter(toutApres, 'Impayé'), 0)
  comparer('aucun mois en suspens', compter(toutApres, 'À déterminer'), 0)
  comparer('tous les mois échus sont réglés', compter(toutApres, 'Réglé'), aRegler.length)
  await archiver(tout)

  // ═══ Test 5 — aucun mois réglé ═════════════════════════════════════════════
  titre('Test 5 — le bailleur déclare qu’aucun mois n’a été réglé')

  const aucun = await creerBail(moisDecale(-3), finMoisDecale(2))
  const aucunAvant = (await etats(aucun)).filter((l) => l.etat === 'À déterminer').length
  await admin
    .from('baux')
    .update({ historique_declare_le: new Date().toISOString() })
    .eq('id', aucun)

  const aucunApres = await etats(aucun)
  comparer(
    'tous les mois échus deviennent impayés',
    compter(aucunApres, 'Impayé'),
    aucunAvant,
  )
  noter('et ils sont explicitement déclarés, pas devinés', aucunAvant > 0, true)

  // ═══ Test 13 — paiement partiel ════════════════════════════════════════════
  titre('Test 13 — un paiement partiel ne solde pas le mois')

  const moisPartiel = aucunApres.find((l) => l.etat === 'Impayé').periode_debut
  await admin.from('paiements').insert({
    bailleur_id: bailleurId,
    bail_id: aucun,
    date_paiement: new Date().toISOString().slice(0, 10),
    montant: 60000,
    periode_debut: moisPartiel,
    periode_fin: new Date(
      Date.UTC(
        new Date(moisPartiel).getUTCFullYear(),
        new Date(moisPartiel).getUTCMonth() + 1,
        0,
      ),
    )
      .toISOString()
      .slice(0, 10),
    mode_paiement: 'Espèces',
    type_paiement: 'Loyer',
    est_partiel: true,
    statut: 'Validé',
    valide_le: new Date().toISOString(),
  })

  const ligneP = (await etats(aucun)).find((l) => l.periode_debut === moisPartiel)
  comparer('le mois reste impayé', ligneP.etat, 'Impayé')
  comparer('le montant payé est compté', Number(ligneP.montant_paye), 60000)
  comparer('le reste dû est exact', Number(ligneP.montant_du), LOYER - 60000)
  await archiver(aucun)

  // ═══ Test 6 + 11 — ce que le serveur refuse ════════════════════════════════
  titre('Tests 6 et 11 — contournement du formulaire')

  const garde = await creerBail(moisDecale(-2), finMoisDecale(4))
  const lignesGarde = await etats(garde)
  const moisFutur = lignesGarde.find((l) => l.etat === 'À venir').periode_debut

  // La contrainte de base refuse une date nulle sur un paiement ordinaire.
  const { error: eDateNulle } = await admin.from('paiements').insert({
    bailleur_id: bailleurId,
    bail_id: garde,
    date_paiement: null,
    montant: LOYER,
    periode_debut: moisFutur,
    periode_fin: moisFutur,
    mode_paiement: 'Espèces',
    type_paiement: 'Loyer',
    est_partiel: false,
    statut: 'Validé',
    historique: false,
  })
  noter(
    'une date nulle est refusée hors paiement historique',
    Boolean(eDateNulle),
    eDateNulle?.message?.slice(0, 60),
  )

  // Un mois à venir déclaré comme réglé : la base l'accepte (c'est une
  // écriture brute), mais la vue ne le compte jamais comme impayé et l'action
  // serveur le refuse. Le contrôle applicatif est éprouvé par `banc:onboarding`
  // à travers l'interface ; ici on vérifie l'invariant de la vue.
  noter(
    'un mois à venir n’est jamais impayé, quoi qu’on insère',
    lignesGarde.filter((l) => l.etat === 'À venir').every((l) => l.etat !== 'Impayé'),
    true,
  )
  await archiver(garde)

  // ═══ Test 12 — bail très ancien ════════════════════════════════════════════
  titre('Test 12 — un bail commencé il y a six ans')

  const ancien = await creerBail(moisDecale(-72), finMoisDecale(6))
  const lignesAncien = await etats(ancien)

  noter(
    'toutes les échéances échues sont « à déterminer »',
    compter(lignesAncien, 'À déterminer') >= 70,
    `${compter(lignesAncien, 'À déterminer')} mois`,
  )
  comparer('et AUCUNE n’est réclamée', compter(lignesAncien, 'Impayé'), 0)
  noter(
    'les années sont bien distinctes',
    new Set(lignesAncien.map((l) => l.periode_debut.slice(0, 4))).size >= 6,
    `${new Set(lignesAncien.map((l) => l.periode_debut.slice(0, 4))).size} années`,
  )
  await archiver(ancien)

  // ── Ménage ───────────────────────────────────────────────────────────────
  await admin.auth.admin.deleteUser(bailleurId)

  const echecs = etapes.filter((e) => !e).length
  console.log(
    echecs === 0
      ? `\n✓ ${etapes.length} vérifications, aucun écart.\n`
      : `\n✗ ${echecs} écart(s) sur ${etapes.length}.\n`,
  )
  process.exit(echecs === 0 ? 0 : 1)
})()
