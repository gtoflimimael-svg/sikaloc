/**
 * Banc de la recherche — Sikaloc_Find, S7.
 *
 *   supabase start · env pointant sur la pile locale · npm run build && npm run start
 *   npm run banc:find-recherche
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. La sémantique de chaque filtre, sur un jeu d'annonces connu — dont deux
 *      écrites « ouidah » et « pahou », pour vérifier que la casse et les
 *      espaces ne créent ni doublon ni oubli.
 *   2. Les équipements en ET, jamais en OU.
 *   3. Les valeurs douteuses : ignorées, jamais d'erreur SQL ni de page cassée.
 *   4. La pagination qui garde les filtres, sans doublon ni trou.
 *   5. Le référencement : une recherche filtrée ne s'indexe pas.
 *   6. L'interface : pastilles, retrait d'un filtre, réinitialisation, panneau
 *      mobile, clavier.
 *
 * Le jeu d'essai vit dans deux villes que les autres bancs n'utilisent pas :
 * les résultats sont donc exactement prévisibles.
 */
const { randomUUID } = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')
const { chromium } = require('playwright-core')
const sharp = require('sharp')

const BASE = process.env.BASE_ONBOARDING || 'http://localhost:3000'
const { exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

exigerPileLocale('Ce banc')

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const visiteur = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'
const ADRESSE = 'Lot 12, route de Ouidah'

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)
const comptes = []
const secrets = [ADRESSE]

/** Les références affichées, dans l'ordre de la page (voir banc-find). */
const referencesDe = (html) => {
  const cartes = /<ul[^>]*aria-label="Annonces"[^>]*>([\s\S]*?)<\/ul><nav|<ul[^>]*aria-label="Annonces"[^>]*>([\s\S]*)<\/main>/.exec(html)
  const zone = cartes ? (cartes[1] ?? cartes[2]) : ''
  return [...zone.matchAll(/Réf\.\s*(?:<!-- -->)?\s*([0-9a-hjkmnp-tv-z]{10})/g)].map((m) => m[1])
}

const page = async (chemin) => {
  const r = await fetch(`${BASE}${chemin}`, { redirect: 'manual' })
  const html = r.status === 200 ? await r.text() : ''
  return { statut: r.status, entetes: r.headers, html, refs: referencesDe(html) }
}

/** Les références attendues, dans l'ordre du tri (les plus récentes d'abord). */
const memeEnsemble = (obtenues, attendues) =>
  obtenues.length === attendues.length && attendues.every((r) => obtenues.includes(r))

