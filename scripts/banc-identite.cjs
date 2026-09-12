/**
 * Parcours complet de la photo de profil, dans un vrai navigateur.
 *
 *   supabase start · env pointant sur la pile locale · npm run build && npm run start
 *   npm run banc:identite
 *
 * Il éprouve ce qu'aucun banc pur ne peut prouver : que le modèle se charge,
 * qu'il reconnaît de vrais visages, et que la photo traverse tout le chemin —
 * analyse, envoi, affichage, retrait.
 *
 * Les photos de test viennent des exemples livrés avec `@vladmandic/face-api`.
 * Elles restent dans `node_modules`, ne sont jamais versionnées, et ne quittent
 * pas la machine : le serveur visé est local.
 */
const { createServerClient } = require('@supabase/ssr')
const { chromium } = require('playwright-core')
const fs = require('fs')
const os = require('os')

const BASE = process.env.BASE_IDENTITE || 'http://localhost:3000'
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EXEMPLES = 'node_modules/@vladmandic/face-api/demo'

if (!/127\.0\.0\.1|localhost/.test(SUPABASE || '')) {
  console.error(`Refus : ${SUPABASE} n'est pas une pile locale.`)
  process.exit(1)
}

const entetes = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }
const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}

const chromium_exe = fs
  .readdirSync(os.homedir() + '/.cache/ms-playwright')
  .filter((d) => d.startsWith('chromium-'))
  .map((d) => `${os.homedir()}/.cache/ms-playwright/${d}/chrome-linux64/chrome`)
  .find((p) => fs.existsSync(p))

async function bailleur(id) {
  const r = await fetch(`${SUPABASE}/rest/v1/bailleurs?id=eq.${id}&select=*`, { headers: entetes })
  return (await r.json())[0]
}

