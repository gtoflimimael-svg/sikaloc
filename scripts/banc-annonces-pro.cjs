/**
 * Parcours d'une annonce dans Sikaloc_Pro, de bout en bout — S4.
 *
 *   supabase start · env pointant sur la pile locale · npm run build && npm run start
 *   npm run banc:annonces-pro
 *
 * Ce que `banc:annonces-gestion` ne peut pas voir : les pages, les formulaires,
 * les Server Actions, et le chemin réel d'une photo — du champ fichier du
 * navigateur jusqu'au coffre, en passant par le pipeline de S3.
 *
 *   logement → brouillon → informations → photo → publication → suspension
 *   → reprise → clôture
 *
 * Chaque étape est vérifiée à l'écran ET en base, et la vitrine publique (S2)
 * est interrogée comme le ferait un visiteur.
 */
const { createServerClient } = require('@supabase/ssr')
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

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)
const comptes = []

/** Un bailleur prêt à travailler : vérifié, installé, visite guidée vue. */
async function bailleurPret(cle) {
  const email = `banc-pro-${cle}-${Date.now()}@exemple.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nom: `Banc Pro ${cle}`, telephone: '+2290190000013' },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  const id = data.user.id
  comptes.push(id)
  await admin
    .from('bailleurs')
    .update({
      telephone_verifie_le: new Date().toISOString(),
      telephone_canal_verification: 'SMS',
      onboarding_termine: true,
      tutoriel_vu_le: new Date().toISOString(),
    })
    .eq('id', id)
  const { data: logement } = await admin
    .from('logements')
    .insert({ bailleur_id: id, adresse: 'Lot 21, Quartier Akpakpa', type: 'Appartement', ville: 'Cotonou' })
    .select()
    .single()
  return { id, email, logement }
}

/** Même méthode que banc-onboarding : un jeton à usage unique, jamais un mot de passe. */
async function ouvrirSession(contexte, email) {
  const entetes = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }
  const jeton = await (
    await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({ type: 'magiclink', email }),
    })
  ).json()
  const session = await (
    await fetch(`${SUPABASE}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'magiclink', token_hash: jeton.hashed_token }),
    })
  ).json()
  const aEcrire = []
  const client = createServerClient(SUPABASE, ANON, {
    cookies: { getAll: () => [], setAll: (liste) => aEcrire.push(...liste) },
  })
  await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  await contexte.addCookies(
    aEcrire.map(({ name, value }) => ({
      name,
      value,
      domain: new URL(BASE).hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    })),
  )
}

const annonceDe = async (bailleurId) =>
  (await admin.from('annonces').select('*').eq('bailleur_id', bailleurId).order('created_at')).data ?? []

const visible = async (reference) =>
  ((await visiteur.rpc('annonce_publiee', { p_reference: reference })).data ?? []).length === 1

/**
 * Attendre qu'un texte apparaisse — l'erreur d'une Server Action arrive après
 * l'aller-retour, pas au clic. Rend le texte de la page en cas d'échec.
 */
async function apparait(page, texte) {
  try {
    await page.getByText(texte, { exact: false }).first().waitFor({ timeout: 10000 })
    return { ok: true }
  } catch {
    const corps = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ')
    return { ok: false, detail: corps.slice(0, 400) }
  }
}

/** Aucun détail technique ne doit jamais s'afficher. */
async function pasDeFuite(page) {
  const texte = await page.locator('body').innerText()
  return !/violates|constraint|duplicate key|SQLSTATE|PGRST|annonces_|annonce_photos|\b23\d{3}\b/i.test(texte)
}

/**
 * Déclencher une `ActionConfirmee`, puis confirmer DANS son panneau — reconnu
 * à son titre. Deux actions peuvent partager un libellé (« Retirer » une photo,
 * « Retirer » une annonce) : on ne clique jamais au hasard.
 */
async function confirmer(page, declencheur, confirmation, titrePanneau) {
  await page.getByRole('button', { name: declencheur, exact: true }).click()
  await page
    .locator('div.rounded-lg', { hasText: titrePanneau })
    .getByRole('button', { name: confirmation, exact: true })
    .click()
  await page.waitForLoadState('networkidle')
}