;(async () => {
  console.log('\nSikaloc_Find — la recherche (S7)\n')

  const email = `banc-recherche-${Date.now()}@exemple.test`
  const { data: compte, error: eCompte } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom: 'Banc Recherche', telephone: '+2290190000015' },
  })
  if (eCompte) throw new Error(eCompte.message)
  const bailleurId = compte.user.id
  comptes.push(bailleurId)
  secrets.push(bailleurId, email)
  const session = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await session.auth.signInWithPassword({ email, password: MDP })

  const fichier = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#4e8a3e' } })
    .jpeg({ quality: 70 })
    .toBuffer()

  /** Une annonce publiée, avec sa photo réellement déposée. */
  async function annonce(champs) {
    const { data: logement } = await admin
      .from('logements')
      .insert({ bailleur_id: bailleurId, adresse: ADRESSE, type: 'Appartement', ville: champs.ville })
      .select('id')
      .single()
    const { data: a, error } = await admin
      .from('annonces')
      .insert({
        bailleur_id: bailleurId,
        logement_id: logement.id,
        description: 'Annonce du banc de recherche, publiée pour les filtres.',
        ...champs,
      })
      .select('id, reference')
      .single()
    if (error) throw new Error(`annonce : ${error.message}`)
    const chemin = `${bailleurId}/${a.id}/${randomUUID()}.jpg`
    await admin.storage.from('annonces').upload(chemin, fichier, { contentType: 'image/jpeg' })
    await admin.from('annonce_photos').insert({
      annonce_id: a.id,
      bailleur_id: bailleurId,
      chemin,
      position: 0,
      largeur: 1600,
      hauteur: 1200,
      type_mime: 'image/jpeg',
      poids: fichier.length,
    })
    await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
    secrets.push(logement.id, a.id, chemin)
    return a.reference
  }

  // Le jeu d'essai. A4 écrit la ville et le quartier autrement : « ouidah »,
  // « pahou », avec des espaces — la recherche doit les retrouver quand même.
  const A1 = await annonce({ type: 'Appartement', ville: 'Ouidah', quartier: 'Pahou', chambres: 2, surface_m2: 60, loyer: 100000, charges: 5000, avance_mois: 2, equipements: ['eau_courante', 'parking'] })
  const A2 = await annonce({ type: 'Maison', ville: 'Ouidah', quartier: 'Pahou', chambres: 3, surface_m2: 120, loyer: 200000, charges: 0, equipements: ['eau_courante', 'parking', 'climatisation'], disponible_le: '2099-01-01' })
  const A3 = await annonce({ type: 'Studio', ville: 'Ouidah', quartier: 'Gakpé', chambres: 0, loyer: 50000, charges: 0, equipements: ['electricite'], disponible_le: '2020-01-01' })
  const A4 = await annonce({ type: 'Appartement', ville: '  ouidah ', quartier: ' pahou', chambres: 2, surface_m2: 45, loyer: 150000, equipements: ['parking'] })
  const A5 = await annonce({ type: 'Appartement', ville: 'Abomey-Calavi', quartier: 'Zopah', chambres: 1, surface_m2: 30, loyer: 80000, equipements: [] })

  const volume = []
  for (let i = 0; i < 26; i++) {
    volume.push(
      await annonce({ type: 'Appartement', ville: 'Abomey-Calavi', quartier: 'Zopah', chambres: 1, surface_m2: 32, loyer: 81000 + i * 1000, equipements: ['eau_courante'] }),
    )
  }
  const calavi = [A5, ...volume]

  // ═══ 1. Sans filtre : le catalogue de S5 ════════════════════════════════
  titre('1. Sans filtre, rien ne change')

  const sansFiltre = await page('/find')
  const { data: catalogue } = await visiteur.rpc('annonces_publiees', { p_limite: 24, p_decalage: 0 })
  noter(
    '/find sans filtre rend exactement le catalogue de S5',
    sansFiltre.statut === 200 && JSON.stringify(sansFiltre.refs) === JSON.stringify(catalogue.map((l) => l.reference)),
  )
  noter('Aucune pastille de filtre', !sansFiltre.html.includes('Filtres actifs') || !/retirer ce filtre/.test(sansFiltre.html))
  noter('/find reste indexable', !/name="robots" content="[^"]*noindex/.test(sansFiltre.html))

  // ═══ 2. Chaque filtre ═══════════════════════════════════════════════════
  titre('2. La sémantique de chaque filtre')

  const cas = [
    ['ville=Ouidah : les quatre annonces de Ouidah, casse comprise', 'ville=Ouidah', [A1, A2, A3, A4]],
    ['ville=ouidah : le même résultat', 'ville=ouidah', [A1, A2, A3, A4]],
    ['quartier=Pahou : « pahou » en fait partie', 'quartier=Pahou', [A1, A2, A4]],
    ['type=Studio', 'type=Studio&ville=Ouidah', [A3]],
    ['loyer_min=150000 (borne incluse)', 'ville=Ouidah&loyer_min=150000', [A2, A4]],
    ['loyer_max=100000 (borne incluse)', 'ville=Ouidah&loyer_max=100000', [A1, A3]],
    ['loyer entre 100 000 et 150 000', 'ville=Ouidah&loyer_min=100000&loyer_max=150000', [A1, A4]],
    ['chambres=2 : égalité exacte', 'ville=Ouidah&chambres=2', [A1, A4]],
    ['chambres=0 : l’entrer-coucher', 'ville=Ouidah&chambres=0', [A3]],
    ['surface_min=100', 'ville=Ouidah&surface_min=100', [A2]],
    ['surface_max=50 : sans surface, l’annonce est écartée', 'ville=Ouidah&surface_max=50', [A4]],
    ['disponible=maintenant : la date future est écartée', 'ville=Ouidah&disponible=maintenant', [A1, A3, A4]],
    ['un équipement', 'ville=Ouidah&equipements=parking', [A1, A2, A4]],
    ['deux équipements : ET, jamais OU', 'ville=Ouidah&equipements=parking,climatisation', [A2]],
    ['ville + prix', 'ville=Ouidah&loyer_max=120000', [A1, A3]],
    ['ville + chambres', 'ville=Ouidah&chambres=3', [A2]],
    ['prix + équipements', 'equipements=parking&loyer_min=150000', [A2, A4]],
    ['combinaison complète', 'ville=Ouidah&quartier=Pahou&type=Appartement&chambres=2&loyer_max=160000&equipements=parking&disponible=maintenant', [A1, A4]],
  ]
  for (const [nom, requete, attendues] of cas) {
    const r = await page(`/find?${requete}`)
    noter(nom, r.statut === 200 && memeEnsemble(r.refs, attendues), `${r.refs.length} résultat(s)`)
  }

  const ordreAttendu = (await visiteur.rpc('annonces_recherche', { p_ville: 'Ouidah', p_limite: 24, p_decalage: 0 })).data.map((l) => l.reference)
  noter('Le tri reste celui du catalogue : les plus récentes d’abord', JSON.stringify((await page('/find?ville=Ouidah')).refs) === JSON.stringify(ordreAttendu))

  // ═══ 3. Pagination avec filtres ═════════════════════════════════════════
  titre('3. Pagination et filtres')

  const p1 = await page('/find?ville=Abomey-Calavi')
  const p2 = await page('/find?ville=Abomey-Calavi&page=2')
  noter('Page 1 : 24 résultats filtrés', p1.refs.length === 24 && p1.refs.every((r) => calavi.includes(r)))
  noter('Page 2 : les trois derniers', p2.statut === 200 && p2.refs.length === 3 && p2.refs.every((r) => calavi.includes(r)))
  noter('Ni doublon, ni trou : les 27 annonces, une fois chacune', new Set([...p1.refs, ...p2.refs]).size === 27 && calavi.every((r) => [...p1.refs, ...p2.refs].includes(r)))
  noter('« Page suivante » garde le filtre', p1.html.includes('href="/find?ville=Abomey-Calavi&amp;page=2"'))
  noter('« Page précédente » garde le filtre et revient à la page 1', p2.html.includes('href="/find?ville=Abomey-Calavi"'))
  noter('Aucun total affiché', !/\b27\b\s*(résultats|annonces|logements)/i.test(p1.html))
  noter('Page 3 d’une recherche qui n’en a que 2 : 404', (await page('/find?ville=Abomey-Calavi&page=3')).statut === 404)
  const retirer = await page('/find?ville=Abomey-Calavi&chambres=1&page=2')
  noter('Retirer un filtre depuis la page 2 ramène à la page 1', retirer.html.includes('href="/find?ville=Abomey-Calavi"') && !retirer.html.includes('href="/find?ville=Abomey-Calavi&amp;page=2&amp;'))

  // ═══ 4. URL ═════════════════════════════════════════════════════════════
  titre('4. Ce que l’URL accepte, et ce qu’elle ignore')

  const reference = (await page('/find?ville=Ouidah&chambres=2')).refs
  noter("L'ordre des paramètres ne change rien", JSON.stringify((await page('/find?chambres=2&ville=Ouidah')).refs) === JSON.stringify(reference))
  const ignores = [
    ['paramètre inconnu', 'ville=Ouidah&chambres=2&foo=bar'],
    ['paramètre vide', 'ville=Ouidah&chambres=2&type='],
    ['valeur répétée', 'ville=Ouidah&chambres=2&type=Studio&type=Maison'],
    ['loyer négatif', 'ville=Ouidah&chambres=2&loyer_min=-100'],
    ['chambres négatives', 'ville=Ouidah&chambres=2&surface_min=-5'],
    ['nombre démesuré', 'ville=Ouidah&chambres=2&loyer_max=999999999999'],
    ['valeur décimale', 'ville=Ouidah&chambres=2&surface_max=12.5'],
    ['texte à la place d’un nombre', 'ville=Ouidah&chambres=2&loyer_min=beaucoup'],
    ['chaîne très longue', `ville=Ouidah&chambres=2&quartier=${'a'.repeat(300)}`],
    ['équipement inconnu', 'ville=Ouidah&chambres=2&equipements=piscine'],
    ['tentative d’injection', "ville=Ouidah&chambres=2&type=') or 1=1--"],
  ]
  for (const [nom, requete] of ignores) {
    const r = await page(`/find?${requete}`)
    noter(`${nom} : ignoré, la recherche reste valable`, r.statut === 200 && JSON.stringify(r.refs) === JSON.stringify(reference), `HTTP ${r.statut}, ${r.refs.length} résultat(s)`)
  }
  const villeRepetee = await page('/find?ville=Ouidah&ville=Abomey-Calavi')
  noter('Ville répétée : le filtre entier est ignoré', villeRepetee.statut === 200 && villeRepetee.refs.length === 24)

  for (const [nom, requete] of [['page=abc', 'ville=Ouidah&page=abc'], ['page=-10', 'ville=Ouidah&page=-10'], ['page=1.5', 'ville=Ouidah&page=1.5'], ['page=0', 'page=0']]) {
    noter(`${nom} : 404`, (await page(`/find?${requete}`)).statut === 404)
  }
  const p1Redirigee = await page('/find?ville=Ouidah&page=1')
  noter('page=1 redirige vers l’URL sans page, filtres conservés', [307, 308].includes(p1Redirigee.statut) && p1Redirigee.entetes.get('location') === '/find?ville=Ouidah', `${p1Redirigee.statut} → ${p1Redirigee.entetes.get('location')}`)

  // ═══ 5. Référencement ═══════════════════════════════════════════════════
  titre('5. Référencement')

  const filtree = await page('/find?ville=Ouidah')
  noter('Une recherche filtrée n’est pas indexable', /name="robots" content="noindex, follow"/.test(filtree.html))
  noter('…et sa canonique pointe vers /find', filtree.html.includes('<link rel="canonical" href="https://sikaloc.com/find"'))
  noter('/find?page=2 reste noindex', /name="robots" content="noindex, follow"/.test((await page('/find?page=2')).html))
  noter('Aucun titre inventé pour les filtres', /<title>Logements à louer au Bénin — Sikaloc_Find<\/title>/.test(filtree.html))

  // ═══ 6. Sécurité ════════════════════════════════════════════════════════
  titre('6. Sécurité')

  const parVisiteur = await visiteur.rpc('annonces_recherche', { p_ville: 'Ouidah', p_limite: 24, p_decalage: 0 })
  const parCompte = await session.rpc('annonces_recherche', { p_ville: 'Ouidah', p_limite: 24, p_decalage: 0 })
  noter('Visiteur et compte connecté obtiennent le même résultat', JSON.stringify(parVisiteur.data) === JSON.stringify(parCompte.data))
  noter('La projection n’ajoute aucune colonne privée', JSON.stringify(Object.keys(parVisiteur.data[0])) === JSON.stringify(['reference','type','ville','quartier','chambres','surface_m2','loyer','charges','depot_garantie','avance_mois','equipements','description','disponible_le','publiee_le','photo_position','photo_largeur','photo_hauteur']))
  // Un compte TIERS : la session du banc est propriétaire de ces annonces, et
  // les politiques de S1 lui rendent légitimement ses propres lignes.
  const tiersEmail = `banc-recherche-tiers-${Date.now()}@exemple.test`
  const { data: tiers } = await admin.auth.admin.createUser({ email: tiersEmail, password: MDP, email_confirm: true, user_metadata: { nom: 'Banc Tiers', telephone: '+2290190000016' } })
  comptes.push(tiers.user.id)
  const sessionTiers = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await sessionTiers.auth.signInWithPassword({ email: tiersEmail, password: MDP })

  for (const [qui, client] of [['Un visiteur', visiteur], ['Un autre compte connecté', sessionTiers]]) {
    for (const table of ['annonces', 'annonce_photos', 'logements']) {
      const { data, error } = await client.from(table).select('id').eq('bailleur_id', bailleurId).limit(1)
      noter(`${qui} ne lit pas \`${table}\``, Boolean(error) || data.length === 0, error?.code)
    }
  }
  const trouves = secrets.filter((s) => filtree.html.includes(s))
  noter('Aucune donnée privée dans une page filtrée', trouves.length === 0, trouves.join(', '))

  // ═══ 7. L'interface ═════════════════════════════════════════════════════
  titre('7. L’interface')

  const navigateur = await chromium.launch({
    executablePath: require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })
  const bureau = await navigateur.newPage({ viewport: { width: 1280, height: 900 } })
  await bureau.goto(`${BASE}/find?ville=Ouidah&chambres=2&loyer_max=150000&equipements=parking`, { waitUntil: 'networkidle' })

  // Les montants portent des espaces insécables : on compare sur un texte normalisé.
  const normaliser = (t) => t.replace(/[\u202f\u00a0]/g, ' ').replace(/\s+/g, ' ').trim()
  const libelles = (await bureau.locator('main ul li a[href^="/find"]').allInnerTexts()).map(normaliser)
  noter(
    'Les filtres actifs s’affichent en clair',
    ['Ouidah', '2 chambres', 'Parking'].every((l) => libelles.some((t) => t.includes(l))) &&
      libelles.some((t) => t.includes('150 000 FCFA')),
    libelles.slice(0, 4).join(' | '),
  )
  // `Link` navigue côté client : l'URL change APRÈS le clic, et `networkidle`
  // peut se déclencher avant. On attend l'adresse, pas le réseau.
  await bureau.getByRole('link', { name: /^Parking/ }).first().click()
  await bureau.waitForURL((u) => !u.search.includes('equipements'), { timeout: 10000 })
  const apresRetrait = new URL(bureau.url())
  noter(
    'Retirer « Parking » ne retire que lui',
    !apresRetrait.searchParams.has('equipements') && apresRetrait.searchParams.get('ville') === 'Ouidah' &&
      apresRetrait.searchParams.get('chambres') === '2' && apresRetrait.searchParams.get('loyer_max') === '150000',
    apresRetrait.search,
  )
  await bureau.getByRole('link', { name: 'Réinitialiser', exact: true }).first().click()
  await bureau.waitForURL(/\/find$/)
  noter('« Réinitialiser » ramène à /find', new URL(bureau.url()).search === '')

  await bureau.goto(`${BASE}/find?ville=Ouidah&page=2`, { waitUntil: 'networkidle' }).catch(() => {})
  await bureau.goto(`${BASE}/find`, { waitUntil: 'networkidle' })
  noter('Le formulaire est visible sans clic sur grand écran', await bureau.locator('form[aria-label="Filtrer les logements"]').isVisible())
  await bureau.selectOption('#f-ville', 'Ouidah')
  await bureau.selectOption('#f-chambres', '2')
  await bureau.getByRole('button', { name: 'Voir les résultats' }).click()
  await bureau.waitForURL(/ville=Ouidah/)
  const apresEnvoi = new URL(bureau.url())
  noter(
    'Le formulaire écrit la recherche dans l’URL, sans champ vide ni page',
    apresEnvoi.searchParams.get('ville') === 'Ouidah' && apresEnvoi.searchParams.get('chambres') === '2' &&
      !apresEnvoi.searchParams.has('page') && ![...apresEnvoi.searchParams.values()].some((v) => v === ''),
    apresEnvoi.search,
  )
  noter('Les résultats correspondent', memeEnsemble(referencesDe(await bureau.content()), [A1, A4]))

  const vide = await page('/find?ville=Ouidah&loyer_max=1')
  noter(
    'Aucun résultat : le dire, et proposer de réinitialiser',
    vide.statut === 200 && vide.html.includes('Aucun logement ne correspond à ces critères') && vide.html.includes('Réinitialiser les filtres') && vide.refs.length === 0,
  )

  const mobile = await navigateur.newPage({ viewport: { width: 375, height: 812 } })
  await mobile.goto(`${BASE}/find?ville=Ouidah`, { waitUntil: 'networkidle' })
  const formulaireMobile = mobile.locator('form[aria-label="Filtrer les logements"]')
  noter('Mobile : le formulaire est replié derrière « Filtrer »', !(await formulaireMobile.isVisible()))
  const bouton = mobile.getByRole('button', { name: /Filtrer/ })
  noter('Le bouton annonce son état (aria-expanded)', (await bouton.getAttribute('aria-expanded')) === 'false' && (await bouton.innerText()).includes('(1)'))
  await bouton.click()
  noter('Un clic ouvre le panneau', await formulaireMobile.isVisible() && (await mobile.getByRole('button', { name: /Fermer les filtres/ }).getAttribute('aria-expanded')) === 'true')
  noter('Les filtres actifs y sont conservés', (await mobile.locator('#f-ville').inputValue()) === 'Ouidah')

  for (const [largeur, hauteur] of [[375, 812], [768, 1024], [1280, 900]]) {
    const p = await navigateur.newPage({ viewport: { width: largeur, height: hauteur } })
    await p.goto(`${BASE}/find?ville=Abomey-Calavi`, { waitUntil: 'networkidle' })
    noter(`${largeur} px : aucun débordement horizontal`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await p.close()
  }

  const clavier = await navigateur.newPage({ viewport: { width: 1280, height: 900 } })
  await clavier.goto(`${BASE}/find`, { waitUntil: 'networkidle' })
  let atteint = false
  let contour = ''
  for (let i = 0; i < 40 && !atteint; i++) {
    await clavier.keyboard.press('Tab')
    const etat = await clavier.evaluate(() => {
      const el = document.activeElement
      const s = el ? getComputedStyle(el) : null
      return { id: el?.id || '', contour: s ? `${s.outlineStyle} ${s.outlineWidth}` : '' }
    })
    if (etat.id === 'f-ville') {
      atteint = true
      contour = etat.contour
    }
  }
  noter('Au clavier, on atteint le champ « Ville »', atteint)
  noter('…et son libellé lui est associé', (await clavier.locator('label[for="f-ville"]').innerText()).includes('Ville'))
  noter('…focus visible', atteint && !/^none/.test(contour), contour)

  await navigateur.close()

  // ─── Ménage ────────────────────────────────────────────────────────────
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
