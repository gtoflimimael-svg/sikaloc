/**
 * Parcours d'accueil d'un nouveau bailleur.
 *
 *   supabase start · env pointant sur la pile locale · npm run build && npm run start
 *   npm run banc:onboarding
 *
 * Vérifie le lot 1 de l'évolution Bailleur / Locataire : l'assistant ne compte
 * plus que deux étapes, il n'exige plus de créer un locataire ni un bail, et le
 * didacticiel prend le relais sur le tableau de bord.
 *
 * Le point qui compte : **on doit pouvoir atteindre le tableau de bord sans
 * saisir la moindre donnée métier**. C'était impossible avant, et c'est tout
 * l'objet de ce lot.
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

  // ── 4. Le didacticiel s'ouvre de lui-même ────────────────────────────────
  await page.waitForTimeout(900)
  const dialogue = page.locator('[role="dialog"][aria-modal="true"]')
  noter('Le didacticiel s’ouvre à la première visite', await dialogue.isVisible().catch(() => false))
  noter(
    'Il commence à la première étape',
    /1 sur 7/i.test(await dialogue.innerText().catch(() => '')),
  )

  // ── 5. Il se parcourt puis se ferme ──────────────────────────────────────
  for (let i = 0; i < 6; i++) {
    await page.locator('[role="dialog"] button:has-text("Suivant")').click()
  }
  noter(
    'La dernière étape propose de conclure',
    await page.locator('[role="dialog"] button:has-text("J’ai compris")').isVisible().catch(() => false),
  )

  await page.locator('[role="dialog"] button:has-text("J’ai compris")').click()
  await page.waitForTimeout(1200)
  noter('Il se ferme', !(await dialogue.isVisible().catch(() => false)))

  const apresTutoriel = await bailleur(compte.id)
  noter(
    'La date de lecture est enregistrée',
    Boolean(apresTutoriel?.tutoriel_vu_le),
    `tutoriel_vu_le = ${apresTutoriel?.tutoriel_vu_le}`,
  )

  // ── 6. Il ne se rouvre plus, mais reste rejouable ────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  noter('Il ne se rouvre pas à la visite suivante', !(await dialogue.isVisible().catch(() => false)))

  const rejouer = page.locator('button:has-text("Revoir la visite guidée")')
  noter('Il reste rejouable', await rejouer.isVisible().catch(() => false))

  if (await rejouer.isVisible().catch(() => false)) {
    await rejouer.click()
    await page.waitForTimeout(600)
    noter('Le rejeu fonctionne', await dialogue.isVisible().catch(() => false))
  }

  // ── 7. Échap ferme ───────────────────────────────────────────────────────
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  noter('Échap ferme le didacticiel', !(await dialogue.isVisible().catch(() => false)))

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