;(async () => {
  console.log('\nSikaloc_Pro — une annonce de bout en bout (S4)\n')

  const A = await bailleurPret('a')
  const B = await bailleurPret('b')
  const { data: annonceB } = await admin
    .from('annonces')
    .insert({ bailleur_id: B.id, logement_id: B.logement.id, type: 'Appartement', ville: 'Cotonou' })
    .select()
    .single()

  // Une vraie photo de téléphone : EXIF, fabricant, position GPS.
  const photo = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#8a5a44' } })
    .jpeg({ quality: 90 })
    .withExif({
      IFD0: { Make: 'SikaTestMake', Model: 'BancPro' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '6/1 21/1 3600/100', GPSLongitudeRef: 'E', GPSLongitude: '2/1 26/1 1200/100' },
    })
    .toBuffer()

  const navigateur = await chromium.launch({
    executablePath: require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } })
  await ouvrirSession(contexte, A.email)
  const page = await contexte.newPage()

  // ═══ 1. Entrée ═════════════════════════════════════════════════════════
  titre('1. L’entrée dans l’espace Pro')

  await page.goto(`${BASE}/pro/annonces`, { waitUntil: 'networkidle' })
  noter('La page Annonces s’ouvre', new URL(page.url()).pathname === '/pro/annonces')
  noter('Le lien « Annonces » est dans la navigation', (await page.locator('nav a[href="/pro/annonces"]').count()) > 0)
  noter('Aucune annonce : l’état vide le dit', await page.getByText('Aucune annonce', { exact: true }).isVisible())
  noter('A ne voit pas l’annonce de B dans sa liste', (await page.locator(`a[href="/pro/annonces/${annonceB.id}"]`).count()) === 0)

  // ═══ 2. Du logement au brouillon ═══════════════════════════════════════
  titre('2. Du logement au brouillon')

  await page.goto(`${BASE}/pro/logements`, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'Mettre en location' }).click()
  await page.waitForURL(/\/pro\/annonces\/nouvelle\?logement=/)
  noter(
    'Depuis le logement, le formulaire arrive présélectionné',
    (await page.locator('select[name="logementId"]').inputValue()) === A.logement.id,
  )
  await page.getByRole('button', { name: 'Créer le brouillon' }).click()
  await page.waitForURL(/\/pro\/annonces\/[0-9a-f-]{36}$/)
  const [annonce] = await annonceDe(A.id)
  noter(
    'Brouillon créé en base, au nom de A, pour son logement',
    annonce?.statut === 'brouillon' && annonce.logement_id === A.logement.id,
  )
  noter('La page le présente comme un brouillon invisible', await page.getByText('Brouillon : cette annonce n’est visible par personne', { exact: false }).isVisible())
  noter('Aucune photo : l’exigence est annoncée', await page.getByText('ne se publie pas sans au moins une photo', { exact: false }).isVisible())

  // ═══ 3. Informations ═══════════════════════════════════════════════════
  titre('3. Les informations')

  await page.fill('input[name="quartier"]', 'Akpakpa')
  await page.fill('input[name="chambres"]', '2')
  await page.fill('input[name="loyer"]', '85000')
  await page.fill('input[name="depotGarantie"]', '170000')
  await page.fill('input[name="avanceMois"]', '3')
  await page.check('input[name="equipements"][value="eau_courante"]')
  await page.check('input[name="equipements"][value="cour_cloturee"]')
  await page.fill('textarea[name="description"]', 'Deux chambres salon, carrelé, cour clôturée, proche du marché Dantokpa.')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText('Annonce enregistrée.').waitFor()
  const apresInfos = (await annonceDe(A.id))[0]
  noter(
    'Enregistrées en base, montants entiers',
    apresInfos.quartier === 'Akpakpa' && apresInfos.loyer === 85000 && apresInfos.depot_garantie === 170000 &&
      apresInfos.equipements.length === 2,
  )

  await page.fill('input[name="loyer"]', '85000.5')
  await page.$$eval('form', (fs) => fs.forEach((f) => f.setAttribute('novalidate', '')))
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText('saisissez un nombre entier', { exact: false }).waitFor()
  noter('Un loyer décimal est refusé par le serveur, champ désigné', (await annonceDe(A.id))[0].loyer === 85000)
  await page.fill('input[name="loyer"]', '85000')

  await confirmer(page, 'Publier l’annonce', 'Publier', 'Publier cette annonce ?')
  const sansPhoto = await apparait(page, 'Ajoutez au moins une photo avant de publier.')
  noter('Publier sans photo : refusé, en clair', sansPhoto.ok, sansPhoto.detail)
  noter('…sans aucun détail technique à l’écran', await pasDeFuite(page))

  // ═══ 4. Photo ══════════════════════════════════════════════════════════
  titre('4. Une photo, par le pipeline de S3')

  await page.setInputFiles('input[name="photo"]', { name: 'IMG_2041.jpg', mimeType: 'image/jpeg', buffer: photo })
  await page.getByRole('button', { name: 'Envoyer la photo' }).click()
  await page.getByText('Photo ajoutée.').waitFor({ timeout: 30000 })
  await page.waitForLoadState('networkidle')
  const { data: lignes } = await admin.from('annonce_photos').select('*').eq('annonce_id', annonce.id)
  noter('Une ligne, en position 0', lignes?.length === 1 && lignes[0].position === 0)
  const { data: fichier } = await admin.storage.from('annonces').download(lignes[0].chemin)
  const octets = Buffer.from(await fichier.arrayBuffer())
  const meta = await sharp(octets).metadata()
  noter(
    'Le fichier stocké est réduit à 1600 px et ne garde aucun EXIF',
    meta.width === 1600 && !meta.exif && !octets.toString('latin1').includes('SikaTestMake'),
    `${meta.width}×${meta.height}`,
  )
  // `loading="lazy"` : l'élément existe avant ses pixels. On attend l'image
  // réellement décodée, servie par la route privée.
  const vignetteChargee = await page
    .waitForFunction(
      () => {
        const img = document.querySelector('img[alt="Photo principale"]')
        return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
      },
      null,
      { timeout: 10000 },
    )
    .then(() => true)
    .catch(() => false)
  noter(
    'La vignette s’affiche, marquée « Principale »',
    vignetteChargee && (await page.getByText('Principale', { exact: true }).isVisible()),
  )

  // ═══ 5. Publication ═══════════════════════════════════════════════════
  titre('5. Publication, suspension, reprise')

  await confirmer(page, 'Publier l’annonce', 'Publier', 'Publier cette annonce ?')
  await page.getByText('Publiée le', { exact: false }).waitFor()
  const publiee = (await annonceDe(A.id))[0]
  noter('Publiée, en base et à l’écran', publiee.statut === 'publiee')
  noter('Visible par la vitrine publique (S2)', await visible(publiee.reference))

  await confirmer(page, 'Suspendre', 'Suspendre', 'Suspendre cette annonce ?')
  await page.getByText('Suspendue : elle n’est plus visible', { exact: false }).waitFor()
  noter('Suspendue : retirée de la vitrine', (await annonceDe(A.id))[0].statut === 'suspendue' && !(await visible(publiee.reference)))

  await confirmer(page, 'Reprendre la publication', 'Republier', 'Republier cette annonce ?')
  await page.getByText('Publiée le', { exact: false }).waitFor()
  noter('Reprise : de nouveau visible', await visible(publiee.reference))

  await confirmer(page, 'Retirer', 'Retirer', 'Retirer cette photo ?')
  const derniere = await apparait(page, 'garde au moins une photo')
  noter(
    'La dernière photo d’une annonce publiée ne part pas',
    derniere.ok && ((await admin.from('annonce_photos').select('id').eq('annonce_id', annonce.id)).data ?? []).length === 1,
    derniere.detail,
  )

  // ═══ 6. Ce que A ne peut pas atteindre ═════════════════════════════════
  titre('6. Les frontières')

  const reponseB = await page.goto(`${BASE}/pro/annonces/${annonceB.id}`, { waitUntil: 'networkidle' })
  noter('L’annonce de B : 404 pour A', reponseB.status() === 404)
  const photoAnonyme = await fetch(`${BASE}/api/annonces/photos/${lignes[0].id}`)
  noter('La route photo refuse un visiteur', photoAnonyme.status === 401)
  const photoPrivee = await page.request.get(`${BASE}/api/annonces/photos/${lignes[0].id}`)
  noter(
    'Elle sert la photo à son bailleur, en cache privé',
    photoPrivee.status() === 200 && /private/.test(photoPrivee.headers()['cache-control'] || ''),
  )
  const contexteB = await navigateur.newContext()
  await ouvrirSession(contexteB, B.email)
  const pageB = await contexteB.newPage()
  const photoParB = await pageB.request.get(`${BASE}/api/annonces/photos/${lignes[0].id}`)
  noter('…et pas au bailleur B', photoParB.status() === 404)
  await contexteB.close()

  await page.goto(`${BASE}/pro/annonces/nouvelle`, { waitUntil: 'networkidle' })
  noter(
    'Le logement déjà en annonce n’est plus proposé : son annonce l’est',
    (await page.locator(`select[name="logementId"] option[value="${A.logement.id}"]`).count()) === 0 &&
      (await page.locator(`a[href="/pro/annonces/${annonce.id}"]`).count()) === 1,
  )

  // ═══ 7. Clôture ════════════════════════════════════════════════════════
  titre('7. Clôture')

  await page.goto(`${BASE}/pro/annonces/${annonce.id}`, { waitUntil: 'networkidle' })
  await confirmer(page, 'Clôturer : retirer l’annonce', 'Retirer', 'Retirer cette annonce ?')
  await page.getByText('Clôturée le', { exact: false }).waitFor()
  const cloturee = (await annonceDe(A.id))[0]
  noter('Clôturée, motif « retirée »', cloturee.statut === 'cloturee' && cloturee.motif_cloture === 'retiree')
  noter('Invisible dans la vitrine', !(await visible(cloturee.reference)))
  noter(
    'Plus de formulaire ni de bouton de publication',
    (await page.getByRole('button', { name: 'Enregistrer', exact: true }).count()) === 0 &&
      (await page.getByRole('button', { name: 'Reprendre la publication' }).count()) === 0,
  )
  noter('Aucun détail technique affiché sur tout le parcours', await pasDeFuite(page))

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
