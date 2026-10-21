/**
 * Banc de la vitrine publique — Sikaloc_Find, S2.
 *
 *   supabase start · environnement pointant sur la pile LOCALE
 *   npm run banc:annonces-publiques
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 * La frontière entre ce qu'un bailleur écrit et ce qu'un visiteur lit.
 *
 *   1. Un visiteur n'atteint aucune table : seulement trois fonctions.
 *   2. Ces fonctions ne rendent que des annonces publiées — jamais un
 *      brouillon, une annonce suspendue ou clôturée.
 *   3. Elles rendent EXACTEMENT les colonnes prévues. Le contrôle porte sur
 *      les noms des colonnes, pas seulement sur les valeurs : une colonne
 *      ajoutée demain à la fonction ferait échouer ce banc avant d'atteindre
 *      un visiteur.
 *   4. Aucune valeur privée — identifiants, adresse, email, téléphone, nom
 *      complet — n'apparaît nulle part dans les réponses, cherchée dans le
 *      texte brut de chaque réponse.
 *   5. La réponse ne dépend pas de l'appelant : visiteur, bailleur A et
 *      bailleur B voient la même vitrine, et A n'y voit pas ses brouillons.
 */
const { randomUUID } = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')

const { exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

exigerPileLocale('Ce banc')

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const MDP = 'Jonquille7Mn!'
const ADRESSE = 'Lot 7, derrière la pharmacie Houénoussou'

/** Les colonnes publiques, et elles seules, dans l'ordre de la fonction. */
const COLONNES_ANNONCE = [
  'reference',
  'type',
  'ville',
  'quartier',
  'chambres',
  'surface_m2',
  'loyer',
  'charges',
  'depot_garantie',
  'avance_mois',
  'equipements',
  'description',
  'disponible_le',
  'publiee_le',
  // S5 : la photo principale, décrite sans son chemin.
  'photo_position',
  'photo_largeur',
  'photo_hauteur',
]
const COLONNES_PROFIL = ['nom_affiche', 'telephone_verifie']

/** Des noms qui ne doivent JAMAIS apparaître comme clé d'une réponse publique. */
const CLES_INTERDITES = [
  'id',
  'bailleur_id',
  'logement_id',
  'adresse',
  'telephone',
  'email',
  'nom',
  'statut',
  'motif_cloture',
  'cloturee_le',
  'created_at',
  'mis_a_jour_le',
  'loyer_mensuel',
  'locataire_id',
  'bail_id',
  'montant',
  'photo_chemin',
  'signature_chemin',
  'code_parrainage',
  'plan',
  'telephone_canal_verification',
  'telephone_verifie_le',
]

const comptes = []
const secrets = [ADRESSE]

async function creerBailleur(cle, nom) {
  const email = `banc-vitrine-${cle}-${Date.now()}@exemple.test`
  const telephone = `+22901${String(Date.now()).slice(-8)}`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom, telephone },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user.id)
  secrets.push(data.user.id, email)
  // Le nom complet est un secret dès qu'il compte plusieurs mots. Un nom d'un
  // seul mot est rendu tel quel, par choix : il n'y a rien à réduire.
  if (/\s/.test(nom.trim())) secrets.push(nom.trim().replace(/\s+/g, ' '), nom.trim())

  const client = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { error: e } = await client.auth.signInWithPassword({ email, password: MDP })
  if (e) throw new Error(`${cle} : ${e.message}`)

  const { data: ligne } = await admin.from('bailleurs').select('telephone').eq('id', data.user.id).single()
  secrets.push(ligne.telephone)
  return { id: data.user.id, db: client }
}

