/**
 * Banc du catalogue public — Sikaloc_Find, S5.
 *
 *   supabase start · env pointant sur la pile locale · npm run build && npm run start
 *   npm run banc:find
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. `/find` s'ouvre sans compte, et n'affiche que des annonces publiées.
 *   2. La pagination : 24 par page, ni doublon ni trou, l'ordre de S2, et une
 *      404 pour toute page qui n'en est pas une.
 *   3. La route photo : une photo d'annonce publiée, et la même 404 pour tout
 *      le reste. Aucun chemin de stockage, nulle part.
 *   4. La frontière de S2 tient toujours : ni table, ni bucket, ni fonction
 *      interne n'est atteignable par un visiteur ou un compte.
 *   5. Mobile, bureau, clavier.
 *
 * La vérité attendue est ce que rend `annonces_publiees` : le banc ne suppose
 * pas être seul en base.
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
const ADRESSE = 'Lot 55, derrière la station Jonquet'

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)
const comptes = []
const secrets = [ADRESSE]

/**
 * Les références affichées, dans l'ordre de la page. React sépare « Réf. » et
 * la valeur par un commentaire `<!-- -->` : deux nœuds de texte, un seul
 * affichage. Seule la section des cartes est lue — la charge RSC embarquée
 * dans la page répète les mêmes données.
 */
const referencesDe = (html) => {
  const cartes = /<ul[^>]*aria-label="Annonces"[^>]*>([\s\S]*?)<\/ul><nav|<ul[^>]*aria-label="Annonces"[^>]*>([\s\S]*)<\/main>/.exec(html)
  const zone = cartes ? cartes[1] ?? cartes[2] : ''
  return [...zone.matchAll(/Réf\.\s*(?:<!-- -->)?\s*([0-9a-hjkmnp-tv-z]{10})/g)].map((m) => m[1])
}

