/**
 * Parcours d'accueil d'un nouveau bailleur.
 *
 *   supabase start · env pointant sur la pile locale · npm run build && npm run start
 *   npm run banc:onboarding
 *
 * Vérifie deux choses : l'assistant d'accueil ne compte que deux étapes et
 * n'exige aucune donnée métier, puis la visite guidée interactive prend le
 * relais sur le tableau de bord.
 *
 * Les invariants qui comptent, dans l'ordre :
 *   1. la visite n'est PAS modale — la cible éclairée reste cliquable, et rien
 *      dans Sikaloc ne devient inaccessible ;
 *   2. une étape ne se franchit que par l'action réelle, jamais par un bouton ;
 *   3. la progression est dérivée des données, donc elle survit à la navigation,
 *      au rafraîchissement et à une sortie suivie d'une reprise.
 *
 * La session s'ouvre par l'API d'administration locale, jamais en saisissant un
 * mot de passe.
 */
const { createServerClient } = require('@supabase/ssr')
const { chromium } = require('playwright-core')

const BASE = process.env.BASE_ONBOARDING || 'http://localhost:3000'
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!/127\.0\.0\.1|localhost/.test(SUPABASE || '')) {
  console.error(`Refus : ${SUPABASE} n'est pas une pile locale.`)
  process.exit(1)
}