/** Une annonce du bailleur `b`, amenée jusqu'au statut voulu par sa session. */
async function annonce(b, statut, champs = {}) {
  const { data: logement, error: eL } = await b.db
    .from('logements')
    .insert({ bailleur_id: b.id, adresse: ADRESSE, type: 'Appartement', ville: 'Cotonou' })
    .select()
    .single()
  if (eL) throw new Error(`logement : ${eL.message}`)
  secrets.push(logement.id)

  const { data: a, error: eA } = await b.db
    .from('annonces')
    .insert({
      bailleur_id: b.id,
      logement_id: logement.id,
      type: 'Appartement',
      ville: 'Cotonou',
      quartier: 'Fidjrossè',
      chambres: 2,
      surface_m2: 60,
      loyer: 85000,
      charges: 5000,
      depot_garantie: 170000,
      avance_mois: 3,
      equipements: ['eau_courante', 'electricite', 'compteur_electrique_individuel'],
      description: 'Deux chambres salon, carrelé, cour commune calme, proche du goudron.',
      ...champs,
    })
    .select()
    .single()
  if (eA) throw new Error(`annonce : ${eA.message}`)
  secrets.push(a.id)

  if (statut === 'brouillon') return a

  const { error: eP } = await b.db.from('annonce_photos').insert({
    annonce_id: a.id,
    bailleur_id: b.id,
    chemin: `${b.id}/${a.id}/${randomUUID()}.jpg`,
    position: 0,
    largeur: 1600,
    hauteur: 1200,
    type_mime: 'image/jpeg',
    poids: 420000,
  })
  if (eP) throw new Error(`photo : ${eP.message}`)

  const etapesStatut = {
    publiee: [['publiee', {}]],
    suspendue: [['publiee', {}], ['suspendue', {}]],
    cloturee: [['publiee', {}], ['cloturee', { motif_cloture: 'retiree' }]],
  }[statut]
  for (const [s, extra] of etapesStatut) {
    const { error } = await b.db.from('annonces').update({ statut: s, ...extra }).eq('id', a.id)
    if (error) throw new Error(`${s} : ${error.message}`)
  }
  return { ...a, statut }
}

/** Aucune valeur privée dans le texte brut d'une réponse. */
function sansSecret(nom, reponse) {
  const texte = JSON.stringify(reponse)
  const trouves = secrets.filter((s) => s && texte.includes(s))
  noter(nom, trouves.length === 0, trouves.length ? `trouvé : ${trouves.join(', ')}` : undefined)
}

/** Les clés exactes de chaque ligne, et aucune clé interdite. */
function structure(nom, lignes, attendues) {
  const exactes = lignes.every((l) => egal(Object.keys(l), attendues))
  const interdites = lignes.flatMap((l) => Object.keys(l).filter((k) => CLES_INTERDITES.includes(k)))
  noter(
    nom,
    lignes.length > 0 && exactes && interdites.length === 0,
    !exactes
      ? `clés : ${Object.keys(lignes.find((l) => !egal(Object.keys(l), attendues)) || {}).join(', ')}`
      : interdites.length
        ? `clés interdites : ${interdites.join(', ')}`
        : `${attendues.length} colonnes`,
  )
}

