/**
 * Banc des candidatures côté bailleur — Sikaloc_Find, S8-C.
 *
 *   supabase start · set -a && . ./.env.development.local && set +a
 *   npm run dev (ou build && start)
 *   npm run banc:candidatures-pro
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. Le garde-fou : ce banc écrit, et refuse toute base qui n'est pas locale.
 *   2. L'accès : A voit les siennes, B les siennes, un anonyme rien, un
 *      candidat rien de Pro.
 *   3. Les données : nom, message, statut, dates — jamais téléphone, email ni
 *      identifiant de compte.
 *   4. Les transitions permises, et toutes celles qui ne le sont pas.
 *   5. Les états terminaux : acceptée, retirée.
 *   6. Le croisement : A avec l'identifiant d'une candidature de B.
 *   7. Le candidat supprimé : la candidature reste, l'identité s'en va.
 *   8. Les acceptations multiples, que S8-A autorise.
 *   9. Les écrans : compteur, liste, actions, états vides, 404.
 */
const { createClient } = require('@supabase/supabase-js')
const { chromium } = require('playwright-core')
const sharp = require('sharp')
const { randomUUID } = require('node:crypto')

const { examinerPileLocale, exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const BASE = process.env.BASE_ONBOARDING || 'http://localhost:3000'
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

exigerPileLocale('Ce banc')

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'
const ADRESSE = 'Lot 7, rue des Cocotiers'

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)
const comptes = []

async function compte(cle, nom, role) {
  const email = `banc-s8c-${cle}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`
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
  // Un bailleur prêt à travailler : installé, et la visite guidée derrière lui
  // — son calque couvre la page et intercepterait les clics.
  if (!role) {
    await admin
      .from('bailleurs')
      .update({
        onboarding_termine: true,
        tutoriel_vu_le: new Date().toISOString(),
        visite_quittee_le: new Date().toISOString(),
      })
      .eq('id', data.user.id)
  }
  return { id: data.user.id, email, nom, telephone, db }
}

const image = () =>
  sharp({ create: { width: 1200, height: 900, channels: 3, background: '#3e6db0' } })
    .jpeg({ quality: 80 })
    .toBuffer()

async function annonce(b, statut, ville = 'Cotonou') {
  const { data: logement } = await admin
    .from('logements')
    .insert({ bailleur_id: b.id, adresse: ADRESSE, type: 'Appartement', ville })
    .select('id')
    .single()
  const { data: a, error } = await admin
    .from('annonces')
    .insert({
      bailleur_id: b.id,
      logement_id: logement.id,
      type: 'Appartement',
      ville,
      quartier: 'Agla',
      chambres: 2,
      loyer: 110000,
      description: 'Deux chambres salon, cour close, eau et électricité.',
    })
    .select('id, reference')
    .single()
  if (error) throw new Error(`annonce : ${error.message}`)

  const chemin = `${b.id}/${a.id}/${randomUUID()}.jpg`
  const fichier = await image()
  await admin.storage.from('annonces').upload(chemin, fichier, { contentType: 'image/jpeg' })
  await admin.from('annonce_photos').insert({
    annonce_id: a.id,
    bailleur_id: b.id,
    chemin,
    position: 0,
    largeur: 1200,
    hauteur: 900,
    type_mime: 'image/jpeg',
    poids: fichier.length,
  })
  if (statut !== 'brouillon') await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
  if (statut === 'suspendue') await admin.from('annonces').update({ statut: 'suspendue' }).eq('id', a.id)
  if (statut === 'cloturee') {
    await admin.from('annonces').update({ statut: 'cloturee', motif_cloture: 'retiree' }).eq('id', a.id)
  }
  return a
}

/** Le motif rendu par une fonction, ou le code de l'erreur. */
const motifDe = (r) => r.error?.code ?? r.data?.[0]?.motif ?? '(vide)'

/** Le statut d'une candidature, lu par l'administration. */
const statutDe = async (id) =>
  (await admin.from('candidatures').select('statut').eq('id', id).single()).data?.statut

const lu = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()