const entetes = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` }

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}

/** Crée un compte neuf par l'API d'administration, sans passer par un formulaire. */
async function creerCompteNeuf() {
  const email = `banc-onboarding-${Date.now()}@exemple.test`

  const reponse = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...entetes, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: { nom: 'Banc Onboarding', telephone: '+229 90 00 00 00', nb_logements: '3' },
    }),
  })

  const utilisateur = await reponse.json()
  if (!utilisateur.id) {
    console.error('Compte non créé :', JSON.stringify(utilisateur).slice(0, 200))
    process.exit(1)
  }

  return { id: utilisateur.id, email }
}

/** Ouvre une session navigateur sans mot de passe, via un jeton à usage unique. */
async function ouvrirSession(contexte, email) {
  const jeton = await (
    await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: { ...entetes, 'Content-Type': 'application/json' },
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
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  await contexte.addCookies(
    aEcrire.map(({ name, value }) => ({
      name, value, domain: new URL(BASE).hostname, path: '/',
      httpOnly: false, secure: false, sameSite: 'Lax',
    })),
  )
}

/** Lit la fiche bailleur telle qu'elle est en base. */
async function bailleur(id) {
  const r = await fetch(`${SUPABASE}/rest/v1/bailleurs?id=eq.${id}&select=*`, { headers: entetes })
  const lignes = await r.json()
  return Array.isArray(lignes) ? lignes[0] : undefined
}

/** Compte les lignes d'une table pour ce bailleur. */
async function compter(table, id) {
  const r = await fetch(`${SUPABASE}/rest/v1/${table}?bailleur_id=eq.${id}&select=id`, {
    headers: entetes,
  })
  const lignes = await r.json()
  return Array.isArray(lignes) ? lignes.length : 0
}

;(async () => {
  const compte = await creerCompteNeuf()
  console.log(`Parcours d'accueil — ${compte.email}\n`)

  const navigateur = await chromium.launch({
    executablePath:
      require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } })
  await ouvrirSession(contexte, compte.email)
  const page = await contexte.newPage()

  // ── 1. Le déclencheur a bien créé la fiche bailleur ──────────────────────
  const fiche = await bailleur(compte.id)
  noter('Le compte reçoit sa fiche bailleur', Boolean(fiche), fiche ? fiche.nom : 'absente')
  noter(
    'Le didacticiel n’a jamais été vu',
    fiche?.tutoriel_vu_le === null,
    `tutoriel_vu_le = ${fiche?.tutoriel_vu_le}`,
  )

  // ── 2. L'assistant ne compte que deux étapes ─────────────────────────────
  await page.goto(`${BASE}/app/onboarding`, { waitUntil: 'networkidle' })
  const entete = await page.locator('text=/Étape \\d+ sur \\d+/i').first().innerText()
  // `text-caption-uppercase` rend « Étape 1 sur 2 » en capitales à l'écran.
  noter('L’assistant annonce deux étapes', /sur 2/i.test(entete), entete)

  const texte = await page.locator('main').innerText()
  noter(
    'Aucune étape « premier locataire » ni « premier bail »',
    !/premier locataire|premier bail/i.test(texte),
  )

  // ── 3. On atteint le tableau de bord sans saisir de donnée métier ────────
  await page.locator('button:has-text("Continuer")').first().click()
  await page.waitForSelector('text=/Votre signature/', { timeout: 15000 })
  noter('L’étape 2 est la signature', true)

  await page.locator('button:has-text("Je la mettrai plus tard")').first().click()
  await page.waitForURL(/\/app(\?|$)/, { timeout: 20000 })
  noter('Le tableau de bord est atteint sans locataire ni bail', true, page.url().replace(BASE, ''))

  noter('Aucun locataire n’a été créé', (await compter('locataires', compte.id)) === 0)
  noter('Aucun logement n’a été créé', (await compter('logements', compte.id)) === 0)

  const apresOnboarding = await bailleur(compte.id)
  noter('L’onboarding est marqué terminé', apresOnboarding?.onboarding_termine === true)

  // ── 4. La visite guidée s'ouvre d'elle-même ─────────────────────────────
  await page.waitForTimeout(1200)
  const visite = page.locator('[role="region"][aria-label="Visite guidée"]')
  noter('La visite s’ouvre à la première arrivée', await visite.isVisible().catch(() => false))

  const ouverture = await visite.innerText().catch(() => '')
  noter(
    'Elle commence par le logement',
    /Commencez par un logement/i.test(ouverture),
    ouverture.split('\n')[1] || '',
  )
  noter('Elle affiche la progression', /Votre première location/i.test(ouverture))
  noter('Aucun jalon n’est encore accompli', /0\/5/.test(ouverture))

  // ── 5. Elle n'est PAS modale : l'application reste utilisable ───────────
  //
  // C'est l'invariant central. L'ancien didacticiel posait un `fixed inset-0`
  // qui avalait tous les clics ; un parcours qui attend une vraie action ne
  // peut pas se le permettre.
  const traverse = await page.evaluate(() => {
    const couche = document.querySelector('[role="region"][aria-label="Visite guidée"]')
    if (!couche) return { ok: false, raison: 'couche absente' }
    if (getComputedStyle(couche).pointerEvents !== 'none') {
      return { ok: false, raison: 'la couche capte les clics' }
    }

    // Au centre du halo, l'élément sous le curseur doit être la cible réelle,
    // pas la couche de la visite.
    const halo = couche.querySelector('div[style*="box-shadow"]')
    if (!halo) return { ok: true, raison: 'étape centrée, pas de halo' }

    const r = halo.getBoundingClientRect()
    const dessous = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return {
      ok: Boolean(dessous) && !couche.contains(dessous),
      raison: dessous ? dessous.tagName + '.' + String(dessous.className).slice(0, 30) : 'rien',
    }
  })
  noter('La cible éclairée reste cliquable', traverse.ok, traverse.raison)

  // ── 6. L'étape avance sur l'ACTION, pas sur un bouton ──────────────────
  noter(
    'Aucun bouton « Suivant » ne permet de sauter l’étape',
    (await page.locator('[role="region"][aria-label="Visite guidée"] button:has-text("Suivant")').count()) === 0,
  )

  await page.locator('[role="region"] a:has-text("Ajouter un logement")').click()
  await page.waitForURL(/\/app\/logements\/nouveau/, { timeout: 20000 })
  noter('Le raccourci mène au bon formulaire', true, page.url().replace(BASE, ''))
  noter(
    'La visite survit à la navigation',
    await visite.isVisible().catch(() => false),
  )

  await page.fill('input[name="adresse"]', 'Lot 42, Carré 118')
  await page.fill('input[name="ville"]', 'Cotonou')
  await page.selectOption('select[name="type"]', 'Maison')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/app\/logements(\?|$)/, { timeout: 20000 })
  await page.waitForTimeout(1200)

  noter('Le logement est bien créé', (await compter('logements', compte.id)) === 1)

  const apresLogement = await visite.innerText().catch(() => '')
  noter(
    'L’étape a avancé d’elle-même vers le locataire',
    /Ajoutez votre locataire/i.test(apresLogement),
    apresLogement.split('\n')[1] || '',
  )
  noter('La progression est passée à 1/5', /1\/5/.test(apresLogement))

  // ── 7. Quitter est persistant ──────────────────────────────────────────
  await page.locator('[role="region"] button:has-text("Quitter")').click()
  await page.waitForTimeout(1200)
  noter('Quitter ferme la visite', !(await visite.isVisible().catch(() => false)))

  const apresQuitter = await bailleur(compte.id)
  noter(
    'La sortie est enregistrée en base',
    Boolean(apresQuitter?.visite_quittee_le),
    `visite_quittee_le = ${apresQuitter?.visite_quittee_le}`,
  )
  noter(
    'Elle n’est PAS comptée comme terminée',
    apresQuitter?.tutoriel_vu_le === null,
  )

  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  noter(
    'Elle ne se rouvre pas d’elle-même après un rafraîchissement',
    !(await visite.isVisible().catch(() => false)),
  )

  // ── 8. Reprendre repart à la bonne étape ───────────────────────────────
  const reprendre = page.locator('button:has-text("Reprendre la visite guidée")')
  noter('Le point de reprise est proposé', await reprendre.isVisible().catch(() => false))

  await reprendre.click()
  await page.waitForTimeout(1500)
  const reprise = await visite.innerText().catch(() => '')
  noter(
    'Elle reprend au locataire, pas au début',
    /Ajoutez votre locataire/i.test(reprise),
    reprise.split('\n')[1] || '',
  )
  noter('La progression acquise est conservée', /1\/5/.test(reprise))

  // ── 9. Mobile : la cible est celle du tiroir, pas l'aside masqué ────────
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(800)
  const surMobile = await page.evaluate(() => {
    const tous = [...document.querySelectorAll('[data-visite="nav-locataires"]')]
    const visibles = tous.filter((n) => n.offsetParent !== null)
    return { total: tous.length, visibles: visibles.length }
  })
  noter(
    'Aucune cible fantôme n’est retenue sur écran étroit',
    surMobile.visibles === 0 || surMobile.visibles === 1,
    `${surMobile.visibles} visible(s) sur ${surMobile.total} dans le DOM`,
  )
  noter(
    'La visite reste affichée sur mobile',
    await visite.isVisible().catch(() => false),
  )
  await page.setViewportSize({ width: 1280, height: 900 })

  const echecs = etapes.filter((e) => !e).length
  console.log(
    echecs === 0
      ? `\n✓ ${etapes.length} étapes du parcours.`
      : `\n✗ ${echecs} étape(s) en échec sur ${etapes.length}.`,
  )

  await navigateur.close()
  process.exit(echecs === 0 ? 0 : 1)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