;(async () => {
  console.log('\nSikaloc_Find — la vitrine publique (S2)\n')

  // Trois bailleurs, trois états de vérification du téléphone.
  const A = await creerBailleur('a', 'Aline Houngbo')
  const B = await creerBailleur('b', '  Koffi   de  Souza ')
  const C = await creerBailleur('c', 'Élodie')

  await admin
    .from('bailleurs')
    .update({ telephone_verifie_le: new Date().toISOString(), telephone_canal_verification: 'SMS' })
    .eq('id', B.id)
  await admin
    .from('bailleurs')
    .update({ telephone_verifie_le: new Date().toISOString(), telephone_canal_verification: 'ADMIN' })
    .eq('id', C.id)

  const publieeA = await annonce(A, 'publiee')
  const brouillonA = await annonce(A, 'brouillon')
  const suspendueA = await annonce(A, 'suspendue')
  const clotureeA = await annonce(A, 'cloturee')
  const publieeB = await annonce(B, 'publiee', { quartier: 'Cadjèhoun', loyer: 120000 })
  const brouillonB = await annonce(B, 'brouillon')
  const publieeC = await annonce(C, 'publiee', { type: 'Studio', chambres: 0 })

  const publiees = [publieeA, publieeB, publieeC].map((a) => a.reference)
  const cachees = [brouillonA, suspendueA, clotureeA, brouillonB].map((a) => a.reference)

  const visiteur = createClient(SUPABASE, ANON, { auth: { persistSession: false } })

  /** Tout le catalogue, page après page — le banc ne suppose pas être seul en base. */
  async function catalogue(client) {
    const lignes = []
    for (let decalage = 0; ; decalage += 48) {
      const { data, error } = await client.rpc('annonces_publiees', { p_limite: 48, p_decalage: decalage })
      if (error) return { error }
      lignes.push(...data)
      if (data.length < 48) return { data: lignes }
    }
  }

  // ═══ 1. Les tables restent fermées ══════════════════════════════════════
  titre('1. Un visiteur n’atteint aucune table')

  for (const table of ['annonces', 'annonce_photos', 'logements', 'bailleurs', 'baux']) {
    const { data, error } = await visiteur.from(table).select('*').limit(1)
    noter(
      `Lecture directe de \`${table}\` refusée`,
      Boolean(error) || data.length === 0,
      error ? error.message : `${data.length} ligne(s)`,
    )
  }
  const { error: ePrive } = await visiteur.rpc('nom_public', { p_nom: 'x' })
  noter('La fonction interne `prive.nom_public` n’est pas appelable', Boolean(ePrive), ePrive?.code)

  // ═══ 2. Le catalogue ════════════════════════════════════════════════════
  titre('2. Le catalogue — `annonces_publiees`')

  const cat = await catalogue(visiteur)
  noter('Un visiteur l’appelle', !cat.error, cat.error?.message)
  const refsVisiteur = (cat.data || []).map((l) => l.reference)
  noter('Les trois annonces publiées y figurent', publiees.every((r) => refsVisiteur.includes(r)))
  noter(
    'Aucun brouillon, aucune suspendue, aucune clôturée',
    cachees.every((r) => !refsVisiteur.includes(r)),
  )
  const nos = (cat.data || []).filter((l) => publiees.includes(l.reference))
  structure('Colonnes exactes, aucune clé interdite', nos, COLONNES_ANNONCE)
  sansSecret('Aucune valeur privée dans la réponse', cat.data)

  const lA = nos.find((l) => l.reference === publieeA.reference)
  noter(
    'Les valeurs publiques sont justes',
    lA &&
      lA.ville === 'Cotonou' &&
      lA.quartier === 'Fidjrossè' &&
      lA.loyer === 85000 &&
      lA.depot_garantie === 170000 &&
      lA.avance_mois === 3 &&
      egal(lA.equipements, ['eau_courante', 'electricite', 'compteur_electrique_individuel']),
  )

  noter(
    'La photo principale est décrite : position 0, 1600×1200, sans chemin',
    lA && lA.photo_position === 0 && lA.photo_largeur === 1600 && lA.photo_hauteur === 1200,
  )
  const cheminDirect = await visiteur.rpc('photo_publiee', { p_reference: publieeA.reference, p_position: 0 })
  noter('Le chemin d’une photo n’est pas accessible au public (`photo_publiee`)', Boolean(cheminDirect.error), cheminDirect.error?.code)
  const cheminConnecte = await A.db.rpc('photo_publiee', { p_reference: publieeA.reference, p_position: 0 })
  noter('…ni à un bailleur connecté, même propriétaire', Boolean(cheminConnecte.error), cheminConnecte.error?.code)

  const ordre = (cat.data || []).map((l) => l.publiee_le)
  noter(
    'Les plus récentes d’abord',
    ordre.every((d, i) => i === 0 || ordre[i - 1] >= d),
  )

  // Les bornes ne se prouvent qu'au-delà d'elles : cinquante annonces de plus,
  // publiées en quatre requêtes groupées. La clé de service ne sert qu'à aller
  // vite — les déclencheurs de publication s'appliquent à elle aussi.
  const D = await creerBailleur('d', 'Banc Volume')
  const { data: logementsD } = await admin
    .from('logements')
    .insert(Array.from({ length: 50 }, () => ({ bailleur_id: D.id, adresse: ADRESSE, type: 'Studio', ville: 'Porto-Novo' })))
    .select('id')
  const { data: annoncesD } = await admin
    .from('annonces')
    .insert(
      logementsD.map((l) => ({
        bailleur_id: D.id,
        logement_id: l.id,
        type: 'Studio',
        ville: 'Porto-Novo',
        quartier: 'Ouando',
        chambres: 0,
        loyer: 30000,
        description: 'Entrer-coucher propre, douche interne, compteur à part.',
      })),
    )
    .select('id')
  await admin.from('annonce_photos').insert(
    annoncesD.map((a) => ({
      annonce_id: a.id,
      bailleur_id: D.id,
      chemin: `${D.id}/${a.id}/${randomUUID()}.jpg`,
      position: 0,
      largeur: 1600,
      hauteur: 1200,
      type_mime: 'image/jpeg',
      poids: 300000,
    })),
  )
  const { error: eVolume } = await admin.from('annonces').update({ statut: 'publiee' }).eq('bailleur_id', D.id)
  if (eVolume) throw new Error(`volume : ${eVolume.message}`)
  const total = (await catalogue(visiteur)).data.length

  const trop = await visiteur.rpc('annonces_publiees', { p_limite: 10000 })
  noter(
    `Pagination bornée : 10 000 demandées, 48 rendues (catalogue de ${total})`,
    !trop.error && total > 48 && trop.data.length === 48,
    `${trop.data?.length} ligne(s)`,
  )
  const zero = await visiteur.rpc('annonces_publiees', { p_limite: 0 })
  noter('Une limite nulle rend une ligne, pas une erreur', !zero.error && zero.data.length === 1)
  const negatif = await visiteur.rpc('annonces_publiees', { p_limite: 2, p_decalage: -50 })
  const premiers = await visiteur.rpc('annonces_publiees', { p_limite: 2 })
  noter('Un décalage négatif vaut zéro', !negatif.error && egal(negatif.data, premiers.data))
  const defaut = await visiteur.rpc('annonces_publiees')
  noter('Sans argument : exactement 24', !defaut.error && defaut.data.length === 24, `${defaut.data?.length}`)
  const pages = [
    ...(await visiteur.rpc('annonces_publiees', { p_limite: 30 })).data,
    ...(await visiteur.rpc('annonces_publiees', { p_limite: 30, p_decalage: 30 })).data,
  ].map((l) => l.reference)
  noter('Deux pages consécutives : ni doublon, ni trou', new Set(pages).size === Math.min(60, total))

  // ═══ 3. Une annonce ═════════════════════════════════════════════════════
  titre('3. Une annonce — `annonce_publiee`')

  const detail = await visiteur.rpc('annonce_publiee', { p_reference: publieeA.reference })
  noter('Une annonce publiée est rendue', !detail.error && detail.data.length === 1)
  structure('Colonnes exactes, aucune clé interdite', detail.data || [], COLONNES_ANNONCE)
  sansSecret('Aucune valeur privée dans la réponse', detail.data)
  noter('Même contenu que dans le catalogue', egal(detail.data?.[0], lA))

  const invisibles = [
    ['Brouillon', brouillonA.reference],
    ['Suspendue', suspendueA.reference],
    ['Clôturée', clotureeA.reference],
    ['Référence inexistante, format valide', '0000000000'],
    ['Référence au mauvais format', 'ILLOU00000'],
    ['Identifiant interne à la place de la référence', publieeA.id],
    ['Tentative d’injection', "x' or '1'='1"],
    ['Chaîne vide', ''],
  ]
  for (const [cas, ref] of invisibles) {
    const r = await visiteur.rpc('annonce_publiee', { p_reference: ref })
    noter(`${cas} : rien`, !r.error && r.data.length === 0, r.error?.message)
  }

  // ═══ 4. Le bailleur ═════════════════════════════════════════════════════
  titre('4. Le bailleur — `profil_public_bailleur`')

  const profil = async (ref, client = visiteur) =>
    client.rpc('profil_public_bailleur', { p_reference: ref })

  const pA = await profil(publieeA.reference)
  const pB = await profil(publieeB.reference)
  const pC = await profil(publieeC.reference)
  structure('Colonnes exactes, aucune clé interdite', [...(pA.data || []), ...(pB.data || []), ...(pC.data || [])], COLONNES_PROFIL)
  sansSecret('Ni nom complet, ni téléphone, ni email, ni identifiant', [pA.data, pB.data, pC.data])

  noter('« Aline Houngbo » devient « Aline H. »', pA.data?.[0]?.nom_affiche === 'Aline H.', pA.data?.[0]?.nom_affiche)
  noter(
    '« Koffi de Souza », espaces superflus compris, devient « Koffi S. »',
    pB.data?.[0]?.nom_affiche === 'Koffi S.',
    pB.data?.[0]?.nom_affiche,
  )
  noter('Un nom d’un seul mot reste tel quel', pC.data?.[0]?.nom_affiche === 'Élodie', pC.data?.[0]?.nom_affiche)

  noter('Téléphone non vérifié : faux', pA.data?.[0]?.telephone_verifie === false)
  noter('Code reçu par SMS : vrai', pB.data?.[0]?.telephone_verifie === true)
  noter(
    'Attestation ADMIN, sans code : faux',
    pC.data?.[0]?.telephone_verifie === false,
  )

  for (const [cas, ref] of [
    ['Brouillon', brouillonA.reference],
    ['Suspendue', suspendueA.reference],
    ['Clôturée', clotureeA.reference],
    ['Référence inexistante', '0000000000'],
    ['Identifiant de bailleur à la place de la référence', A.id],
  ]) {
    const r = await profil(ref)
    noter(`${cas} : aucun profil`, !r.error && r.data.length === 0, r.error?.message)
  }

  // ═══ 5. Indépendance de l'appelant ══════════════════════════════════════
  titre('5. La même vitrine pour tous')

  const catA = await catalogue(A.db)
  const catB = await catalogue(B.db)
  const filtrer = (c) => (c.data || []).filter((l) => [...publiees, ...cachees].includes(l.reference))
  noter('Bailleur A connecté : même catalogue que le visiteur', egal(filtrer(catA), filtrer(cat)))
  noter('Bailleur B connecté : même catalogue que le visiteur', egal(filtrer(catB), filtrer(cat)))
  noter(
    'A ne voit pas ses propres brouillons par la vitrine',
    ![brouillonA, suspendueA, clotureeA].some((a) => (catA.data || []).some((l) => l.reference === a.reference)),
  )
  const detailParA = await A.db.rpc('annonce_publiee', { p_reference: brouillonA.reference })
  noter('Ni par la référence de son brouillon', !detailParA.error && detailParA.data.length === 0)
  const detailBParA = await A.db.rpc('annonce_publiee', { p_reference: publieeB.reference })
  noter('A voit l’annonce publiée de B, comme tout le monde', detailBParA.data?.length === 1)
  structure('Connecté, les colonnes sont les mêmes', detailBParA.data || [], COLONNES_ANNONCE)
  sansSecret('Connecté, aucune valeur privée non plus', [catA.data, catB.data, detailBParA.data])
  const profilParB = await profil(publieeA.reference, B.db)
  noter('B lit le profil public de A, et rien de plus', egal(profilParB.data, pA.data))

  // ═══ 6. La vitrine suit le cycle de vie ═════════════════════════════════
  titre('6. La vitrine suit le statut, sans délai')

  await A.db.from('annonces').update({ statut: 'suspendue' }).eq('id', publieeA.id)
  const apresSuspension = await visiteur.rpc('annonce_publiee', { p_reference: publieeA.reference })
  const profilSuspendu = await profil(publieeA.reference)
  noter(
    'Suspendue : disparaît du détail et du profil',
    apresSuspension.data?.length === 0 && profilSuspendu.data?.length === 0,
  )
  await A.db.from('annonces').update({ statut: 'publiee' }).eq('id', publieeA.id)
  const apresRepublication = await visiteur.rpc('annonce_publiee', { p_reference: publieeA.reference })
  noter('Republiée : revient', apresRepublication.data?.length === 1)
  await A.db
    .from('annonces')
    .update({ statut: 'cloturee', motif_cloture: 'louee_ailleurs' })
    .eq('id', publieeA.id)
  const final = await catalogue(visiteur)
  noter(
    'Clôturée : absente du catalogue',
    !(final.data || []).some((l) => l.reference === publieeA.reference),
  )

  // ─── Ménage ──────────────────────────────────────────────────────────────
  for (const id of comptes) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) console.log(`  (ménage) compte ${id} non supprimé : ${error.message}`)
  }

  const reussies = etapes.filter(Boolean).length
  console.log(`\n${reussies}/${etapes.length} vérifications passent\n`)
  process.exit(reussies === etapes.length ? 0 : 1)
})().catch(async (e) => {
  console.error(e)
  // Ménage garanti : même quand le corps lève, les comptes créés partent,
  // pour qu'un banc interrompu ne laisse pas de fausse régression derrière lui.
  await rangerComptes(admin, comptes)
  process.exit(1)
})
