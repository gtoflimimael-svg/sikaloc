/**
 * Banc du schéma des annonces — Sikaloc_Find, S1.
 *
 *   supabase start · environnement pointant sur la pile LOCALE
 *   npm run banc:annonces-schema
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 * Les règles que la base garantit seule, sans le code de l'application :
 * référence publique, isolation entre bailleurs, une annonce vivante par
 * logement, conditions de publication, photos, suppressions, et la clôture
 * automatique quand un bail devient actif.
 *
 * Tout passe par la session d'un bailleur, comme en production : un contrôle
 * mené avec la clé de service contournerait les politiques qu'il prétend
 * vérifier. La clé de service ne sert qu'à créer les comptes, à observer, et
 * aux rares cas où il faut franchir une politique pour atteindre la
 * contrainte qu'elle cache.
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

/** Une écriture qui doit échouer, avec le code PostgreSQL attendu. */
const refuse = (nom, { error }, code) =>
  noter(
    nom,
    Boolean(error) && (!code || error.code === code),
    error ? `${error.code} ${error.message}` : 'ACCEPTÉE à tort',
  )

/** Une écriture qui doit réussir. */
const accepte = (nom, { error }, detail) =>
  noter(nom, !error, error ? `${error.code} ${error.message}` : detail)

const MDP = 'Jonquille7Mn!'
const REFERENCE = /^[0-9a-hjkmnp-tv-z]{10}$/
const jour = (decalage = 0) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + decalage)
  return d.toISOString().slice(0, 10)
}

const comptes = []

