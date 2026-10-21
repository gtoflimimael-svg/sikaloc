/**
 * Banc des notifications de candidature — Sikaloc_Find, S8-D.
 *
 *   supabase start · set -a && . ./.env.development.local && set +a
 *   npm run dev · npm run banc:notifications-candidature
 *
 * ─── Ce banc n'envoie aucun email ───────────────────────────────────────────
 *
 * Sur la pile locale, `envoyerEmail` DÉPOSE le courrier dans `.emails-locaux/`
 * au lieu de l'expédier. Le banc lit ces fichiers : le HTML inspecté est
 * exactement celui qui partirait, composé par les mêmes modèles.
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. Le transport local, et son accord avec le garde-fou des bancs.
 *   2. Les cinq événements : qui est prévenu, et de quoi.
 *   3. Ce que les emails disent — et surtout ce qu'ils ne disent pas.
 *   4. Les non-notifications : refus, gestes sans effet, simples lectures.
 *   5. La concurrence : cinq candidatures simultanées, une notification.
 *   6. L'échec d'envoi, la reprise, et l'absence de doublon.
 *   7. Les suppressions de compte, des deux côtés.
 *   8. Le travailleur : fermé sans secret, et sans fuite.
 */
const { createClient } = require('@supabase/supabase-js')
const sharp = require('sharp')
const { randomUUID } = require('node:crypto')
const { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } = require('node:fs')
const { join } = require('node:path')

const { examinerPileLocale, exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const BASE = process.env.BASE_ONBOARDING || 'http://localhost:3000'
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SECRET_CRON = process.env.CRON_SECRET

exigerPileLocale('Ce banc')

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'
const BOITE = join(process.cwd(), '.emails-locaux')

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)
const comptes = []

async function compte(cle, nom, role) {
  const email = `banc-s8d-${cle}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`
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
  if (!role) {
    await admin
      .from('bailleurs')
      .update({ onboarding_termine: true, tutoriel_vu_le: new Date().toISOString() })
      .eq('id', data.user.id)
  }
  return { id: data.user.id, email, nom, telephone, db }
}

async function annonce(b, ville = 'Cotonou') {
  const { data: logement } = await admin
    .from('logements')
    .insert({ bailleur_id: b.id, adresse: 'Lot 3, voie pavée', type: 'Appartement', ville })
    .select('id')
    .single()
  const { data: a } = await admin
    .from('annonces')
    .insert({
      bailleur_id: b.id,
      logement_id: logement.id,
      type: 'Appartement',
      ville,
      quartier: 'Vèdoko',
      chambres: 2,
      loyer: 105000,
      description: 'Deux chambres salon, eau et électricité.',
    })
    .select('id, reference')
    .single()
  const fichier = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#4e8a3e' } })
    .jpeg({ quality: 80 })
    .toBuffer()
  const chemin = `${b.id}/${a.id}/${randomUUID()}.jpg`
  await admin.storage.from('annonces').upload(chemin, fichier, { contentType: 'image/jpeg' })
  await admin.from('annonce_photos').insert({
    annonce_id: a.id, bailleur_id: b.id, chemin, position: 0,
    largeur: 1200, hauteur: 900, type_mime: 'image/jpeg', poids: fichier.length,
  })
  await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
  return a
}

const motifDe = (r) => r.error?.code ?? r.data?.[0]?.motif ?? '(vide)'
const statutDe = async (id) =>
  (await admin.from('candidatures').select('statut').eq('id', id).single()).data?.statut

/** Les notifications d'une candidature, de la plus ancienne à la plus récente. */
async function notifications(candidatureId) {
  const { data } = await admin
    .from('notifications_candidature')
    .select('*')
    .eq('candidature_id', candidatureId)
    .order('cree_le', { ascending: true })
  return data ?? []
}

/** Le courrier déposé pour une ligne précise — le fichier porte son identifiant. */
const courrierDe = (notification) => boite().find((c) => c.fichier === `${notification.id}.json`)

/** Le courrier déposé sur le disque. */
const boite = () =>
  (existsSync(BOITE) ? readdirSync(BOITE) : [])
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ fichier: f, ...JSON.parse(readFileSync(join(BOITE, f), 'utf8')) }))