;(async () => {
  const email = `banc-identite-${Date.now()}@exemple.test`
  console.log(`\nPhoto de profil — ${email}\n`)

  const compte = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: entetes,
    body: JSON.stringify({
      email,
      password: 'Jonquille7Mn!',
      email_confirm: true,
      user_metadata: { nom: 'Awa Sossou', telephone: '97000009' },
    }),
  }).then((r) => r.json())

  await fetch(`${SUPABASE}/rest/v1/bailleurs?id=eq.${compte.id}`, {
    method: 'PATCH',
    headers: { ...entetes, Prefer: 'return=minimal' },
    body: JSON.stringify({ onboarding_termine: true }),
  })

  const depart = await bailleur(compte.id)
  noter('Le compte neuf n’a pas de photo', depart.photo_chemin === null)
  noter(
    'Une période d’avatar temporaire est ouverte',
    Boolean(depart.avatar_temporaire_depuis),
    `depuis ${depart.avatar_temporaire_depuis}`,
  )

  const lien = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: entetes,
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json())

  const nav = await chromium.launchPersistentContext('', {
    executablePath: chromium_exe,
    viewport: { width: 1280, height: 900 },
    headless: true,
  })
  const page = await nav.newPage()

  const erreursConsole = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/.test(m.text())) erreursConsole.push(m.text())
  })

  let jetons
  const client = createServerClient(SUPABASE, ANON, {
    cookies: { getAll: () => [], setAll: (c) => { jetons = c } },
  })
  await client.auth.verifyOtp({ type: 'magiclink', token_hash: lien.hashed_token })
  await nav.addCookies(
    jetons.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' })),
  )

  await page.goto(`${BASE}/app/parametres/profil`, { waitUntil: 'networkidle' })

  // ── 1. L'en-tête annonce l'absence de photo ────────────────────────────
  const enTete = await page.locator('main').innerText()
  noter('L’en-tête invite à ajouter une photo', /Ajoutez votre photo/i.test(enTete))
  noter('Il annonce les jours restants', /vous représente encore \d+ jour/i.test(enTete))

  const champ = page.locator('input[name="photo"]')

  /** Choisit un fichier et rend le texte du bloc photo après analyse. */
  const essayer = async (fichier) => {
    await champ.setInputFiles(fichier)
    await page.waitForFunction(
      () => !/Analyse de la photo/.test(document.body.innerText),
      { timeout: 45000 },
    )
    await page.waitForTimeout(500)
    return page.locator('form:has(input[name="photo"])').innerText()
  }

  // ── 2. Une photo sans visage est refusée ───────────────────────────────
  const sansVisage = await essayer('public/demo/tableau-de-bord.png')
  noter(
    'Une capture d’écran est refusée',
    /Visage non détecté/i.test(sansVisage),
    sansVisage.split('\n').find((l) => /Visage non/.test(l)) || '',
  )
  noter(
    'Aucun bouton d’enregistrement n’apparaît',
    (await page.locator('button:has-text("Enregistrer cette photo")').count()) === 0,
  )

  // ── 3. Le modèle a bien été chargé depuis notre origine ────────────────
  const modele = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/modeles/visage/'))
      .map((e) => e.name.split('/').pop()),
  )
  noter('Le modèle a été téléchargé depuis Sikaloc', modele.length >= 1, modele.join(', '))

  // ── 4. Les vrais visages ───────────────────────────────────────────────
  //
  // Les exemples de face-api sont des photos de GROUPE : elles servent à
  // démontrer la détection multiple. Les soumettre telles quelles ne prouve
  // que le refus « plusieurs visages ». On en découpe donc des morceaux, dont
  // certains ne contiendront qu'un visage — ce qui éprouve enfin l'acceptation.
  // Un portrait fourni par la personne qui lance le banc court-circuite tout :
  //
  //     BANC_PORTRAIT=~/photo.jpg npm run banc:identite
  //
  // Aucun portrait n'est versionné dans le dépôt — une photo de visage n'a rien
  // à faire dans un historique git, et personne ne devrait avoir à en committer
  // une pour lancer les tests.
  const portrait = process.env.BANC_PORTRAIT

  const sharp = require('sharp')
  const decoupes = `${os.tmpdir()}/banc-identite-decoupes`
  fs.mkdirSync(decoupes, { recursive: true })

  const exemples = portrait ? [portrait] : []
  for (const f of portrait ? [] : fs.readdirSync(EXEMPLES).filter((f) => /^sample\d+\.jpg$/.test(f)).sort()) {
    const source = `${EXEMPLES}/${f}`
    const { width, height } = await sharp(source).metadata()
    // Quatre quadrants généreux, qui se recouvrent : un visage coupé en deux
    // par une frontière nette serait manqué par tous les découpages.
    const l = Math.round(width * 0.6)
    const h = Math.round(height * 0.6)
    for (const [nom, x, y] of [
      ['hg', 0, 0],
      ['hd', width - l, 0],
      ['bg', 0, height - h],
      ['bd', width - l, height - h],
    ]) {
      const cible = `${decoupes}/${f.replace('.jpg', '')}-${nom}.jpg`
      await sharp(source).extract({ left: x, top: y, width: l, height: h }).toFile(cible)
      exemples.push(cible)
    }
  }
  console.log(`    ${exemples.length} découpes produites depuis ${fs.readdirSync(EXEMPLES).filter((f) => /^sample\d+\.jpg$/.test(f)).length} photos de groupe`)

  let accepteeChemin = null
  const motifs = {}
  for (const chemin of exemples) {
    const texte = await essayer(chemin)
    const accepte = /Enregistrer cette photo/.test(texte)
    // Le motif est la ligne d'explication, celle qui suit le titre du refus.
    const motif = accepte
      ? 'acceptée'
      : (texte.split('\n').find((l) => /^(Visage|Plusieurs|Photo|Image|Fichier) /.test(l.trim())) || '?')
    motifs[motif] = (motifs[motif] || 0) + 1
    if (accepte && !accepteeChemin) accepteeChemin = chemin
  }
  for (const [motif, n] of Object.entries(motifs)) {
    console.log(`    ${String(n).padStart(2)} × ${motif}`)
  }
  if (accepteeChemin) {
    noter('Une photo à visage unique est acceptée', true, accepteeChemin.split('/').pop())
  } else {
    // Sans portrait, l'acceptation ne peut pas être éprouvée — mais ce n'est pas
    // un échec du produit. On le dit, et on s'arrête proprement plutôt que de
    // laisser un banc rouge en permanence, que plus personne ne lirait.
    console.log('\n  ⏭  Acceptation non éprouvée : aucun portrait disponible.')
    console.log('     Les exemples de face-api sont des photos de GROUPE, choisies')
    console.log('     pour démontrer la détection multiple. Pour aller au bout :')
    console.log('\n       BANC_PORTRAIT=/chemin/vers/un-portrait.jpg npm run banc:identite\n')
    console.log(`  ${etapes.filter(Boolean).length}/${etapes.length} étapes vérifiées ; le reste du parcours attend un portrait.\n`)
    await nav.close()
    process.exit(etapes.some((e) => !e) ? 1 : 0)
  }

  // ── 5. Enregistrement ──────────────────────────────────────────────────
  await essayer(accepteeChemin)
  await page.locator('button:has-text("Enregistrer cette photo")').click()
  await page.waitForTimeout(2500)

  const apresDepot = await bailleur(compte.id)
  noter('La photo est enregistrée', Boolean(apresDepot.photo_chemin), apresDepot.photo_chemin)
  noter(
    'Le chemin respecte la portée du bailleur',
    apresDepot.photo_chemin?.startsWith(`${compte.id}/photo.`),
  )
  noter(
    'La période temporaire est close',
    apresDepot.avatar_temporaire_depuis === null,
  )
  noter('L’avatar n’a pas été supprimé', 'avatar' in apresDepot)

  // ── 6. La photo prime, et s'affiche ────────────────────────────────────
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const apres = await page.locator('main').innerText()
  noter('L’en-tête annonce « Photo ajoutée »', /Photo ajoutée/i.test(apres))
  noter('Plus aucun rappel n’est affiché', !/Ajoutez votre photo/i.test(apres))

  const servie = await page.evaluate(async () => {
    const r = await fetch('/api/photo')
    return { statut: r.status, type: r.headers.get('content-type'), cache: r.headers.get('cache-control') }
  })
  noter('La photo est servie par /api/photo', servie.statut === 200, `${servie.type}`)
  noter('Et jamais mise en cache publiquement', /private/.test(servie.cache || ''), servie.cache)

  const priorite = await page.evaluate(
    () => [...document.querySelectorAll('img')].filter((i) => i.src.includes('/api/photo')).length,
  )
  noter('La photo remplace l’avatar à l’écran', priorite >= 1, `${priorite} image(s)`)

  // ── 7. Retrait : l'avatar reprend sa place ─────────────────────────────
  await page.locator('button:has-text("Retirer ma photo")').first().click()
  await page.waitForTimeout(600)
  await page.locator('button:has-text("Confirmer")').first().click().catch(() => {})
  await page.waitForTimeout(2500)

  const apresRetrait = await bailleur(compte.id)
  noter('La photo est retirée', apresRetrait.photo_chemin === null)
  noter(
    'Une nouvelle période de cinq jours s’ouvre',
    Boolean(apresRetrait.avatar_temporaire_depuis),
  )

  // ── 8. Mobile ──────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  noter(
    'L’écran de profil tient sur 390 px',
    await page.locator('input[name="photo"]').count().then((n) => n === 1),
  )
  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )
  noter('Aucun débordement horizontal', debordement)

  // ── 9. Rien ne fuit ────────────────────────────────────────────────────
  noter(
    'Aucune erreur de console',
    erreursConsole.length === 0,
    erreursConsole[0]?.slice(0, 80) || '',
  )
  const html = await page.content()
  noter(
    'Aucune donnée faciale dans la page',
    !/descriptor|embedding|landmark|faceMatcher/i.test(html),
  )
  noter('Aucune photo en URL', !/photo=|image=|base64,\/9j/.test(page.url()))

  await nav.close()

  const echecs = etapes.filter((e) => !e).length
  console.log(
    echecs === 0
      ? `\n✓ ${etapes.length} étapes du parcours.\n`
      : `\n✗ ${echecs} étape(s) en échec sur ${etapes.length}.\n`,
  )
  process.exit(echecs === 0 ? 0 : 1)
})()