async function creerBailleur(nom) {
  const email = `banc-annonces-${nom}-${Date.now()}@exemple.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom: `Banc ${nom}`, telephone: '+2290190000009' },
  })
  if (error) throw new Error(`${nom} : ${error.message}`)
  comptes.push(data.user.id)

  const client = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { error: e } = await client.auth.signInWithPassword({ email, password: MDP })
  if (e) throw new Error(`${nom} : ${e.message}`)
  return { id: data.user.id, db: client }
}

/** Les briques d'un bailleur, écrites par sa propre session. */
function outils(b) {
  const unique = async (requete, quoi) => {
    const { data, error } = await requete.select().single()
    if (error) throw new Error(`${quoi} : ${error.code} ${error.message}`)
    return data
  }
  return {
    logement: () =>
      unique(
        b.db.from('logements').insert({
          bailleur_id: b.id,
          adresse: 'Lot 42, Quartier Fidjrossè',
          type: 'Appartement',
          ville: 'Cotonou',
        }),
        'logement',
      ),
    locataire: () =>
      unique(
        b.db.from('locataires').insert({
          bailleur_id: b.id,
          nom: 'Locataire Banc',
          telephone: '+2290197000000',
          consentement_donnees: true,
          date_consentement: jour(),
        }),
        'locataire',
      ),
    annonce: (logementId, champs = {}) =>
      b.db
        .from('annonces')
        .insert({ bailleur_id: b.id, logement_id: logementId, type: 'Appartement', ville: 'Cotonou', ...champs })
        .select()
        .single(),
    completer: (id, champs = {}) =>
      b.db
        .from('annonces')
        .update({
          quartier: 'Fidjrossè',
          chambres: 2,
          loyer: 85000,
          description: 'Deux chambres salon, carrelé, cour commune calme.',
          ...champs,
        })
        .eq('id', id)
        .select()
        .single(),
    statut: (id, statut, champs = {}) =>
      b.db.from('annonces').update({ statut, ...champs }).eq('id', id).select().single(),
    photo: (annonceId, position, champs = {}) =>
      b.db
        .from('annonce_photos')
        .insert({
          annonce_id: annonceId,
          bailleur_id: b.id,
          chemin: `${b.id}/${annonceId}/${randomUUID()}.jpg`,
          position,
          largeur: 1600,
          hauteur: 1200,
          type_mime: 'image/jpeg',
          poids: 420000,
          ...champs,
        })
        .select()
        .single(),
    bail: (logementId, locataireId, champs = {}) =>
      b.db
        .from('baux')
        .insert({
          bailleur_id: b.id,
          logement_id: logementId,
          locataire_id: locataireId,
          loyer_mensuel: 85000,
          date_debut: jour(-60),
          jour_echeance: 5,
          ...champs,
        })
        .select()
        .single(),
  }
}

/** L'annonce telle qu'elle est en base, vue par la clé de service. */
async function lire(id) {
  const { data } = await admin.from('annonces').select('*').eq('id', id).maybeSingle()
  return data
}

/** Une annonce complète, avec une photo, publiée. */
async function annoncePubliee(o, logementId) {
  const { data: a, error } = await o.annonce(logementId)
  if (error) throw new Error(`annonce : ${error.message}`)
  await o.completer(a.id)
  await o.photo(a.id, 0)
  const { data, error: e } = await o.statut(a.id, 'publiee')
  if (e) throw new Error(`publication : ${e.code} ${e.message}`)
  return data
}

;(async () => {
  console.log('\nSikaloc_Find — schéma des annonces (S1)\n')

  const A = await creerBailleur('a')
  const B = await creerBailleur('b')
  const oA = outils(A)
  const oB = outils(B)

  // ═══ 1. La référence publique ════════════════════════════════════════════
  titre('1. La référence publique')

  const refs = []
  for (let i = 0; i < 8; i++) {
    const l = await oA.logement()
    const { data } = await oA.annonce(l.id)
    refs.push(data?.reference)
  }
  noter('Chaque annonce reçoit une référence', refs.every(Boolean), refs.slice(0, 3).join(', '))
  noter('Toutes font 10 caractères', refs.every((r) => r?.length === 10))
  noter('Toutes respectent l’alphabet (sans i, l, o, u)', refs.every((r) => REFERENCE.test(r)))
  noter('Toutes sont distinctes', new Set(refs).size === refs.length, `${refs.length} tirées`)

  const lRef = await oA.logement()
  refuse(
    'Une référence déjà prise est refusée',
    await oA.annonce(lRef.id, { reference: refs[0] }),
    '23505',
  )
  refuse(
    'Une référence hors format est refusée',
    await oA.annonce(lRef.id, { reference: 'ILLOU00000' }),
    '23514',
  )
  const { data: aRef } = await oA.annonce(lRef.id)
  refuse(
    'La référence ne se réécrit pas',
    await oA.statut(aRef.id, 'brouillon', { reference: 'zzzzzzzzzz' }),
    '23514',
  )

  // ═══ 2. Isolation ════════════════════════════════════════════════════════
  titre('2. Isolation')

  const lIso = await oA.logement()
  const annonceA = await annoncePubliee(oA, lIso.id)

  const visiteur = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const anonAnnonces = await visiteur.from('annonces').select('*')
  noter(
    'Un visiteur ne lit pas `annonces` directement',
    Boolean(anonAnnonces.error) || anonAnnonces.data.length === 0,
    anonAnnonces.error ? anonAnnonces.error.message : `${anonAnnonces.data.length} ligne(s)`,
  )
  const anonPhotos = await visiteur.from('annonce_photos').select('*')
  noter(
    'Un visiteur ne lit pas `annonce_photos` directement',
    Boolean(anonPhotos.error) || anonPhotos.data.length === 0,
    anonPhotos.error ? anonPhotos.error.message : `${anonPhotos.data.length} ligne(s)`,
  )

  const vuesParB = await B.db.from('annonces').select('id').eq('bailleur_id', A.id)
  noter('B ne voit pas les annonces de A', !vuesParB.error && vuesParB.data.length === 0)
  const photosVuesParB = await B.db.from('annonce_photos').select('id').eq('bailleur_id', A.id)
  noter('B ne voit pas les photos de A', !photosVuesParB.error && photosVuesParB.data.length === 0)

  const modifParB = await B.db
    .from('annonces')
    .update({ loyer: 1 })
    .eq('id', annonceA.id)
    .select()
  noter(
    'B ne modifie pas une annonce de A',
    !modifParB.error && modifParB.data.length === 0 && (await lire(annonceA.id)).loyer === 85000,
  )
  // Deux gardes se superposent ici, et c'est la première qui répond : le
  // déclencheur de cohérence s'exécute AVANT le `with check` de la politique.
  // Une annonce au nom de A vise forcément un logement de A, que B ne voit
  // pas — le déclencheur la refuse donc toujours en premier. Ce qui compte :
  // refusée, et rien d'écrit.
  const auNomDeA = await B.db
    .from('annonces')
    .insert({ bailleur_id: A.id, logement_id: lIso.id, type: 'Maison', ville: 'Cotonou' })
  const { data: fantomes } = await admin
    .from('annonces')
    .select('id')
    .eq('bailleur_id', A.id)
    .eq('type', 'Maison')
  noter(
    'B ne crée pas d’annonce au nom de A',
    Boolean(auNomDeA.error) && ['42501', '23514'].includes(auNomDeA.error.code) && fantomes.length === 0,
    auNomDeA.error ? `${auNomDeA.error.code} ${auNomDeA.error.message}` : 'ACCEPTÉE à tort',
  )
  refuse(
    'B ne rattache pas son annonce au logement de A',
    await oB.annonce(lIso.id),
    '23514',
  )
  refuse(
    'B n’ajoute pas de photo à une annonce de A',
    await B.db.from('annonce_photos').insert({
      annonce_id: annonceA.id,
      bailleur_id: A.id,
      chemin: `${A.id}/${annonceA.id}/${randomUUID()}.jpg`,
      position: 5,
      largeur: 1600,
      hauteur: 1200,
      type_mime: 'image/jpeg',
      poids: 1000,
    }),
    '42501',
  )

  // ═══ 3. Une annonce vivante par logement ════════════════════════════════
  titre('3. Une annonce vivante par logement')

  const lViv = await oA.logement()
  const { data: premiere } = await oA.annonce(lViv.id)
  refuse('Une deuxième annonce vivante est refusée', await oA.annonce(lViv.id), '23505')
  await oA.completer(premiere.id)
  accepte(
    'La première se clôture',
    await oA.statut(premiere.id, 'cloturee', { motif_cloture: 'retiree' }),
  )
  const apres = await lire(premiere.id)
  noter('`cloturee_le` est posée à la clôture', Boolean(apres?.cloturee_le))
  accepte('Une nouvelle annonce est alors acceptée', await oA.annonce(lViv.id))
  refuse(
    'Une annonce clôturée ne se rouvre pas',
    await oA.statut(premiere.id, 'brouillon', { motif_cloture: null, cloturee_le: null }),
    '23514',
  )
  refuse(
    'Une clôture sans motif est refusée',
    await oA.statut((await oA.annonce((await oA.logement()).id)).data.id, 'cloturee'),
    '23514',
  )

  // ═══ 4. Publication ══════════════════════════════════════════════════════
  titre('4. Publication')

  const lPub = await oA.logement()
  const { data: aPub } = await oA.annonce(lPub.id)
  await oA.photo(aPub.id, 0)
  refuse('Publier une annonce incomplète est refusé', await oA.statut(aPub.id, 'publiee'), '23514')

  const lSansPhoto = await oA.logement()
  const { data: aSansPhoto } = await oA.annonce(lSansPhoto.id)
  await oA.completer(aSansPhoto.id)
  refuse('Publier sans photo est refusé', await oA.statut(aSansPhoto.id, 'publiee'), '23514')
  refuse(
    'Créer une annonce directement publiée est refusé',
    await oA.annonce((await oA.logement()).id, {
      statut: 'publiee',
      quartier: 'Akpakpa',
      chambres: 1,
      loyer: 40000,
      description: 'Une chambre salon, compteur individuel.',
    }),
    '23514',
  )

  await oA.completer(aPub.id)
  const publiee = await oA.statut(aPub.id, 'publiee')
  accepte('Complète et avec une photo : publiée', publiee)
  const publieeLe = publiee.data?.publiee_le
  noter('`publiee_le` est posée à la première publication', Boolean(publieeLe))

  await oA.statut(aPub.id, 'suspendue')
  const republiee = await oA.statut(aPub.id, 'publiee', { publiee_le: '2000-01-01T00:00:00Z' })
  noter(
    '`publiee_le` ne change ni à la suspension, ni à la republication, ni sur demande',
    !republiee.error && republiee.data.publiee_le === publieeLe,
    republiee.error ? republiee.error.message : republiee.data.publiee_le,
  )

  const locataireA = await oA.locataire()
  const lBail = await oA.logement()
  await oA.bail(lBail.id, locataireA.id)
  const { data: aBail } = await oA.annonce(lBail.id)
  await oA.completer(aBail.id)
  await oA.photo(aBail.id, 0)
  refuse(
    'Bail actif sans date de fin : publication refusée',
    await oA.statut(aBail.id, 'publiee'),
    '23514',
  )

  const lPreavis = await oA.logement()
  const bailPreavis = await oA.bail(lPreavis.id, locataireA.id, { date_fin: jour(30) })
  const { data: aPreavis } = await oA.annonce(lPreavis.id)
  await oA.completer(aPreavis.id)
  await oA.photo(aPreavis.id, 0)
  refuse(
    'Préavis : disponible le jour même de la fin du bail — refusé',
    await oA.statut(aPreavis.id, 'publiee', { disponible_le: jour(30) }),
    '23514',
  )
  accepte(
    'Préavis : disponible après la fin du bail — publiée',
    await oA.statut(aPreavis.id, 'publiee', { disponible_le: jour(31) }),
  )
  refuse(
    'Préavis : avancer la disponibilité avant la fin du bail est refusé',
    await oA.statut(aPreavis.id, 'publiee', { disponible_le: jour(10) }),
    '23514',
  )
  await A.db
    .from('baux')
    .update({ statut: 'Actif', loyer_mensuel: 90000 })
    .eq('id', bailPreavis.data.id)
  noter(
    'Modifier un bail déjà actif ne clôture pas l’annonce',
    (await lire(aPreavis.id)).statut === 'publiee',
  )

  // ═══ 5. Photos ═══════════════════════════════════════════════════════════
  titre('5. Photos')

  const lPh = await oA.logement()
  const { data: aPh } = await oA.annonce(lPh.id)
  const positions = []
  for (let p = 0; p <= 7; p++) positions.push(await oA.photo(aPh.id, p))
  noter('Position 0 acceptée', !positions[0].error)
  noter(
    'Positions 0 à 7 acceptées : huit photos',
    positions.every((r) => !r.error),
    positions.find((r) => r.error)?.error?.message,
  )
  refuse('Neuvième photo en position 8 : refusée', await oA.photo(aPh.id, 8), '23514')
  refuse('Neuvième photo sur une position prise : refusée', await oA.photo(aPh.id, 3), '23505')

  const lPh2 = await oA.logement()
  const { data: aPh2 } = await oA.annonce(lPh2.id)
  const p0 = await oA.photo(aPh2.id, 0)
  refuse('Position dupliquée : refusée', await oA.photo(aPh2.id, 0), '23505')
  refuse(
    'Chemin appartenant à un autre bailleur : refusé',
    await oA.photo(aPh2.id, 1, { chemin: `${B.id}/${aPh2.id}/${randomUUID()}.jpg` }),
    '23514',
  )
  refuse(
    'Chemin d’une autre annonce : refusé',
    await oA.photo(aPh2.id, 1, { chemin: `${A.id}/${aPh.id}/${randomUUID()}.jpg` }),
    '23514',
  )
  refuse(
    'Type et extension discordants : refusé',
    await oA.photo(aPh2.id, 1, { type_mime: 'image/webp' }),
    '23514',
  )
  refuse(
    'Format hors JPEG/WebP : refusé',
    await oA.photo(aPh2.id, 1, {
      type_mime: 'image/png',
      chemin: `${A.id}/${aPh2.id}/${randomUUID()}.png`,
    }),
    '23514',
  )
  refuse('Dimensions hors bornes : refusées', await oA.photo(aPh2.id, 1, { largeur: 4000 }), '23514')
  refuse('Poids au-delà de 3 Mio : refusé', await oA.photo(aPh2.id, 1, { poids: 3145729 }), '23514')

  // Franchir la politique avec la clé de service, pour atteindre la clé
  // étrangère composite qu'elle masquerait.
  const lB = await oB.logement()
  const { data: aB } = await oB.annonce(lB.id)
  refuse(
    'Annonce de A déclarée avec le `bailleur_id` de B : refusée par la clé composite',
    await admin.from('annonce_photos').insert({
      annonce_id: annonceA.id,
      bailleur_id: B.id,
      chemin: `${B.id}/${annonceA.id}/${randomUUID()}.jpg`,
      position: 6,
      largeur: 1600,
      hauteur: 1200,
      type_mime: 'image/jpeg',
      poids: 1000,
    }),
    '23503',
  )

  const p1 = await oA.photo(aPh2.id, 1, {
    chemin: `${A.id}/${aPh2.id}/${randomUUID()}.webp`,
    type_mime: 'image/webp',
  })
  accepte('WebP accepté', p1)
  const echange = await A.db
    .from('annonce_photos')
    .upsert([
      { ...p0.data, position: 1 },
      { ...p1.data, position: 0 },
    ])
    .select()
  accepte('Échanger deux positions en une requête (contrainte différée)', echange)
  noter('Aucune annonce de B n’a été touchée', (await lire(aB.id)).statut === 'brouillon')

  // ═══ 6. Suppressions ═════════════════════════════════════════════════════
  titre('6. Suppressions')

  const lSup = await oA.logement()
  const aSup = await annoncePubliee(oA, lSup.id)
  const { data: photosSup } = await A.db.from('annonce_photos').select('id').eq('annonce_id', aSup.id)
  const derniere = await A.db
    .from('annonce_photos')
    .delete()
    .eq('id', photosSup[0].id)
    .select()
  refuse('Retirer la dernière photo d’une annonce publiée : refusé', derniere, '23514')

  const seconde = await oA.photo(aSup.id, 1)
  const retrait = await A.db.from('annonce_photos').delete().eq('id', seconde.data.id).select()
  noter(
    'Retirer une photo quand il en reste une : accepté',
    !retrait.error && retrait.data.length === 1,
    retrait.error?.message,
  )

  const retraitBrouillon = await A.db
    .from('annonce_photos')
    .delete()
    .eq('id', positions[7].data.id)
    .select()
  noter(
    'Retirer une photo d’une annonce non publiée : accepté',
    !retraitBrouillon.error && retraitBrouillon.data.length === 1,
    retraitBrouillon.error?.message,
  )

  refuse(
    'Supprimer une annonce publiée : refusé',
    await A.db.from('annonces').delete().eq('id', aSup.id).select(),
    '23514',
  )
  const suppBrouillon = await A.db.from('annonces').delete().eq('id', aPh.id).select()
  noter(
    'Supprimer un brouillon (et ses photos) : accepté',
    !suppBrouillon.error && suppBrouillon.data.length === 1,
    suppBrouillon.error?.message,
  )
  const { data: orphelines } = await admin.from('annonce_photos').select('id').eq('annonce_id', aPh.id)
  noter('Ses photos sont parties avec lui', orphelines.length === 0)

  // ═══ 7. Logement supprimé ════════════════════════════════════════════════
  titre('7. Logement supprimé')

  refuse(
    'Supprimer un logement dont l’annonce est vivante : refusé',
    await A.db.from('logements').delete().eq('id', lSup.id).select(),
    '23514',
  )
  await oA.statut(aSup.id, 'cloturee', { motif_cloture: 'retiree' })
  const suppLogement = await A.db.from('logements').delete().eq('id', lSup.id).select()
  noter(
    'Annonce clôturée : le logement se supprime',
    !suppLogement.error && suppLogement.data.length === 1,
    suppLogement.error?.message,
  )
  const survivante = await lire(aSup.id)
  noter(
    'L’annonce clôturée survit, `logement_id` à NULL',
    survivante && survivante.logement_id === null,
    survivante ? `ville conservée : ${survivante.ville}` : 'annonce disparue',
  )

  // ═══ 8. Clôture automatique ══════════════════════════════════════════════
  titre('8. Clôture automatique quand un bail devient actif')

  // 8.1 — `creerBail` : une insertion dans `baux`.
  const lC1 = await oA.logement()
  const aC1 = await annoncePubliee(oA, lC1.id)
  const lC1b = await oA.logement()
  const { data: brouillonC1 } = await oA.annonce(lC1b.id)
  accepte('Création d’un bail actif (chemin de `creerBail`)', await oA.bail(lC1.id, locataireA.id))
  const c1 = await lire(aC1.id)
  noter(
    '→ annonce clôturée, motif louee_ailleurs',
    c1.statut === 'cloturee' && c1.motif_cloture === 'louee_ailleurs' && Boolean(c1.cloturee_le),
    `${c1.statut} / ${c1.motif_cloture}`,
  )
  accepte('Bail actif sur un logement dont l’annonce est un brouillon', await oA.bail(lC1b.id, locataireA.id))
  noter(
    '→ le brouillon reste un brouillon (jamais vu, peut-être incomplet)',
    (await lire(brouillonC1.id)).statut === 'brouillon',
  )

  // 8.2 — `reactiverBail` : `statut` repasse à « Actif ».
  const lC2 = await oA.logement()
  const bailC2 = await oA.bail(lC2.id, locataireA.id)
  await A.db
    .from('baux')
    .update({ statut: 'Résilié', date_fin: jour() })
    .eq('id', bailC2.data.id)
  const aC2 = await annoncePubliee(oA, lC2.id)
  noter('Bail résilié : l’annonce du logement se publie', aC2.statut === 'publiee')
  accepte(
    'Réactivation du bail (chemin de `reactiverBail`)',
    await A.db
      .from('baux')
      .update({ statut: 'Actif', date_fin: null })
      .eq('id', bailC2.data.id)
      .select()
      .single(),
  )
  const c2 = await lire(aC2.id)
  noter(
    '→ annonce clôturée, motif louee_ailleurs',
    c2.statut === 'cloturee' && c2.motif_cloture === 'louee_ailleurs',
    `${c2.statut} / ${c2.motif_cloture}`,
  )

  // 8.3 — `creer_premier_bail` : la fonction crée le logement ET le bail dans
  // le même appel. Aucune annonce ne peut viser un logement qui n'existe pas
  // encore : ce chemin ne peut rien clôturer. On vérifie que le déclencheur,
  // qui s'y exécute comme sur toute insertion dans `baux`, ne le casse pas.
  const C = await creerBailleur('c')
  const premier = await C.db.rpc('creer_premier_bail', {
    p_locataire_nom: 'Locataire Onboarding',
    p_locataire_telephone: '+2290196000000',
    p_logement_adresse: 'Carré 208, Quartier Vodjè',
    p_logement_ville: 'Cotonou',
    p_logement_type: 'Maison',
    p_loyer_mensuel: 120000,
    p_jour_echeance: 5,
    p_date_debut: jour(-10),
  })
  accepte('`creer_premier_bail` fonctionne avec le déclencheur en place', premier, `bail ${premier.data}`)
  const { data: annoncesC } = await admin.from('annonces').select('id').eq('bailleur_id', C.id)
  noter(
    '→ aucune annonce ne peut exister pour le logement qu’elle crée',
    annoncesC.length === 0,
    'clôture sans objet sur ce chemin',
  )

  // ═══ 9. Suppression d'un compte ══════════════════════════════════════════
  titre('9. Suppression d’un compte bailleur')

  const aBPub = await annoncePubliee(oB, (await oB.logement()).id)
  const { error: eSuppB } = await admin.auth.admin.deleteUser(B.id)
  noter(
    'Un compte avec une annonce publiée se supprime (cascade)',
    !eSuppB,
    eSuppB?.message,
  )
  noter('Ses annonces sont parties avec lui', (await lire(aBPub.id)) === null)
  comptes.splice(comptes.indexOf(B.id), 1)

  // ─── Ménage ──────────────────────────────────────────────────────────────
  // Les baux d'abord : leur logement est protégé par `on delete restrict`.
  for (const id of comptes) {
    await admin.from('baux').delete().eq('bailleur_id', id)
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
