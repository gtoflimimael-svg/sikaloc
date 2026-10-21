/**
 * Banc de la fiche publique — Sikaloc_Find, S6.
 *
 *   supabase start · env pointant sur la pile locale · npm run build && npm run start
 *   npm run banc:find-detail
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. `/find/<référence>` : 200 pour une annonce publiée, et la MÊME 404 pour
 *      tout le reste — mal formée, inconnue, brouillon, suspendue, clôturée,
 *      supprimée. Rien ne permet de les distinguer.
 *   2. Chaque donnée publique à sa place ; aucune donnée privée nulle part.
 *   3. Le profil du bailleur : nom réduit, et « Téléphone vérifié » seulement
 *      pour un code reçu par SMS ou WhatsApp — jamais pour une attestation ADMIN.
 *   4. La galerie : 1, plusieurs, 8 photos, positions non contiguës, photo
 *      principale désignée par la projection et non supposée à 0.
 *   5. Référencement, plan du site, frontière de S2, mobile, bureau, clavier.
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
const ADRESSE = 'Lot 88, face à la boulangerie Sainte-Rita'
const COULEURS = ['#b0413e', '#3e6db0', '#4e8a3e', '#b08a3e', '#6a3eb0', '#3eb0a4', '#b03e8a', '#222222']

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)
const comptes = []
const secrets = [ADRESSE]

async function bailleur(cle, nom, canal) {
  const email = `banc-fiche-${cle}-${Date.now()}@exemple.test`
  const telephone = `+22901${String(Date.now()).slice(-8)}`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom, telephone },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  const id = data.user.id
  comptes.push(id)
  if (canal) {
    await admin.from('bailleurs').update({ telephone_verifie_le: new Date().toISOString(), telephone_canal_verification: canal }).eq('id', id)
  }
  const { data: ligne } = await admin.from('bailleurs').select('telephone').eq('id', id).single()
  secrets.push(id, email, nom, ligne.telephone, ligne.telephone.replace('+229', ''))
  const db = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await db.auth.signInWithPassword({ email, password: MDP })
  return { id, db }
}

/** Une photo unie, de la couleur de sa position : on sait laquelle est servie. */
const imageDe = (position) =>
  sharp({ create: { width: 1600, height: 1200, channels: 3, background: COULEURS[position] } }).jpeg({ quality: 80 }).toBuffer()

async function annonce(b, statut, positions, champs = {}) {
  const { data: logement } = await admin
    .from('logements')
    .insert({ bailleur_id: b.id, adresse: ADRESSE, type: 'Appartement', ville: 'Cotonou' })
    .select('id')
    .single()
  const { data: a, error } = await admin
    .from('annonces')
    .insert({
      bailleur_id: b.id,
      logement_id: logement.id,
      type: 'Appartement',
      ville: 'Cotonou',
      quartier: 'Akpakpa',
      chambres: 2,
      surface_m2: 65,
      loyer: 150000,
      charges: 15000,
      depot_garantie: 300000,
      avance_mois: 3,
      equipements: ['eau_courante', 'compteur_electrique_individuel', 'cour_cloturee'],
      description: 'Deux chambres salon au calme.\nCarrelé, cour clôturée, proche du marché.',
      disponible_le: '2026-10-15',
      ...champs,
    })
    .select('id, reference')
    .single()
  if (error) throw new Error(`annonce : ${error.message}`)
  secrets.push(logement.id, a.id)

  const photos = []
  for (const position of positions) {
    const chemin = `${b.id}/${a.id}/${randomUUID()}.jpg`
    const fichier = await imageDe(position)
    await admin.storage.from('annonces').upload(chemin, fichier, { contentType: 'image/jpeg' })
    photos.push({ annonce_id: a.id, bailleur_id: b.id, chemin, position, largeur: 1600, hauteur: 1200, type_mime: 'image/jpeg', poids: fichier.length, fichier })
    secrets.push(chemin)
  }
  if (photos.length) await admin.from('annonce_photos').insert(photos.map(({ fichier, ...p }) => p))

  if (statut !== 'brouillon') await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
  if (statut === 'suspendue') await admin.from('annonces').update({ statut: 'suspendue' }).eq('id', a.id)
  if (statut === 'cloturee') await admin.from('annonces').update({ statut: 'cloturee', motif_cloture: 'retiree' }).eq('id', a.id)
  return { ...a, photos }
}