async function bailleur(cle) {
  const email = `banc-find-${cle}-${Date.now()}@exemple.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom: `Banc Find ${cle}`, telephone: '+2290190000014' },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user.id)
  secrets.push(data.user.id, email)
  const db = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await db.auth.signInWithPassword({ email, password: MDP })
  return { id: data.user.id, db }
}

/**
 * `n` annonces publiées, avec un vrai fichier au bout de chaque photo. La clé
 * de service ne sert qu'à aller vite : les déclencheurs de S1 s'appliquent.
 */
async function annonces(b, n, statutFinal, fichier) {
  const { data: logements } = await admin
    .from('logements')
    .insert(Array.from({ length: n }, () => ({ bailleur_id: b.id, adresse: ADRESSE, type: 'Appartement', ville: 'Cotonou' })))
    .select('id')
  secrets.push(...logements.map((l) => l.id))
  const { data: lignes } = await admin
    .from('annonces')
    .insert(
      logements.map((l, i) => ({
        bailleur_id: b.id,
        logement_id: l.id,
        type: i % 3 === 0 ? 'Studio' : 'Appartement',
        ville: 'Cotonou',
        quartier: ['Fidjrossè', 'Cadjèhoun', 'Akpakpa'][i % 3],
        chambres: i % 4,
        surface_m2: i % 2 ? 45 + i : null,
        loyer: 40000 + i * 5000,
        charges: [null, 0, 5000][i % 3],
        equipements: ['compteur_electrique_individuel', 'douche_interieure', 'cour_cloturee', 'eau_courante'],
        description: 'Logement de test du catalogue, propre et bien situé.',
        disponible_le: i % 5 === 0 ? '2099-01-01' : null,
      })),
    )
    .select('id, reference')
  secrets.push(...lignes.map((a) => a.id))
  const photos = lignes.map((a) => ({
    annonce_id: a.id,
    bailleur_id: b.id,
    chemin: `${b.id}/${a.id}/${randomUUID()}.jpg`,
    position: 0,
    largeur: 1600,
    hauteur: 1200,
    type_mime: 'image/jpeg',
    poids: fichier.length,
  }))
  for (const p of photos) {
    const { error } = await admin.storage.from('annonces').upload(p.chemin, fichier, { contentType: 'image/jpeg' })
    if (error) throw new Error(`fichier : ${error.message}`)
  }
  await admin.from('annonce_photos').insert(photos)
  if (statutFinal !== 'brouillon') {
    // Une à une : `publiee_le` départage l'ordre, et le banc le vérifie.
    for (const a of lignes) await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
  }
  if (statutFinal === 'suspendue' || statutFinal === 'cloturee') {
    await admin
      .from('annonces')
      .update(statutFinal === 'suspendue' ? { statut: 'suspendue' } : { statut: 'cloturee', motif_cloture: 'retiree' })
      .in('id', lignes.map((a) => a.id))
  }
  return lignes.map((a, i) => ({ ...a, chemin: photos[i].chemin }))
}

async function catalogueComplet() {
  const tout = []
  for (let d = 0; ; d += 48) {
    const { data } = await visiteur.rpc('annonces_publiees', { p_limite: 48, p_decalage: d })
    tout.push(...data)
    if (data.length < 48) return tout.map((l) => l.reference)
  }
}

const page = async (chemin, options = {}) => {
  const r = await fetch(`${BASE}${chemin}`, { redirect: 'manual', ...options })
  return { statut: r.status, entetes: r.headers, html: r.status === 200 ? await r.text() : '' }
}

;(async () => {
  console.log('\nSikaloc_Find — le catalogue public (S5)\n')

  const fichier = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#3e6db0' } })
    .jpeg({ quality: 80 })
    .toBuffer()
  const D = await bailleur('d')
  const publiees = await annonces(D, 30, 'publiee', fichier)
  const [brouillon] = await annonces(D, 1, 'brouillon', fichier)
  const [suspendue] = await annonces(D, 1, 'suspendue', fichier)
  const [cloturee] = await annonces(D, 1, 'cloturee', fichier)
  secrets.push(...[...publiees, brouillon, suspendue, cloturee].map((a) => a.chemin))

  const verite = await catalogueComplet()
  const total = verite.length

  // ═══ 1. Public ══════════════════════════════════════════════════════════
  titre('1. Un visiteur, sans compte')

  const p1 = await page('/find')
  noter('/find répond 200, sans redirection vers une connexion', p1.statut === 200, `HTTP ${p1.statut}`)
  noter('Nos trente annonces publiées sont au catalogue', publiees.every((a) => verite.includes(a.reference)), `${total} au total`)
  const trouves = secrets.filter((s) => p1.html.includes(s))
  noter('Aucune donnée privée dans la page (identifiants, adresse, email, chemins)', trouves.length === 0, trouves.join(', '))
  noter('Aucun chemin de stockage dans la page', !/[0-9a-f-]{36}\/[0-9a-f-]{36}\//.test(p1.html))

  // ═══ 2. Pagination ══════════════════════════════════════════════════════
  titre('2. Pagination')

  const refs1 = referencesDe(p1.html)
  noter('Page 1 : 24 annonces, dans l’ordre de S2', refs1.length === 24 && JSON.stringify(refs1) === JSON.stringify(verite.slice(0, 24)), `${refs1.length} lue(s)`)
  noter('Page 1 : « Page suivante » vers /find?page=2, pas de « précédente »', p1.html.includes('href="/find?page=2"') && !p1.html.includes('Page précédente'))
  const p2 = await page('/find?page=2')
  const refs2 = referencesDe(p2.html)
  noter('Page 2 : la suite exacte', p2.statut === 200 && JSON.stringify(refs2) === JSON.stringify(verite.slice(24, 48)))
  noter(
    'Pages 1 et 2 : ni doublon, ni trou',
    refs1.length > 0 && refs2.length > 0 &&
      new Set([...refs1, ...refs2]).size === refs1.length + refs2.length &&
      [...refs1, ...refs2].every((r, i) => r === verite[i]),
    `${refs1.length} + ${refs2.length}`,
  )
  noter('Page 2 : « Page précédente » vers /find', p2.html.includes('href="/find"') && p2.html.includes('Page précédente'))
  const derniere = Math.ceil(total / 24)
  const pDerniere = await page(`/find?page=${derniere}`)
  noter(`Dernière page (${derniere}) : pas de « Page suivante »`, pDerniere.statut === 200 && !pDerniere.html.includes('Page suivante'))
  noter(
    'Brouillon, suspendue, clôturée : sur aucune page',
    [brouillon, suspendue, cloturee].every((a) => !verite.includes(a.reference) && !p1.html.includes(a.reference) && !p2.html.includes(a.reference)),
  )

  const redirection = await page('/find?page=1')
  noter('/find?page=1 redirige vers /find', [307, 308].includes(redirection.statut) && /\/find$/.test(redirection.entetes.get('location') || ''), `${redirection.statut} → ${redirection.entetes.get('location')}`)
  for (const [cas, qs] of [
    ['page 0', 'page=0'],
    ['page négative', 'page=-1'],
    ['page non numérique', 'page=abc'],
    ['page décimale', 'page=1.5'],
    ['page démesurée', 'page=99999999999'],
    ['page doublée', 'page=2&page=3'],
    ['page au-delà des annonces', `page=${derniere + 1}`],
  ]) {
    const r = await page(`/find?${qs}`)
    noter(`${cas} : 404`, r.statut === 404, `HTTP ${r.statut}`)
  }

  // ═══ 3. Photos ══════════════════════════════════════════════════════════
  titre('3. La route photo')

  const src = /src="(\/find\/photo\/[0-9a-hjkmnp-tv-z]{10}\/[0-7])"/.exec(p1.html)?.[1]
  noter('La carte pointe vers /find/photo/<référence>/<position>', Boolean(src), src)
  const photo = await fetch(`${BASE}${src}`)
  const octets = Buffer.from(await photo.arrayBuffer())
  noter('Photo principale : 200, image/jpeg, le fichier stocké', photo.status === 200 && photo.headers.get('content-type') === 'image/jpeg' && octets.equals(fichier))
  const cache = photo.headers.get('cache-control') || ''
  noter('Cache public court, au navigateur seulement', /public/.test(cache) && /max-age=60/.test(cache) && !/s-maxage/.test(cache), cache)
  noter('Aucun chemin dans les en-têtes', ![...photo.headers.values()].some((v) => secrets.some((s) => v.includes(s))))

  const quatre04 = []
  for (const [cas, chemin] of [
    ['Référence inexistante', '/find/photo/0000000000/0'],
    ['Référence mal formée', '/find/photo/ILLOU00000/0'],
    ['Identifiant interne à la place de la référence', `/find/photo/${publiees[0].id}/0`],
    ['Brouillon', `/find/photo/${brouillon.reference}/0`],
    ['Suspendue', `/find/photo/${suspendue.reference}/0`],
    ['Clôturée', `/find/photo/${cloturee.reference}/0`],
    ['Position 8', `/find/photo/${publiees[0].reference}/8`],
    ['Position -1', `/find/photo/${publiees[0].reference}/-1`],
    ['Position non numérique', `/find/photo/${publiees[0].reference}/a`],
    ['Position « 00 »', `/find/photo/${publiees[0].reference}/00`],
    ['Position vide (3)', `/find/photo/${publiees[0].reference}/3`],
  ]) {
    const r = await fetch(`${BASE}${chemin}`)
    const corps = await r.text()
    quatre04.push([r.status, corps.length, r.headers.get('cache-control')])
    noter(`${cas} : 404`, r.status === 404, `HTTP ${r.status}`)
  }
  noter('Toutes ces 404 sont identiques : sans corps, non mises en cache', quatre04.every(([s, l, c]) => s === 404 && l === 0 && c === 'no-store'))

  const { data: urlPublique } = admin.storage.from('annonces').getPublicUrl(publiees[0].chemin)
  noter('L’URL publique de Storage ne sert rien', (await fetch(urlPublique.publicUrl)).status !== 200)

  // ═══ 4. La frontière ════════════════════════════════════════════════════
  titre('4. La frontière de S2 tient')

  for (const table of ['annonces', 'annonce_photos']) {
    const { data, error } = await visiteur.from(table).select('*').limit(1)
    noter(`Un visiteur ne lit pas \`${table}\``, Boolean(error) || data.length === 0, error?.message)
  }
  const { error: eBucket } = await visiteur.storage.from('annonces').download(publiees[0].chemin)
  noter('Un visiteur ne lit pas le coffre', Boolean(eBucket))
  const { error: eFnAnon } = await visiteur.rpc('photo_publiee', { p_reference: publiees[0].reference, p_position: 0 })
  noter('Un visiteur n’appelle pas `photo_publiee`', Boolean(eFnAnon), eFnAnon?.code)
  const { error: eFnAuth } = await D.db.rpc('photo_publiee', { p_reference: publiees[0].reference, p_position: 0 })
  noter('Un compte connecté non plus, même propriétaire', Boolean(eFnAuth), eFnAuth?.code)

  // ═══ 5. Référencement ═══════════════════════════════════════════════════
  titre('5. Référencement')

  noter('Page 1 : canonique /find, indexable', p1.html.includes('<link rel="canonical" href="https://sikaloc.com/find"') && !/name="robots" content="[^"]*noindex/.test(p1.html))
  noter('Page 2 : noindex, follow', /name="robots" content="noindex, follow"/.test(p2.html))
  const plan = await (await fetch(`${BASE}/sitemap.xml`)).text()
  // Depuis S6, les fiches publiées y figurent aussi — et elles seules. Tant
  // que `/find/<référence>` n'existait pas, ce test exigeait leur absence.
  noter('Le plan du site annonce /find', plan.includes('<loc>https://sikaloc.com/find</loc>'))
  noter(
    'Le plan du site annonce les fiches publiées, et aucune autre',
    publiees.every((a) => plan.includes(`<loc>https://sikaloc.com/find/${a.reference}</loc>`)) &&
      [brouillon, suspendue, cloturee].every((a) => !plan.includes(a.reference)),
  )
  const robots = await (await fetch(`${BASE}/robots.txt`)).text()
  noter('robots.txt inchangé : /find n’est pas fermé', !/Disallow: \/find/.test(robots))

  // ═══ 6. Navigateur ══════════════════════════════════════════════════════
  titre('6. Mobile, bureau, clavier')

  const navigateur = await chromium.launch({
    executablePath: require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })

  const mobile = await navigateur.newPage({ viewport: { width: 375, height: 812 } })
  await mobile.goto(`${BASE}/find`, { waitUntil: 'networkidle' })
  noter('Mobile 375 px : aucun débordement horizontal', await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  const [c1, c2] = await mobile.locator('ul[aria-label="Annonces"] > li').evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect()))
  noter('Mobile : une colonne', c2.top >= c1.bottom - 1)
  const alts = await mobile.locator('ul[aria-label="Annonces"] img').evaluateAll((els) => els.map((e) => e.getAttribute('alt') || ''))
  noter('Chaque photo a un texte alternatif qui dit quelque chose', alts.length === 24 && alts.every((a) => a.length > 15 && !/^image$/i.test(a) && a.includes('à louer')), alts[0])
  const premiereChargee = await mobile
    .waitForFunction(() => {
      const img = document.querySelector('ul[aria-label="Annonces"] img')
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
    }, null, { timeout: 10000 })
    .then(() => true)
    .catch(() => false)
  noter('La première photo s’affiche', premiereChargee)

  const tablette = await navigateur.newPage({ viewport: { width: 768, height: 1024 } })
  await tablette.goto(`${BASE}/find`, { waitUntil: 'networkidle' })
  const colonnesTablette = await tablette.locator('ul[aria-label="Annonces"] > li').evaluateAll((els) => new Set(els.slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().top))).size)
  noter('Tablette 768 px : deux colonnes', colonnesTablette === 2)

  const bureau = await navigateur.newPage({ viewport: { width: 1280, height: 900 } })
  await bureau.goto(`${BASE}/find`, { waitUntil: 'networkidle' })
  const hauts = await bureau.locator('ul[aria-label="Annonces"] > li').evaluateAll((els) => els.slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().top)))
  noter('Bureau 1280 px : trois colonnes', new Set(hauts).size === 1)

  let focusSuivante = false
  let contour = ''
  for (let i = 0; i < 120 && !focusSuivante; i++) {
    await bureau.keyboard.press('Tab')
    const etat = await bureau.evaluate(() => {
      const el = document.activeElement
      const style = el ? getComputedStyle(el) : null
      return { texte: el?.textContent || '', contour: style ? `${style.outlineStyle} ${style.outlineWidth} ${style.boxShadow}` : '' }
    })
    if (etat.texte.includes('Page suivante')) {
      focusSuivante = true
      contour = etat.contour
    }
  }
  noter('Au clavier, on atteint « Page suivante »', focusSuivante)
  noter('…et le focus est visible', focusSuivante && (!/^none/.test(contour) || !/none$/.test(contour)), contour)
  await bureau.keyboard.press('Enter')
  await bureau.waitForURL(/\/find\?page=2$/)
  noter('…et Entrée ouvre la page 2', new URL(bureau.url()).search === '?page=2')

  const accueil = await navigateur.newPage({ viewport: { width: 1024, height: 800 } })
  await accueil.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  noter(
    'Accueil à 1024 px : « Trouver un logement » dans l’en-tête, sans débordement',
    (await accueil.locator('header a[href="/find"]', { hasText: 'Trouver un logement' }).count()) > 0 &&
      (await accueil.evaluate(() => {
        const nav = document.querySelector('header nav')
        return nav.scrollWidth <= nav.clientWidth && document.documentElement.scrollWidth <= window.innerWidth
      })),
  )
  noter('Accueil : la carte Sikaloc_Find mène à /find', (await accueil.locator('a[href="/find"]', { hasText: 'Voir les logements' }).count()) === 1)
  noter('Accueil : plus aucun « À venir » ni « bientôt »', !/À venir|bientôt|reste à construire/.test(await accueil.locator('body').innerText()))
  const pro = await navigateur.newPage()
  await pro.goto(`${BASE}/pro`, { waitUntil: 'networkidle' })
  noter('Pied de page de /pro : lien « Trouver un logement »', (await pro.locator('footer a[href="/find"]').count()) === 1)

  // ─── État vide : seulement si nos annonces étaient les seules ─────────
  titre('7. État vide')
  await admin.from('annonces').update({ statut: 'suspendue' }).eq('bailleur_id', D.id).eq('statut', 'publiee')
  const restantes = await catalogueComplet()
  if (restantes.length === 0) {
    const vide = await page('/find')
    noter(
      'Catalogue vide : un message honnête, aucune carte, aucune pagination',
      vide.statut === 200 && vide.html.includes('Aucun logement publié pour le moment') && referencesDe(vide.html).length === 0 && !vide.html.includes('Page suivante'),
    )
    noter('Catalogue vide : /find?page=2 répond 404', (await page('/find?page=2')).statut === 404)
  } else {
    console.log(`  (non vérifié : ${restantes.length} autre(s) annonce(s) publiée(s) en base)`)
  }

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