/** Déclenche le travailleur, et rend son compte rendu. */
async function travailler(secret = SECRET_CRON) {
  const reponse = await fetch(`${BASE}/api/cron/notifications`, {
    method: 'POST',
    headers: secret ? { 'x-cron-secret': secret } : {},
  })
  return { statut: reponse.status, corps: await reponse.json().catch(() => ({})) }
}

;(async () => {
  console.log('\nSikaloc_Find — les notifications de candidature (S8-D)\n')

  // ═══ 1. Le transport local ═══════════════════════════════════════════════
  titre('1. Rien ne part vers l’extérieur')

  noter('Le garde-fou confirme la pile locale', examinerPileLocale().locale)
  noter('Un secret de cron est configuré', Boolean(SECRET_CRON))

  // Les deux implémentations de la règle — celle des bancs et celle de
  // l'application — doivent répondre la même chose, sinon l'une des deux
  // protège autre chose que ce qu'on croit.
  const CLE_PROD =
    'e.' + Buffer.from(JSON.stringify({ iss: 'supabase', ref: 'abcdefghijklmnop' })).toString('base64').replace(/=+$/, '') + '.s'
  const CLE_LOCALE =
    'e.' + Buffer.from(JSON.stringify({ iss: 'supabase-demo' })).toString('base64').replace(/=+$/, '') + '.s'
  for (const [nom, url, cle, attendu] of [
    ['pile locale', 'http://127.0.0.1:54321', CLE_LOCALE, true],
    ['URL de production', 'https://abc.supabase.co', CLE_LOCALE, false],
    ['clé de production sous URL locale', 'http://127.0.0.1:54321', CLE_PROD, false],
  ]) {
    noter(`Même règle des deux côtés : ${nom}`, examinerPileLocale({ url, cles: [cle] }).locale === attendu)
  }

  if (existsSync(BOITE)) rmSync(BOITE, { recursive: true, force: true })
  mkdirSync(BOITE, { recursive: true })
  noter('La boîte locale est vide au départ', boite().length === 0)

  // ─── Le décor ────────────────────────────────────────────────────────────
  const A = await compte('bailleur-a', 'Akouavi Lawson')
  const B = await compte('bailleur-b', 'Bienvenu Hounkpè')
  const c1 = await compte('candidat-1', 'Clarisse Agbodjan', 'candidat')
  const c2 = await compte('candidat-2', 'Cédric Nouatin', 'candidat')
  const c3 = await compte('candidat-3', 'Corine Béhanzin', 'candidat')
  const c4 = await compte('candidat-4', 'Constant Djossou', 'candidat')

  const annonceA = await annonce(A)
  const autreA = await annonce(A, 'Abomey-Calavi')
  const annonceB = await annonce(B, 'Parakou')

  const poser = async (candidat, reference, message) => {
    const r = await candidat.db.rpc('soumettre_candidature', { p_reference: reference, p_message: message })
    if (r.data?.[0]?.motif !== 'ok') throw new Error(`candidature : ${motifDe(r)}`)
    const { data } = await admin
      .from('candidatures').select('id')
      .eq('candidat_id', candidat.id).order('created_at', { ascending: false }).limit(1)
    return data[0].id
  }

  // ═══ 2. Une candidature arrive ═══════════════════════════════════════════
  titre('2. Nouvelle candidature → le bailleur')

  const k1 = await poser(c1, annonceA.reference, 'Bonjour, je cherche pour le mois prochain.')
  const apresDepot = await notifications(k1)

  noter('Une notification, une seule', apresDepot.length === 1, `${apresDepot.length}`)
  noter('…pour le bailleur', apresDepot[0]?.destinataire_role === 'bailleur')
  noter('…à son adresse', apresDepot[0]?.destinataire === A.email)
  noter('…jamais au candidat', apresDepot[0]?.destinataire !== c1.email)
  noter('…événement « nouvelle »', apresDepot[0]?.evenement === 'nouvelle')
  noter('…modèle « candidature_recue »', apresDepot[0]?.modele === 'candidature_recue')
  noter('…pas encore envoyée', apresDepot[0]?.envoye_le === null)

  const variables = apresDepot[0]?.variables ?? {}
  noter('Les variables portent le nom du candidat', variables.candidat_nom === 'Clarisse Agbodjan')
  noter('…la référence de l’annonce', variables.reference === annonceA.reference)
  noter('…et rien du candidat au-delà du nom', !JSON.stringify(variables).includes(c1.email) && !JSON.stringify(variables).includes(c1.telephone) && !JSON.stringify(variables).includes(c1.id))

  // ═══ 3. Le travailleur ═══════════════════════════════════════════════════
  titre('3. Le travailleur dépose le courrier')

  const sansSecret = await travailler(null)
  noter('Sans secret, la route est fermée', sansSecret.statut === 401, String(sansSecret.statut))
  noter('…et rien n’est parti', boite().length === 0)
  const mauvaisSecret = await travailler('ce-n-est-pas-le-bon-secret')
  noter('Avec un mauvais secret non plus', mauvaisSecret.statut === 401)
  noter('…toujours rien', boite().length === 0)

  const passage = await travailler()
  noter('Avec le secret, il travaille', passage.statut === 200, String(passage.statut))
  noter('…et a envoyé la notification', passage.corps?.detail?.candidatures?.envoyes >= 1)

  const courrierBailleur = courrierDe(apresDepot[0])
  noter('Le courrier est dans la boîte locale', Boolean(courrierBailleur))
  noter('…adressé au bailleur', courrierBailleur?.destinataire === A.email)
  noter('…avec un sujet clair', /Nouvelle candidature/.test(courrierBailleur?.sujet ?? ''))
  noter('…qui nomme le candidat', (courrierBailleur?.texte ?? '').includes('Clarisse Agbodjan'))
  noter('…et la référence', (courrierBailleur?.texte ?? '').includes(annonceA.reference))
  noter(
    '…avec un lien vers ses candidatures',
    (courrierBailleur?.html ?? '').includes(`/pro/annonces/${annonceA.id}/candidatures`),
  )
  noter('…qui ne promet aucune réponse', /ne lui promet aucune réponse/.test(courrierBailleur?.texte ?? ''))

  const marquee = (await notifications(k1))[0]
  noter('La ligne est marquée envoyée', Boolean(marquee.envoye_le))
  noter('…sans erreur', marquee.derniere_erreur === null)

  const secondPassage = await travailler()
  noter('Un second passage ne renvoie rien', secondPassage.corps?.detail?.candidatures?.envoyes === 0)
  noter('…et ne dépose aucun doublon', boite().filter((c) => c.destinataire === A.email).length === 1)

  // ═══ 4. Le bailleur répond ═══════════════════════════════════════════════
  titre('4. Changement de statut → le candidat')

  const repondre = (qui, id, statut) =>
    qui.db.rpc('repondre_candidature', { p_candidature_id: id, p_statut: statut })

  noter('envoyée → à l’étude', motifDe(await repondre(A, k1, 'en_etude')) === 'ok')
  let suite = await notifications(k1)
  const enEtude = suite.find((n) => n.evenement === 'en_etude')
  noter('Une notification est née', Boolean(enEtude))
  noter('…pour le candidat', enEtude?.destinataire_role === 'candidat')
  noter('…à son adresse', enEtude?.destinataire === c1.email)
  noter('…jamais au bailleur', enEtude?.destinataire !== A.email)

  noter('à l’étude → acceptée', motifDe(await repondre(A, k1, 'acceptee')) === 'ok')
  noter('Une de plus', (await notifications(k1)).some((n) => n.evenement === 'acceptee'))

  const k2 = await poser(c2, annonceA.reference, 'Disponible tout de suite.')
  noter('envoyée → refusée', motifDe(await repondre(A, k2, 'refusee')) === 'ok')
  noter('refusée → à l’étude', motifDe(await repondre(A, k2, 'en_etude')) === 'ok')
  const surK2 = await notifications(k2)
  noter(
    'Chaque changement a sa notification',
    surK2.filter((n) => n.destinataire_role === 'candidat').length === 2,
    `${surK2.filter((n) => n.destinataire_role === 'candidat').length}`,
  )
  noter(
    'Une remise à l’étude prévient de nouveau',
    surK2.filter((n) => n.evenement === 'en_etude').length === 1,
  )

  await travailler()
  const pourCandidat = boite().filter((c) => c.destinataire === c1.email)
  noter('Le candidat a reçu son courrier', pourCandidat.length === 2, `${pourCandidat.length}`)

  const acceptation = pourCandidat.find((c) => c.modele === 'candidature_acceptee')
  noter('L’acceptation est factuelle', /acceptée/.test(acceptation?.sujet ?? ''))
  noter(
    '…et ne promet ni logement réservé, ni bail',
    /ne réserve pas le logement et ne crée aucun bail/.test(acceptation?.texte ?? '') &&
      !/réservé|vous êtes locataire|bail est créé/i.test(acceptation?.texte ?? ''),
  )
  noter('…avec le lien vers ses candidatures', (acceptation?.html ?? '').includes('/me/candidatures'))

  const etude = pourCandidat.find((c) => c.modele === 'candidature_en_etude')
  noter(
    'La mise à l’étude ne promet rien',
    !/sous \d|dans les \d|bientôt|prochainement|vous serez (recontacté|rappelé)/i.test(etude?.texte ?? ''),
    etude?.texte?.slice(0, 60),
  )
  noter('…et dit que Sikaloc ne décide pas', /ni annoncer de décision, ni de délai/.test(etude?.texte ?? ''))

  // ═══ 5. Ce que les emails ne disent pas ══════════════════════════════════
  titre('5. Aucune fuite dans le courrier')

  const versLeBailleur = boite().filter((c) => c.destinataire === A.email)
  const versLeCandidat = boite().filter((c) => c.destinataire === c1.email || c.destinataire === c2.email)

  const contenu = (liste) => liste.map((c) => `${c.sujet}\n${c.texte}\n${c.html}`).join('\n')
  const auBailleur = contenu(versLeBailleur)
  const auCandidat = contenu(versLeCandidat)

  noter('Aucun téléphone de candidat chez le bailleur', ![c1, c2].some((c) => auBailleur.includes(c.telephone)))
  noter('Aucun email de candidat chez le bailleur', ![c1, c2].some((c) => auBailleur.includes(c.email)))
  noter('Aucun email de bailleur chez le candidat', !auCandidat.includes(A.email) && !auCandidat.includes(B.email))
  noter('Aucun téléphone de bailleur chez le candidat', !auCandidat.includes(A.telephone))
  noter('Aucun identifiant de compte nulle part', ![A, B, c1, c2].some((x) => (auBailleur + auCandidat).includes(x.id)))
  noter('Aucun identifiant de candidature', ![k1, k2].some((id) => (auBailleur + auCandidat).includes(id)))
  noter(
    'Le seul identifiant présent est celui du lien du bailleur',
    auBailleur.includes(`/pro/annonces/${annonceA.id}/candidatures`) && !auCandidat.includes(annonceA.id),
  )
  noter('Aucun secret', !/(CRON_SECRET|service_role|eyJhbGciOi|SUPABASE_)/.test(auBailleur + auCandidat))
  noter('Aucune trace de la base', !/(supabase\.co|127\.0\.0\.1:54321|SQLSTATE|candidat_id)/.test(auBailleur + auCandidat))
  noter('Les liens ne portent aucune donnée personnelle', !/[?&](email|tel|nom)=/.test(auBailleur + auCandidat))

  // ═══ 6. Le candidat se retire ════════════════════════════════════════════
  titre('6. Retrait → le bailleur, et lui seul')

  const k3 = await poser(c3, annonceA.reference, 'Bonjour.')
  await travailler()
  const avantRetrait = boite().length

  noter('Le candidat retire', motifDe(await c3.db.rpc('retirer_candidature', { p_candidature_id: k3 })) === 'ok')
  const surK3 = await notifications(k3)
  const retrait = surK3.find((n) => n.evenement === 'retiree')
  noter('Une notification de retrait existe', Boolean(retrait))
  noter('…pour le bailleur', retrait?.destinataire === A.email)
  noter('…et aucune pour le candidat lui-même', !surK3.some((n) => n.evenement === 'retiree' && n.destinataire_role === 'candidat'))
  noter('…le candidat n’est prévenu de rien', !surK3.some((n) => n.destinataire === c3.email))

  await travailler()
  const courrierRetrait = courrierDe(retrait)
  noter(
    'Le bailleur reçoit le retrait',
    courrierRetrait?.destinataire === A.email,
    `déposé pour ${courrierRetrait?.destinataire ?? '(rien)'}`,
  )
  noter('…avec le bon modèle', courrierRetrait?.modele === 'candidature_retiree')
  noter('…qui nomme le candidat', (courrierRetrait?.texte ?? '').includes('Corine Béhanzin'))
  noter('…et n’attend rien de lui', /Aucune action n’est attendue/.test(courrierRetrait?.texte ?? ''))
  noter('Le nombre de courriers a augmenté d’un seul', boite().length === avantRetrait + 1, `${boite().length}`)

  // ═══ 7. Ce qui ne notifie pas ════════════════════════════════════════════
  titre('7. Les gestes qui ne produisent aucun email')

  const compter = async () =>
    (await admin.from('notifications_candidature').select('id', { count: 'exact', head: true })).count

  let avant = await compter()

  noter('Transition interdite (acceptée → refusée)', motifDe(await repondre(A, k1, 'refusee')) === 'transition_refusee')
  noter('…aucune notification', (await compter()) === avant)

  noter('Réponse invalide (→ retirée)', motifDe(await repondre(A, k2, 'retiree')) === 'reponse_invalide')
  noter('…aucune notification', (await compter()) === avant)

  noter('Candidature d’un autre bailleur', motifDe(await repondre(B, k2, 'acceptee')) === 'introuvable')
  noter('…aucune notification', (await compter()) === avant)

  noter('Un candidat tentant de répondre', motifDe(await repondre(c2, k2, 'acceptee')) === 'introuvable')
  noter('…aucune notification', (await compter()) === avant)

  // S8-A accepte un second retrait sans rien changer (la ligne est déjà
  // retirée) : c'est sans conséquence, tant qu'aucun email n'en sort.
  await c3.db.rpc('retirer_candidature', { p_candidature_id: k3 })
  noter('Un second retrait ne renotifie pas', (await compter()) === avant)

  noter('Une candidature retirée qu’on tente de relancer', motifDe(await repondre(A, k3, 'en_etude')) === 'transition_refusee')
  noter('…aucune notification', (await compter()) === avant)

  // Une simple lecture, une page ouverte : rien.
  await A.db.rpc('candidatures_de_mes_annonces', { p_reference: annonceA.reference })
  await A.db.rpc('candidatures_par_annonce')
  await c2.db.rpc('mes_candidatures')
  noter('Lire ne notifie pas', (await compter()) === avant)

  // Remettre le même statut : la base l'accepte-t-elle ? Sinon, rien non plus.
  const memeStatut = await repondre(A, k2, 'en_etude')
  noter('Répondre le statut déjà en place ne crée rien', (await compter()) === avant, motifDe(memeStatut))

  // ═══ 8. La concurrence ═══════════════════════════════════════════════════
  titre('8. Cinq envois simultanés')

  avant = await compter()
  const resultats = await Promise.all(
    Array.from({ length: 5 }, () =>
      c4.db.rpc('soumettre_candidature', { p_reference: annonceA.reference, p_message: 'Bonjour.' }),
    ),
  )
  const reussis = resultats.filter((r) => r.data?.[0]?.motif === 'ok').length
  noter('Une seule candidature est acceptée', reussis === 1, `${reussis}`)

  const { data: siennes } = await admin
    .from('candidatures').select('id').eq('candidat_id', c4.id).eq('annonce_id', annonceA.id)
  noter('…une seule ligne en base', siennes.length === 1)
  const surK4 = await notifications(siennes[0].id)
  noter('…et une seule notification, pas cinq', surK4.length === 1, `${surK4.length}`)
  noter('Le total n’a augmenté que d’un', (await compter()) === avant + 1)

  // Deux réponses simultanées sur la même candidature.
  const k4 = siennes[0].id
  avant = await compter()
  const doubles = await Promise.all([repondre(A, k4, 'acceptee'), repondre(A, k4, 'refusee')])
  const acceptes = doubles.filter((r) => r.data?.[0]?.motif === 'ok').length
  noter('Une seule des deux réponses passe', acceptes === 1, `${acceptes}`)
  const apres = await notifications(k4)
  noter(
    'Une seule notification de plus',
    (await compter()) === avant + 1,
    `${apres.length} au total sur la candidature`,
  )
  const statutReel = await statutDe(k4)
  noter(
    '…et elle correspond au statut réellement enregistré',
    apres.filter((n) => n.destinataire_role === 'candidat').every((n) => n.evenement === statutReel),
    statutReel,
  )

  // ═══ 9. L’échec d’envoi ══════════════════════════════════════════════════
  titre('9. Quand l’envoi échoue')

  const k5 = await poser(c2, autreA.reference, 'Bonjour, celle-ci m’intéresse.')
  const [aEnvoyer] = await notifications(k5)
  noter('La notification existe', Boolean(aEnvoyer))

  // Une adresse que le transport local refuse : la contrainte de la table
  // impose plus de trois caractères, on passe donc par une adresse valide
  // mais un modèle inconnu, que `composer` ne sait pas rendre.
  await admin.from('notifications_candidature').update({ modele: 'modele_inexistant' }).eq('id', aEnvoyer.id)
  const passageEchec = await travailler()
  noter('Le travailleur signale un échec', passageEchec.corps?.detail?.candidatures?.echecs === 1, JSON.stringify(passageEchec.corps?.detail?.candidatures))

  const apresEchec = (await notifications(k5))[0]
  noter('La notification est conservée', Boolean(apresEchec))
  noter('…non marquée envoyée', apresEchec.envoye_le === null)
  noter('…le compteur de tentatives a monté', apresEchec.tentatives === 1, `${apresEchec.tentatives}`)
  noter('…et l’erreur est gardée', Boolean(apresEchec.derniere_erreur))
  noter('La candidature, elle, reste valide', (await statutDe(k5)) === 'envoyee')

  // La reprise : on remet le bon modèle, et le passage suivant réussit.
  const avantReprise = boite().length
  await admin.from('notifications_candidature').update({ modele: 'candidature_recue' }).eq('id', aEnvoyer.id)
  await travailler()
  const apresReprise = (await notifications(k5))[0]
  noter('Une reprise finit par envoyer', Boolean(apresReprise.envoye_le))
  noter('…un seul courrier de plus', boite().length === avantReprise + 1)
  await travailler()
  noter('…et un passage de plus n’en ajoute aucun', boite().length === avantReprise + 1)

  // Au-delà de trois tentatives, la ligne cesse d'être reprise sans disparaître.
  const k6 = await poser(c3, autreA.reference, 'Bonjour.')
  const [obstinee] = await notifications(k6)
  await admin.from('notifications_candidature').update({ tentatives: 3, modele: 'modele_inexistant' }).eq('id', obstinee.id)
  const passageSature = await travailler()
  noter('Une ligne à trois tentatives n’est plus reprise', passageSature.corps?.detail?.candidatures?.traites === 0)
  const toujoursLa = (await notifications(k6))[0]
  noter('…mais elle n’a pas disparu', Boolean(toujoursLa) && toujoursLa.envoye_le === null)

  // ═══ 10. Les suppressions ════════════════════════════════════════════════
  titre('10. Quand un compte disparaît')

  const k7 = await poser(c2, annonceB.reference, 'Bonjour.')
  const avantSuppression = (await notifications(k7)).length
  noter('La candidature chez B a notifié B', avantSuppression === 1)

  // Une notification vers le candidat, en attente, puis le compte s'en va.
  noter('B met à l’étude', motifDe(await repondre(B, k7, 'en_etude')) === 'ok')
  const enAttentePourC2 = (await notifications(k7)).filter((n) => n.destinataire_role === 'candidat' && !n.envoye_le)
  noter('…une notification attend le candidat', enAttentePourC2.length === 1)

  // Ce que c2 a DÉJÀ reçu avant de partir reste reçu : on compte, pour ne
  // vérifier ensuite que ce qui serait parti APRÈS.
  const recusParC2AvantDepart = boite().filter((c) => c.destinataire === c2.email).length

  await admin.auth.admin.deleteUser(c2.id)
  comptes.splice(comptes.indexOf(c2.id), 1)

  const apresSuppressionCandidat = await notifications(k7)
  noter('La notification en attente est annulée', !apresSuppressionCandidat.some((n) => n.destinataire_role === 'candidat' && !n.envoye_le))
  noter('La candidature, elle, reste', Boolean(await statutDe(k7)))
  noter('La notification du bailleur est intacte', apresSuppressionCandidat.some((n) => n.destinataire_role === 'bailleur'))

  // Répondre encore : plus personne à prévenir, et aucune erreur.
  noter('B répond malgré tout', motifDe(await repondre(B, k7, 'refusee')) === 'ok')
  noter('…sans créer de notification vers un compte disparu', (await notifications(k7)).filter((n) => n.destinataire_role === 'candidat').length === 0)
  const apresTout = await travailler()
  noter('Le travailleur ne bute sur rien', apresTout.statut === 200)
  noter(
    '…et n’a plus rien envoyé à l’adresse supprimée',
    boite().filter((c) => c.destinataire === c2.email).length === recusParC2AvantDepart,
    `${recusParC2AvantDepart} avant, ${boite().filter((c) => c.destinataire === c2.email).length} après`,
  )

  // Le bailleur disparaît : ses annonces, candidatures et notifications suivent.
  const notifsDeB = (await admin
    .from('notifications_candidature')
    .select('id', { count: 'exact', head: true })
    .eq('destinataire', B.email)).count
  noter('B a des notifications avant suppression', notifsDeB >= 1, `${notifsDeB}`)

  await admin.auth.admin.deleteUser(B.id)
  comptes.splice(comptes.indexOf(B.id), 1)

  const restantesDeB = (await admin
    .from('notifications_candidature')
    .select('id', { count: 'exact', head: true })
    .eq('destinataire', B.email)).count
  noter('Elles partent avec lui', restantesDeB === 0, `${restantesDeB}`)
  const dernierPassage = await travailler()
  noter('Le travailleur tourne toujours sans erreur', dernierPassage.statut === 200)

  // ═══ 11. La file est fermée ══════════════════════════════════════════════
  titre('11. La file ne s’ouvre à personne')

  const visiteur = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { data: vueAnonyme, error: erreurAnonyme } = await visiteur.from('notifications_candidature').select('*')
  noter('Un anonyme ne lit pas la file', erreurAnonyme !== null || (vueAnonyme ?? []).length === 0)
  const { data: vueBailleur, error: erreurBailleur } = await A.db.from('notifications_candidature').select('*')
  noter('Un bailleur non plus', erreurBailleur !== null || (vueBailleur ?? []).length === 0)
  const { data: vueCandidat, error: erreurCandidat } = await c1.db.from('notifications_candidature').select('*')
  noter('Un candidat non plus', erreurCandidat !== null || (vueCandidat ?? []).length === 0)
  const insertion = await A.db.from('notifications_candidature').insert({
    candidature_id: k1, evenement: 'nouvelle', destinataire_role: 'bailleur',
    destinataire: 'ailleurs@exemple.test', modele: 'candidature_recue',
  })
  noter('…et personne n’y écrit', insertion.error !== null, insertion.error?.code)

  // ─── Ménage ──────────────────────────────────────────────────────────────
  rmSync(BOITE, { recursive: true, force: true })
  for (const id of comptes) {
    const { data: dossiers } = await admin.storage.from('annonces').list(id, { limit: 100 })
    for (const dossier of dossiers ?? []) {
      const { data: f } = await admin.storage.from('annonces').list(`${id}/${dossier.name}`)
      if (f?.length) await admin.storage.from('annonces').remove(f.map((x) => `${id}/${dossier.name}/${x.name}`))
    }
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