const obtenir = async (chemin) => {
  const r = await fetch(`${BASE}${chemin}`, { redirect: 'manual' })
  return { statut: r.status, html: await r.text() }
}
/** Le texte d'une page rendue côté serveur, sans balises ni commentaires. */
const texte = (html) =>
  (/<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? '').replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const meta = (html, attribut, valeur) =>
  new RegExp(`<meta[^>]*${attribut}="${valeur}"[^>]*content="([^"]*)"`).exec(html)?.[1] ??
  new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attribut}="${valeur}"`).exec(html)?.[1]

;(async () => {
  console.log('\nSikaloc_Find — la fiche publique (S6)\n')

  const A = await bailleur('a', 'Aline Houngbo', 'SMS')
  const B = await bailleur('b', 'Koffi de Souza', 'ADMIN')

  const complete = await annonce(A, 'publiee', [0, 1, 2, 3, 4, 5, 6, 7], { avance_mois: 0 })
  const unique = await annonce(A, 'publiee', [0], { charges: 0, surface_m2: null, chambres: 0, type: 'Studio', disponible_le: null })
  const trouee = await annonce(B, 'publiee', [2, 5])
  const brouillon = await annonce(A, 'brouillon', [0])
  const suspendue = await annonce(A, 'suspendue', [0])
  const cloturee = await annonce(A, 'cloturee', [0])
  const supprimee = await annonce(A, 'brouillon', [])
  await admin.from('annonces').delete().eq('id', supprimee.id)

  // ═══ 1. La route ═══════════════════════════════════════════════════════
  titre('1. Une annonce publiée, et une seule 404 pour tout le reste')

  const fiche = await obtenir(`/find/${complete.reference}`)
  noter('Annonce publiée : 200, sans compte', fiche.statut === 200, `HTTP ${fiche.statut}`)

  const cas404 = [
    ['Référence mal formée', '/find/ILLOU00000'],
    ['Référence trop courte', '/find/abc'],
    ['Majuscules', `/find/${complete.reference.toUpperCase()}`],
    ['Identifiant interne à la place de la référence', `/find/${complete.id}`],
    ['Référence inconnue', '/find/0000000000'],
    ['Brouillon', `/find/${brouillon.reference}`],
    ['Suspendue', `/find/${suspendue.reference}`],
    ['Clôturée', `/find/${cloturee.reference}`],
    ['Supprimée', `/find/${supprimee.reference}`],
  ]
  for (const [cas, chemin] of cas404) {
    const r = await obtenir(chemin)
    noter(`${cas} : 404`, r.statut === 404, `HTTP ${r.statut}`)
  }
  // Ce que le visiteur LIT est comparé plus bas, dans le navigateur : le corps
  // d'une 404 arrive par la charge React, pas dans le HTML initial.
  const r404 = await obtenir(`/find/${suspendue.reference}`)
  // La référence demandée figure dans la charge React : c'est le paramètre
  // d'URL, que le visiteur vient de taper lui-même. Ce qu'il ne doit pas
  // apprendre, c'est que cette annonce EXISTE et dans quel état.
  noter(
    'Une 404 ne trahit ni le statut, ni le quartier, ni le bailleur — charge React comprise',
    !/suspendu|clôtur|brouillon|Akpakpa|Aline|Koffi/i.test(r404.html) && !secrets.some((x) => r404.html.includes(x)),
  )
  noter('Une 404 n’est pas indexable', /name="robots" content="noindex/.test(r404.html))

  // ═══ 2. Les données ═════════════════════════════════════════════════════
  titre('2. Ce que la fiche affiche')

  const v = texte(fiche.html)
  const attendus = [
    ['Type', 'Appartement'],
    ['Chambres', '2 chambres salon'],
    ['Quartier et ville', 'Akpakpa, Cotonou'],
    ['Surface', '65 m²'],
    ['Loyer', '150 000 FCFA'],
    ['Charges', '+ 15 000 FCFA / mois de charges'],
    ['Dépôt de garantie', 'Dépôt de garantie'],
    ['Montant de la caution', '300 000 FCFA'],
    ['Avance nulle, dite comme telle', 'Aucune avance'],
    ['Disponibilité datée', 'Disponible le 15 octobre 2026'],
    ['Équipement', 'Compteur électrique individuel'],
    ['Équipement', 'Cour clôturée'],
    ['Équipement', 'Eau courante'],
    ['Description', 'Deux chambres salon au calme.'],
    ['Référence', `Réf. ${complete.reference}`],
  ]
  for (const [nom, valeur] of attendus) {
    noter(`${nom} : « ${valeur} »`, v.replace(/ | /g, ' ').includes(valeur))
  }
  noter('Aucune valeur technique brute', !/compteur_electrique_individuel|cour_cloturee|eau_courante/.test(v))
  noter('La description garde ses retours à la ligne, en texte', fiche.html.includes('whitespace-pre-line') && fiche.html.includes('Deux chambres salon au calme.\nCarrelé'))

  const ficheUnique = texte((await obtenir(`/find/${unique.reference}`)).html).replace(/ | /g, ' ')
  noter('0 chambre : « Entrer-coucher », jamais « 0 chambres »', ficheUnique.includes('Entrer-coucher') && !/0 chambres?/.test(ficheUnique))
  noter('Charges nulles : « Sans charges »', ficheUnique.includes('Sans charges'))
  noter('Sans date : « Disponible maintenant »', ficheUnique.includes('Disponible maintenant'))
  noter('Surface absente : pas de ligne Surface', !ficheUnique.includes('Surface'))

  // ═══ 3. Confidentialité ═════════════════════════════════════════════════
  titre('3. Rien de privé')

  for (const [nom, html] of [
    ['fiche complète', fiche.html],
    ['fiche à une photo', (await obtenir(`/find/${unique.reference}`)).html],
    ['fiche du bailleur B', (await obtenir(`/find/${trouee.reference}`)).html],
  ]) {
    const trouves = secrets.filter((s) => html.includes(s))
    noter(`HTML de la ${nom} : aucun identifiant, adresse, email, téléphone, nom complet ni chemin`, trouves.length === 0, trouves.join(', '))
  }
  noter('Aucune URL de stockage', !/storage\/v1|supabase\.co|127\.0\.0\.1:54321/.test(fiche.html))
  noter('Aucune rédaction HTML libre (dangerouslySetInnerHTML) pour la description', !/<p[^>]*>Deux chambres salon au calme\.<br/.test(fiche.html))

  // ═══ 4. Le profil ═══════════════════════════════════════════════════════
  titre('4. Le bailleur')

  noter('Nom public présent : « Aline H. »', v.includes('Aline H.'))
  noter('Nom complet absent', !fiche.html.includes('Aline Houngbo'))
  noter('Code reçu par SMS : « Téléphone vérifié »', v.includes('Téléphone vérifié'))
  const vB = texte((await obtenir(`/find/${trouee.reference}`)).html)
  noter('Attestation ADMIN : pas de « Téléphone vérifié »', vB.includes('Koffi S.') && !vB.includes('Téléphone vérifié'))
  noter(
    'Un bouton « Candidater » mène au parcours',
    v.includes('Candidater') && fiche.html.includes(`/find/${complete.reference}/candidater`),
  )
  // Le pied de page porte l'adresse de Sikaloc : la question est celle du
  // BAILLEUR, et elle se juge donc sur le corps de la page.
  const corpsFiche = /<main[\s\S]*?<\/main>/.exec(fiche.html)?.[0] ?? ''
  noter(
    'Aucun contact direct du bailleur : ni téléphone, ni email, ni WhatsApp',
    Boolean(corpsFiche) && !/wa\.me|tel:|mailto:|Je suis intéressé/.test(corpsFiche),
  )

  // ═══ 5. La galerie ═════════════════════════════════════════════════════
  titre('5. La galerie')

  const { data: listeTrouee } = await visiteur.rpc('photos_publiees', { p_reference: trouee.reference })
  noter('`photos_publiees` : positions et dimensions, rien d’autre', JSON.stringify(Object.keys(listeTrouee[0])) === '["position","largeur","hauteur"]')
  noter('Positions réelles, non contiguës : 2 et 5', JSON.stringify(listeTrouee.map((p) => p.position)) === '[2,5]')
  for (const statut of [brouillon, suspendue, cloturee]) {
    const { data } = await visiteur.rpc('photos_publiees', { p_reference: statut.reference })
    if (data.length) noter('`photos_publiees` sur une annonce non publiée', false)
  }
  noter('`photos_publiees` : rien pour une annonce non publiée', true)

  const navigateur = await chromium.launch({
    executablePath: require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } })
  const principale = () => page.locator('section[aria-roledescription="galerie"] > div img')
  const compteur = () => page.locator('section[aria-roledescription="galerie"] p[aria-live]')

  // Les neuf 404 doivent se ressembler à l'écran, pas seulement par leur code.
  const vues404 = []
  for (const [, chemin] of cas404) {
    await page.goto(`${BASE}${chemin}`, { waitUntil: 'networkidle' })
    vues404.push((await page.locator('body').innerText()).replace(/\s+/g, ' ').trim())
  }
  noter(
    'Les neuf 404 affichent exactement la même page',
    new Set(vues404).size === 1 && vues404[0].startsWith('Cette annonce n’est pas disponible'),
    `${new Set(vues404).size} version(s) : ${vues404[0].slice(0, 60)}`,
  )

  await page.goto(`${BASE}/find/${complete.reference}`, { waitUntil: 'networkidle' })
  noter('8 photos : compteur « 1 / 8 »', (await compteur().innerText()).includes('1 / 8'))
  noter('8 vignettes', (await page.locator('ul[aria-label="Choisir une photo"] button').count()) === 8)
  const vues = []
  for (let i = 0; i < 8; i++) {
    vues.push(await principale().getAttribute('src'))
    await page.getByRole('button', { name: 'Photo suivante' }).click()
  }
  noter('« Photo suivante » parcourt les 8 positions, puis revient à la première', JSON.stringify(vues) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7].map((p) => `/find/photo/${complete.reference}/${p}`)) && (await principale().getAttribute('src')) === vues[0])
  await page.getByRole('button', { name: 'Photo précédente' }).click()
  noter('« Photo précédente » boucle vers la dernière', (await compteur().innerText()).includes('8 / 8'))
  noter('Texte alternatif utile : « … photo 8 sur 8 »', /à louer — Akpakpa, Cotonou, photo 8 sur 8/.test((await principale().getAttribute('alt')) || ''))
  const servie = Buffer.from(await (await fetch(`${BASE}/find/photo/${complete.reference}/7`)).arrayBuffer())
  noter('La photo servie est bien celle de sa position', servie.equals(complete.photos[7].fichier))

  await page.goto(`${BASE}/find/${unique.reference}`, { waitUntil: 'networkidle' })
  noter(
    '1 photo : ni flèches, ni compteur, ni vignettes',
    (await principale().count()) === 1 && (await page.getByRole('button', { name: 'Photo suivante' }).count()) === 0 &&
      (await compteur().count()) === 0 && (await page.locator('ul[aria-label="Choisir une photo"]').count()) === 0,
  )

  await page.goto(`${BASE}/find/${trouee.reference}`, { waitUntil: 'networkidle' })
  noter('Positions 2 et 5 : la galerie part de la principale désignée (2), pas de 0', (await principale().getAttribute('src')) === `/find/photo/${trouee.reference}/2`)
  await page.getByRole('button', { name: 'Photo suivante' }).click()
  noter('…puis passe à 5, sans trou ni 404', (await principale().getAttribute('src')) === `/find/photo/${trouee.reference}/5` && (await compteur().innerText()).includes('2 / 2'))
  noter('Aucune position absente n’est demandée', !(await page.content()).includes(`/find/photo/${trouee.reference}/0`))
  noter('La position vide 3 reste une 404', (await fetch(`${BASE}/find/photo/${trouee.reference}/3`)).status === 404)

  // ═══ 6. Référencement ═══════════════════════════════════════════════════
  titre('6. Référencement et partage')

  const titreHtml = /<title>([^<]*)<\/title>/.exec(fiche.html)?.[1] ?? ''
  noter('Titre naturel, sans donnée privée', /Appartement · 2 chambres salon à louer à Akpakpa, Cotonou · Sikaloc/.test(titreHtml), titreHtml)
  const desc = meta(fiche.html, 'name', 'description') ?? ''
  noter('Description : type, lieu, prix, disponibilité', /Appartement à louer à Akpakpa, Cotonou/.test(desc) && /150.000.FCFA/.test(desc) && /Disponible le 15 octobre 2026/.test(desc), desc)
  noter('Canonique : https://sikaloc.com/find/<référence>', fiche.html.includes(`<link rel="canonical" href="https://sikaloc.com/find/${complete.reference}"`))
  noter('Open Graph : URL de la fiche', meta(fiche.html, 'property', 'og:url') === `https://sikaloc.com/find/${complete.reference}`)
  noter('Open Graph : image = photo principale, par la route publique', meta(fiche.html, 'property', 'og:image') === `https://sikaloc.com/find/photo/${complete.reference}/0`)
  noter('Open Graph de la fiche trouée : image en position 2', meta((await obtenir(`/find/${trouee.reference}`)).html, 'property', 'og:image') === `https://sikaloc.com/find/photo/${trouee.reference}/2`)
  noter('Fiche indexable', !/name="robots" content="[^"]*noindex/.test(fiche.html))

  const plan = await (await fetch(`${BASE}/sitemap.xml`)).text()
  noter('Plan du site : les trois fiches publiées', [complete, unique, trouee].every((a) => plan.includes(`<loc>https://sikaloc.com/find/${a.reference}</loc>`)))
  noter('Plan du site : ni brouillon, ni suspendue, ni clôturée, ni supprimée', [brouillon, suspendue, cloturee, supprimee].every((a) => !plan.includes(a.reference)))
  await admin.from('annonces').update({ statut: 'suspendue' }).eq('id', unique.id)
  const planApres = await (await fetch(`${BASE}/sitemap.xml`)).text()
  const ficheApres = await obtenir(`/find/${unique.reference}`)
  noter('Suspendue à l’instant : retirée du plan ET de la fiche, sans délai', !planApres.includes(unique.reference) && ficheApres.statut === 404)
  await admin.from('annonces').update({ statut: 'publiee' }).eq('id', unique.id)

  // ═══ 7. La frontière ════════════════════════════════════════════════════
  titre('7. La frontière de S2 tient')

  for (const [qui, client] of [['Un visiteur', visiteur], ['Un compte connecté', A.db]]) {
    for (const table of ['annonces', 'annonce_photos', 'logements']) {
      const { data, error } = await client.from(table).select('id').eq('bailleur_id', B.id).limit(1)
      noter(`${qui} ne lit pas \`${table}\` (d’un autre)`, Boolean(error) || data.length === 0, error?.code)
    }
    const { error } = await client.rpc('photo_publiee', { p_reference: complete.reference, p_position: 0 })
    noter(`${qui} n’appelle pas \`photo_publiee\``, Boolean(error), error?.code)
  }
  const { data: sitemapRpc } = await visiteur.rpc('annonces_publiees_sitemap')
  noter('`annonces_publiees_sitemap` : référence et date, rien d’autre', JSON.stringify(Object.keys(sitemapRpc[0] || {})) === '["reference","publiee_le"]')

  // ═══ 8. Navigation, écrans, clavier ═════════════════════════════════════
  titre('8. Navigation, écrans, clavier')

  await page.goto(`${BASE}/find`, { waitUntil: 'networkidle' })
  noter('Le catalogue mène maintenant aux fiches', (await page.locator(`a[href="/find/${complete.reference}"]`).count()) === 1)
  await page.locator(`a[href="/find/${complete.reference}"]`).click()
  await page.waitForURL(new RegExp(`/find/${complete.reference}$`))
  noter('Un clic sur la carte ouvre la fiche', new URL(page.url()).pathname === `/find/${complete.reference}`)
  await page.getByRole('link', { name: '← Tous les logements' }).click()
  await page.waitForURL(/\/find$/)
  noter('« Tous les logements » ramène au catalogue', new URL(page.url()).pathname === '/find')

  for (const [largeur, hauteur] of [[375, 812], [768, 1024], [1280, 900]]) {
    const p = await navigateur.newPage({ viewport: { width: largeur, height: hauteur } })
    await p.goto(`${BASE}/find/${complete.reference}`, { waitUntil: 'networkidle' })
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    const boutons = await p.getByRole('button', { name: 'Photo suivante' }).isVisible()
    const prix = await p.getByText('150 000 FCFA', { exact: false }).first().isVisible()
    noter(`${largeur} px : aucun débordement, galerie et prix accessibles`, !deborde && boutons && prix)
    await p.close()
  }

  const clavier = await navigateur.newPage({ viewport: { width: 1280, height: 900 } })
  await clavier.goto(`${BASE}/find/${complete.reference}`, { waitUntil: 'networkidle' })
  noter('Un seul titre de niveau 1', (await clavier.locator('h1').count()) === 1)
  let atteint = false
  let contour = ''
  for (let i = 0; i < 40 && !atteint; i++) {
    await clavier.keyboard.press('Tab')
    const etat = await clavier.evaluate(() => {
      const el = document.activeElement
      const s = el ? getComputedStyle(el) : null
      return { nom: el?.getAttribute('aria-label') || '', contour: s ? `${s.outlineStyle} ${s.outlineWidth}` : '' }
    })
    if (etat.nom === 'Photo suivante') {
      atteint = true
      contour = etat.contour
    }
  }
  noter('Au clavier, on atteint « Photo suivante »', atteint)
  noter('…focus visible', atteint && !/^none/.test(contour), contour)
  await clavier.keyboard.press('Enter')
  noter('…Entrée avance d’une photo', (await clavier.locator('section[aria-roledescription="galerie"] p[aria-live]').innerText()).includes('2 / 8'))
  await clavier.keyboard.press('ArrowRight')
  noter('…la flèche droite aussi', (await clavier.locator('section[aria-roledescription="galerie"] p[aria-live]').innerText()).includes('3 / 8'))

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