async function attendreTexte(page, phrase, ms = 20000) {
  try {
    await page.waitForFunction((p) => document.body.innerText.includes(p), phrase, { timeout: ms })
    return true
  } catch {
    return false
  }
}

;(async () => {
  console.log('\nSikaloc_Find — les candidatures côté bailleur (S8-C)\n')

  // ═══ 1. Le garde-fou ═════════════════════════════════════════════════════
  titre('1. Un banc qui écrit refuse une base distante')

  const CLE_PROD =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    Buffer.from(JSON.stringify({ iss: 'supabase', ref: 'abcdefghijklmnop', role: 'service_role' }))
      .toString('base64')
      .replace(/=+$/, '') +
    '.signature'
  const CLE_LOCALE =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    Buffer.from(JSON.stringify({ iss: 'supabase-demo', role: 'service_role' }))
      .toString('base64')
      .replace(/=+$/, '') +
    '.signature'

  const cas = [
    ['une URL de production', { url: 'https://abc.supabase.co', cles: [CLE_LOCALE] }, false],
    ['une URL vide', { url: '', cles: [CLE_LOCALE] }, false],
    ['une URL illisible', { url: 'pas-une-url', cles: [CLE_LOCALE] }, false],
    ['une clé de production sous une URL locale', { url: 'http://127.0.0.1:54321', cles: [CLE_PROD] }, false],
    ['une clé illisible', { url: 'http://127.0.0.1:54321', cles: ['bonjour'] }, false],
    ['un hôte qui contient « localhost »', { url: 'https://localhost.evil.test', cles: [CLE_LOCALE] }, false],
    ['la pile locale', { url: 'http://127.0.0.1:54321', cles: [CLE_LOCALE] }, true],
    ['la pile locale par son nom', { url: 'http://localhost:54321', cles: [CLE_LOCALE] }, true],
  ]
  for (const [nom, entree, attendu] of cas) {
    const verdict = examinerPileLocale(entree)
    noter(`Garde-fou : ${nom}`, verdict.locale === attendu, verdict.motif)
  }
  noter('L’environnement de ce banc est bien local', examinerPileLocale().locale)

  // ─── Le décor ────────────────────────────────────────────────────────────
  const A = await compte('bailleur-a', 'Adjoa Kpodar')
  const B = await compte('bailleur-b', 'Boni Sagbo')
  const c1 = await compte('candidat-1', 'Chantal Dossa', 'candidat')
  const c2 = await compte('candidat-2', 'Camille Tossou', 'candidat')
  const c3 = await compte('candidat-3', 'Cyrille Ahouandjinou', 'candidat')
  const c4 = await compte('candidat-4', 'Célestine Zomahoun', 'candidat')

  const annonceA = await annonce(A, 'publiee')
  const autreA = await annonce(A, 'publiee', 'Porto-Novo')
  const brouillonA = await annonce(A, 'brouillon')
  const suspendueA = await annonce(A, 'publiee')
  const annonceB = await annonce(B, 'publiee', 'Parakou')

  const poser = async (candidat, reference, message) => {
    const r = await candidat.db.rpc('soumettre_candidature', {
      p_reference: reference,
      p_message: message,
    })
    if (r.data?.[0]?.motif !== 'ok') throw new Error(`candidature : ${motifDe(r)}`)
    const { data } = await admin
      .from('candidatures')
      .select('id')
      .eq('candidat_id', candidat.id)
      .order('created_at', { ascending: false })
      .limit(1)
    return data[0].id
  }

  const k1 = await poser(c1, annonceA.reference, 'Bonjour, je travaille à Agla et cherche pour mars.')
  const k2 = await poser(c2, annonceA.reference, 'Disponible immédiatement, famille de trois.')
  const k3 = await poser(c3, annonceA.reference, null)
  const k4 = await poser(c4, annonceA.reference, 'Je passerai visiter samedi.')
  const kAutre = await poser(c1, autreA.reference, 'Celle-ci m’intéresse aussi.')
  const kB = await poser(c1, annonceB.reference, 'Bonjour, est-elle encore libre ?')
  // Une candidature sur une annonce qui sera ensuite suspendue.
  const kSuspendue = await poser(c2, suspendueA.reference, 'Bonjour.')
  await admin.from('annonces').update({ statut: 'suspendue' }).eq('id', suspendueA.id)

  // ═══ 2. L'accès ══════════════════════════════════════════════════════════
  titre('2. Qui voit quoi')

  const vuesParA = (await A.db.rpc('candidatures_de_mes_annonces')).data ?? []
  const vuesParB = (await B.db.rpc('candidatures_de_mes_annonces')).data ?? []
  const idsA = vuesParA.map((c) => c.candidature_id)
  const idsB = vuesParB.map((c) => c.candidature_id)

  noter('A voit les candidatures de ses annonces', idsA.length === 6, `${idsA.length}`)
  noter('B voit les siennes', idsB.length === 1, `${idsB.length}`)
  noter('A ne voit aucune candidature de B', !idsA.includes(kB))
  noter('B ne voit aucune candidature de A', !idsB.includes(k1))

  const anonyme = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const anonListe = await anonyme.rpc('candidatures_de_mes_annonces')
  noter('Un anonyme est refusé à la lecture', anonListe.error !== null, anonListe.error?.code)
  const anonCompteur = await anonyme.rpc('candidatures_par_annonce')
  noter('…et au décompte', anonCompteur.error !== null, anonCompteur.error?.code)

  const vuesParCandidat = (await c1.db.rpc('candidatures_de_mes_annonces')).data ?? []
  noter('Un candidat n’a aucune annonce, donc aucune candidature à lire', vuesParCandidat.length === 0)

  const filtree = (await A.db.rpc('candidatures_de_mes_annonces', { p_reference: annonceA.reference })).data ?? []
  noter('Filtrer par annonce ne rend que celle-ci', filtree.length === 4, `${filtree.length}`)
  noter('…dans l’ordre, la plus récente d’abord', filtree[0].candidature_id === k4)

  const tentative = (await A.db.rpc('candidatures_de_mes_annonces', { p_reference: annonceB.reference })).data ?? []
  noter('A demandant la référence d’une annonce de B n’obtient rien', tentative.length === 0)

  // ═══ 3. Les données ══════════════════════════════════════════════════════
  titre('3. Ce que le bailleur reçoit, et ce qu’il ne reçoit pas')

  const une = filtree.find((c) => c.candidature_id === k1)
  noter('Le nom du candidat', une.candidat_nom === 'Chantal Dossa', une.candidat_nom)
  noter('Le message', une.message.startsWith('Bonjour, je travaille'))
  noter('Le statut', une.statut === 'envoyee')
  noter('La date de candidature', Boolean(une.deposee_le))
  noter('Pas encore de date de réponse', une.repondue_le === null)
  noter('L’annonce concernée', une.reference === annonceA.reference)

  const colonnes = Object.keys(une).sort()
  noter(
    'Et rien d’autre : sept colonnes, pas une de plus',
    JSON.stringify(colonnes) ===
      JSON.stringify(['candidat_nom', 'candidature_id', 'deposee_le', 'message', 'reference', 'repondue_le', 'statut']),
    colonnes.join(', '),
  )

  const brut = JSON.stringify(vuesParA)
  noter('Aucun téléphone', !brut.includes('+229') && !brut.includes('telephone'))
  noter('Aucun email', !brut.includes('@exemple.test') && !brut.includes('email'))
  noter('Aucun identifiant de compte', ![c1, c2, c3, c4, A, B].some((x) => brut.includes(x.id)))
  noter('Aucun candidat_id', !brut.includes('candidat_id'))
  noter('Aucun identifiant d’annonce', !brut.includes(annonceA.id))

  // ═══ 4. Les transitions ══════════════════════════════════════════════════
  titre('4. Les transitions permises')

  const repondre = (qui, id, statut) =>
    qui.db.rpc('repondre_candidature', { p_candidature_id: id, p_statut: statut })

  noter('envoyée → en étude', motifDe(await repondre(A, k1, 'en_etude')) === 'ok')
  noter('…le statut a changé', (await statutDe(k1)) === 'en_etude')
  noter('…sans date de réponse', (await admin.from('candidatures').select('repondue_le').eq('id', k1).single()).data.repondue_le === null)

  noter('en étude → acceptée', motifDe(await repondre(A, k1, 'acceptee')) === 'ok')
  noter('…avec une date de réponse', Boolean((await admin.from('candidatures').select('repondue_le').eq('id', k1).single()).data.repondue_le))

  noter('envoyée → refusée', motifDe(await repondre(A, k2, 'refusee')) === 'ok')
  noter('refusée → en étude', motifDe(await repondre(A, k2, 'en_etude')) === 'ok')
  noter('en étude → refusée', motifDe(await repondre(A, k2, 'refusee')) === 'ok')
  noter('envoyée → acceptée', motifDe(await repondre(A, k3, 'acceptee')) === 'ok')

  titre('4 bis. Les transitions interdites')

  noter('acceptée → refusée : refusé', motifDe(await repondre(A, k1, 'refusee')) === 'transition_refusee')
  noter('acceptée → en étude : refusé', motifDe(await repondre(A, k1, 'en_etude')) === 'transition_refusee')
  noter('…et l’état n’a pas bougé', (await statutDe(k1)) === 'acceptee')
  noter('refusée → acceptée : refusé', motifDe(await repondre(A, k2, 'acceptee')) === 'transition_refusee')
  noter('…et l’état n’a pas bougé', (await statutDe(k2)) === 'refusee')
  noter(
    'Le bailleur ne peut pas retirer : « retirée » n’est pas une réponse',
    motifDe(await repondre(A, k4, 'retiree')) === 'reponse_invalide',
  )
  noter('…ni remettre à « envoyée »', motifDe(await repondre(A, k4, 'envoyee')) === 'reponse_invalide')
  noter('…et l’état n’a pas bougé', (await statutDe(k4)) === 'envoyee')

  // ═══ 5. Le croisement ════════════════════════════════════════════════════
  titre('5. A avec l’identifiant d’une candidature de B')

  noter('Répondre à la place de B : introuvable', motifDe(await repondre(A, kB, 'acceptee')) === 'introuvable')
  noter('…et rien n’a changé chez B', (await statutDe(kB)) === 'envoyee')
  noter('B ne peut pas répondre à celles de A', motifDe(await repondre(B, k4, 'refusee')) === 'introuvable')
  noter('…et rien n’a changé chez A', (await statutDe(k4)) === 'envoyee')
  noter(
    'Un identifiant inventé : introuvable',
    motifDe(await repondre(A, randomUUID(), 'acceptee')) === 'introuvable',
  )
  const anonReponse = await anonyme.rpc('repondre_candidature', {
    p_candidature_id: k4,
    p_statut: 'acceptee',
  })
  noter('Un anonyme ne répond pas', motifDe(anonReponse) !== 'ok', motifDe(anonReponse))
  noter('…et rien n’a changé', (await statutDe(k4)) === 'envoyee')
  noter(
    'Un candidat ne répond pas aux candidatures qu’il a déposées',
    motifDe(await repondre(c4, k4, 'acceptee')) === 'introuvable',
  )

  // ═══ 6. Acceptations multiples ═══════════════════════════════════════════
  titre('6. Plusieurs acceptations sur la même annonce')

  noter('k1 est acceptée', (await statutDe(k1)) === 'acceptee')
  noter('k3 aussi', (await statutDe(k3)) === 'acceptee')
  const acceptees = (await admin
    .from('candidatures')
    .select('id', { count: 'exact', head: true })
    .eq('annonce_id', annonceA.id)
    .eq('statut', 'acceptee')).count
  noter('Deux acceptations coexistent sur une annonce', acceptees === 2, `${acceptees}`)

  // ═══ 7. Candidature retirée ══════════════════════════════════════════════
  titre('7. Le candidat retire sa candidature')

  noter('Le candidat retire', motifDe(await c4.db.rpc('retirer_candidature', { p_candidature_id: k4 })) === 'ok')
  noter('…l’état est « retirée »', (await statutDe(k4)) === 'retiree')

  const vueApresRetrait = ((await A.db.rpc('candidatures_de_mes_annonces', { p_reference: annonceA.reference })).data ?? [])
    .find((c) => c.candidature_id === k4)
  noter('Le bailleur la voit toujours', Boolean(vueApresRetrait))
  noter('…marquée retirée', vueApresRetrait?.statut === 'retiree')
  for (const statut of ['en_etude', 'acceptee', 'refusee']) {
    noter(`retirée → ${statut} : refusé`, motifDe(await repondre(A, k4, statut)) === 'transition_refusee')
  }
  noter('…et elle est restée retirée', (await statutDe(k4)) === 'retiree')

  // ═══ 8. Le compte du candidat disparaît ══════════════════════════════════
  titre('8. Un candidat supprime son compte')

  await admin.auth.admin.deleteUser(c3.id)
  comptes.splice(comptes.indexOf(c3.id), 1)

  const apresSuppression = ((await A.db.rpc('candidatures_de_mes_annonces', { p_reference: annonceA.reference })).data ?? [])
    .find((c) => c.candidature_id === k3)
  noter('La candidature est conservée', Boolean(apresSuppression))
  noter('…son statut aussi', apresSuppression?.statut === 'acceptee')
  noter('…mais le nom a disparu', apresSuppression?.candidat_nom === null)
  noter('…et aucun reste d’identité', !JSON.stringify(apresSuppression).includes('Cyrille'))
  const { data: profilParti } = await admin.from('candidats').select('id').eq('id', c3.id).maybeSingle()
  noter('Le profil candidat est supprimé', profilParti === null)
  const { data: lienCoupe } = await admin.from('candidatures').select('candidat_id').eq('id', k3).single()
  noter('Le lien est coupé, pas la ligne', lienCoupe.candidat_id === null)

  // ═══ 9. Le décompte ══════════════════════════════════════════════════════
  titre('9. Le compteur par annonce')

  const compteurs = (await A.db.rpc('candidatures_par_annonce')).data ?? []
  const parId = new Map(compteurs.map((c) => [c.annonce_id, c]))
  noter('L’annonce principale est comptée', parId.get(annonceA.id)?.total === 4, `${parId.get(annonceA.id)?.total}`)
  noter('…dont celles sans réponse', parId.get(annonceA.id)?.nouvelles === 0, `${parId.get(annonceA.id)?.nouvelles}`)
  noter('La seconde annonce aussi', parId.get(autreA.id)?.total === 1)
  noter('…sa candidature est sans réponse', parId.get(autreA.id)?.nouvelles === 1)
  noter('Une annonce sans candidature est absente', !parId.has(brouillonA.id))
  noter('Aucune annonce de B dans le décompte de A', !parId.has(annonceB.id))

  const compteursB = (await B.db.rpc('candidatures_par_annonce')).data ?? []
  noter('B a son propre décompte', compteursB.length === 1 && compteursB[0].annonce_id === annonceB.id)

  // ═══ 10. La borne ════════════════════════════════════════════════════════
  titre('10. La liste est bornée')

  const deux = (await A.db.rpc('candidatures_de_mes_annonces', {
    p_reference: annonceA.reference,
    p_limite: 2,
    p_decalage: 0,
  })).data ?? []
  noter('Deux demandées, deux rendues', deux.length === 2)
  const suivantes = (await A.db.rpc('candidatures_de_mes_annonces', {
    p_reference: annonceA.reference,
    p_limite: 2,
    p_decalage: 2,
  })).data ?? []
  noter('Les deux suivantes, sans recouvrement', suivantes.length === 2 && !suivantes.some((c) => deux.some((d) => d.candidature_id === c.candidature_id)))
  const toutes = (await A.db.rpc('candidatures_de_mes_annonces', { p_reference: annonceA.reference })).data ?? []
  noter('Sans borne, la fonction rend tout, comme en S8-A', toutes.length === 4)

  // ═══ 11. Les écrans ══════════════════════════════════════════════════════
  titre('11. Sikaloc_Pro')

  const navigateur = await chromium.launch({
    executablePath: require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })
  const onglet = async () => {
    const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } })
    return contexte.newPage()
  }
  const connecter = async (page, compteConnecte) => {
    await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
    await page.fill('input[name="email"]', compteConnecte.email)
    await page.fill('input[name="motDePasse"]', MDP)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/pro/**', { timeout: 20000 }).catch(() => {})
  }

  const proA = await onglet()
  await connecter(proA, A)

  await proA.goto(`${BASE}/pro/annonces`, { waitUntil: 'networkidle' })
  const texteListe = await lu(proA)
  noter('La liste affiche le nombre de candidatures', texteListe.includes('4 candidatures'))
  noter('…et celles sans réponse', texteListe.includes('1 sans réponse'))
  noter('Le brouillon n’affiche aucun compteur', !texteListe.includes('0 candidature'))

  await proA.goto(`${BASE}/pro/annonces/${annonceA.id}`, { waitUntil: 'networkidle' })
  noter(
    'La fiche mène aux candidatures',
    (await proA.locator(`a[href="/pro/annonces/${annonceA.id}/candidatures"]`).count()) === 1,
  )

  await proA.goto(`${BASE}/pro/annonces/${annonceA.id}/candidatures`, { waitUntil: 'networkidle' })
  const texteRecues = await lu(proA)
  noter('Les noms des candidats', texteRecues.includes('Chantal Dossa') && texteRecues.includes('Camille Tossou'))
  noter('Les messages', texteRecues.includes('je travaille à Agla'))
  noter('Une candidature sans message le dit', texteRecues.includes('Sans message'))
  noter('Le candidat supprimé est neutre', texteRecues.includes('Candidat supprimé'))
  noter('…et son nom n’apparaît nulle part', !texteRecues.includes('Cyrille'))
  noter('Les statuts', texteRecues.includes('Acceptée') && texteRecues.includes('Refusée') && texteRecues.includes('Retirée'))
  noter('La référence de l’annonce', texteRecues.includes(`Réf. ${annonceA.reference}`))
  noter('Il est dit que le contact n’est pas transmis', texteRecues.includes('ne vous sont pas communiqués'))

  const htmlRecues = await proA.content()
  noter('Aucun téléphone à l’écran', !htmlRecues.includes('+229') && !/tel:|wa\.me|mailto:[^"]*exemple/.test(htmlRecues))
  noter('Aucun email de candidat', ![c1, c2, c4].some((x) => htmlRecues.includes(x.email)))
  noter('Aucun identifiant de compte', ![c1, c2, c4].some((x) => htmlRecues.includes(x.id)))

  noter('Aucun bouton de contact', !/Appeler|WhatsApp|Contacter le candidat/.test(texteRecues))
  noter('Une candidature retirée n’offre aucune action', texteRecues.includes('Le candidat a retiré sa candidature'))
  noter('Une candidature acceptée non plus', texteRecues.includes('Candidature acceptée.'))

  // Agir, vraiment : la dernière encore « envoyée » est celle de l'autre annonce.
  await proA.goto(`${BASE}/pro/annonces/${autreA.id}/candidatures`, { waitUntil: 'networkidle' })
  await proA.click('button:has-text("Mettre à l’étude")')
  noter('« Mettre à l’étude » agit', await attendreTexte(proA, 'En étude'))
  noter('…et la base l’enregistre', (await statutDe(kAutre)) === 'en_etude')

  await proA.click('button:has-text("Refuser")')
  const confirmation = await attendreTexte(proA, 'Êtes-vous sûr de vouloir refuser cette candidature ?')
  noter('« Refuser » demande confirmation', confirmation)
  noter('…et n’a encore rien changé', (await statutDe(kAutre)) === 'en_etude')
  await proA.click('button:has-text("Annuler")')
  noter('On peut annuler', (await statutDe(kAutre)) === 'en_etude')

  await proA.click('button:has-text("Accepter")')
  noter(
    '« Accepter » demande confirmation',
    await attendreTexte(proA, 'Êtes-vous sûr de vouloir accepter cette candidature ?'),
  )
  noter('…et prévient qu’aucun bail n’est créé', (await lu(proA)).includes('ne crée pas de bail'))
  await proA.locator('button:has-text("Accepter")').last().click()
  noter('…la confirmation agit', await attendreTexte(proA, 'Acceptée'))
  noter('…et la base l’enregistre', (await statutDe(kAutre)) === 'acceptee')

  // Les états vides, selon l'annonce.
  await proA.goto(`${BASE}/pro/annonces/${brouillonA.id}/candidatures`, { waitUntil: 'networkidle' })
  const vide = await lu(proA)
  noter('Un brouillon : état vide expliqué', vide.includes('Aucune candidature') && vide.includes('encore un brouillon'))
  noter('…sans message anxiogène', !/erreur|échec|problème/i.test(vide))

  await proA.goto(`${BASE}/pro/annonces/${suspendueA.id}/candidatures`, { waitUntil: 'networkidle' })
  noter('Une annonce suspendue le dit', (await lu(proA)).includes('suspendue'))
  noter('…et ses candidatures restent lisibles', (await lu(proA)).includes('Camille Tossou'))

  // Le croisement, depuis le navigateur.
  const reponseB = await proA.goto(`${BASE}/pro/annonces/${annonceB.id}/candidatures`, { waitUntil: 'networkidle' })
  noter('L’annonce de B répond 404 à A', reponseB.status() === 404, String(reponseB.status()))
  const reponseFantome = await proA.goto(`${BASE}/pro/annonces/${randomUUID()}/candidatures`, { waitUntil: 'networkidle' })
  noter('Un identifiant inconnu aussi', reponseFantome.status() === 404)
  const reponseMalFormee = await proA.goto(`${BASE}/pro/annonces/pas-un-uuid/candidatures`, { waitUntil: 'networkidle' })
  noter('Un identifiant mal formé aussi', reponseMalFormee.status() === 404)

  // Un candidat n'entre pas dans Pro.
  const proCandidat = await onglet()
  await proCandidat.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await proCandidat.fill('input[name="email"]', c1.email)
  await proCandidat.fill('input[name="motDePasse"]', MDP)
  await proCandidat.click('button[type="submit"]')
  await proCandidat.waitForURL('**/me/**', { timeout: 20000 }).catch(() => {})
  await proCandidat.goto(`${BASE}/pro/annonces/${annonceA.id}/candidatures`, { waitUntil: 'networkidle' })
  noter('Un candidat n’atteint pas les candidatures de A', !proCandidat.url().includes('/candidatures') || (await lu(proCandidat)).includes('Chantal') === false, proCandidat.url())

  const anonymePage = await onglet()
  await anonymePage.goto(`${BASE}/pro/annonces/${annonceA.id}/candidatures`, { waitUntil: 'networkidle' })
  noter('Un visiteur est renvoyé vers la connexion', anonymePage.url().includes('/connexion'), anonymePage.url())

  // Responsive : la liste reste lisible et ne déborde pas.
  for (const largeur of [375, 768, 1280]) {
    const petit = await navigateur.newContext({ viewport: { width: largeur, height: 900 } })
    const page = await petit.newPage()
    await page.context().addCookies(await proA.context().cookies())
    await page.goto(`${BASE}/pro/annonces/${annonceA.id}/candidatures`, { waitUntil: 'networkidle' })
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    noter(`À ${largeur} px : aucun débordement horizontal`, !debordement)
    noter(`…et les candidatures sont lisibles`, (await lu(page)).includes('Chantal Dossa'))
    await petit.close()
  }

  await navigateur.close()

  // ─── Ménage ──────────────────────────────────────────────────────────────
  for (const id of comptes) {
    const { data: dossiers } = await admin.storage.from('annonces').list(id, { limit: 100 })
    for (const dossier of dossiers ?? []) {
      const { data: f } = await admin.storage.from('annonces').list(`${id}/${dossier.name}`)
      if (f?.length) {
        await admin.storage.from('annonces').remove(f.map((x) => `${id}/${dossier.name}/${x.name}`))
      }
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
