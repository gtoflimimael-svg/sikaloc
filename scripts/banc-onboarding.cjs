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
      user_metadata: { nom: 'Banc Onboarding', telephone: '+2290190000000', nb_logements: '3' },
    }),
  })

  const utilisateur = await reponse.json()
  if (!utilisateur.id) {
    console.error('Compte non créé :', JSON.stringify(utilisateur).slice(0, 200))
    process.exit(1)
  }

  // `/app` exige les deux vérifications : sans celle-ci, le banc n'irait pas
  // plus loin que l'écran de vérification.
  await verifierTelephoneFixture(utilisateur.id)

  return { id: utilisateur.id, email }
}

/**
 * Marque le téléphone de la fixture comme vérifié.
 *
 * Depuis Sikaloc 8.2, `/app` exige les DEUX vérifications. Un compte créé par
 * l'API d'administration a son email confirmé mais son téléphone non : sans
 * cette ligne, le banc n'atteint plus que /verification.
 *
 * C'est une fixture, jamais un compte réel : le cahier des charges interdit de
 * présumer vérifié le numéro d'un vrai bailleur, pas celui d'un compte jetable
 * créé par le banc lui-même.
 */
async function verifierTelephoneFixture(id) {
  await fetch(`${SUPABASE}/rest/v1/bailleurs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...entetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      telephone_verifie_le: new Date().toISOString(),
      telephone_canal_verification: 'SMS',
    }),
  })
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
  noter(
    'Les jalons montrent leur état par pastille',
    /🟡/.test(ouverture) && /⚪/.test(ouverture),
    'jaune pour l’étape courante, blanc pour les suivantes',
  )

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

  // ── 6 ter. Accompagnement DANS le formulaire ───────────────────────────
  //
  // La visite doit expliquer les champs sans jamais gêner la saisie. Les deux
  // moitiés de cette phrase se vérifient.

  const surFormulaire = await page.evaluate(() => {
    const couche = document.querySelector('[role="region"][aria-label="Visite guidée"]')
    if (!couche) return { ok: false, raison: 'visite absente du formulaire' }
    const texte = couche.innerText
    return {
      ok: /Adresse/.test(texte) && /Ville/.test(texte) && /Type de bien/.test(texte),
      raison: texte.replace(/\n+/g, ' | ').slice(0, 90),
    }
  })
  noter('Elle énumère les champs à renseigner', surFormulaire.ok, surFormulaire.raison)

  const aideInitiale = await page.evaluate(
    () => document.querySelector('[data-visite="aide-champ"]')?.textContent || '',
  )
  noter(
    'Elle explique le premier champ',
    /retrouver le bien/i.test(aideInitiale),
    aideInitiale.slice(0, 64),
  )

  // Le liseré doit entourer le champ courant, sans assombrir le formulaire.
  const eclairageChamp = await page.evaluate(() => {
    const couche = document.querySelector('[role="region"][aria-label="Visite guidée"]')
    const voile = [...couche.querySelectorAll('div')].find((d) =>
      /box-shadow/.test(d.getAttribute('style') || ''),
    )
    const champ = document.querySelector('input[name="adresse"]')
    const liseres = [...couche.querySelectorAll('div[style*="outline"]')]
    if (!champ || liseres.length === 0) return { ok: false, raison: 'aucun liseré' }
    const l = liseres[0].getBoundingClientRect()
    const c = champ.getBoundingClientRect()
    return {
      ok: !voile && l.top <= c.top && l.bottom >= c.bottom && l.left <= c.left,
      raison: voile ? 'un voile assombrit le formulaire' : 'liseré posé, sans voile',
    }
  })
  noter('Elle éclaire le champ sans assombrir le formulaire', eclairageChamp.ok, eclairageChamp.raison)

  // L'explication suit le champ qui reçoit le focus.
  await page.focus('select[name="type"]')
  await page.waitForTimeout(500)
  const aideType = await page.evaluate(
    () => document.querySelector('[data-visite="aide-champ"]')?.textContent || '',
  )
  noter(
    'L’explication suit le champ sélectionné',
    /chaque quittance/i.test(aideType),
    aideType.slice(0, 64),
  )

  // Rien de la visite ne doit recouvrir un champ ni le bouton d'envoi.
  const riennEstCouvert = await page.evaluate(() => {
    const couche = document.querySelector('[role="region"][aria-label="Visite guidée"]')
    const cibles = ['input[name="adresse"]', 'input[name="ville"]', 'select[name="type"]', 'button[type="submit"]']
    for (const sel of cibles) {
      const el = document.querySelector(sel)
      if (!el) continue
      const r = el.getBoundingClientRect()
      const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (dessus && couche.contains(dessus)) return { ok: false, raison: `${sel} est recouvert` }
    }
    return { ok: true, raison: 'champs et bouton d’envoi tous atteignables' }
  })
  noter('Rien du formulaire n’est recouvert', riennEstCouvert.ok, riennEstCouvert.raison)

  await page.fill('input[name="adresse"]', 'Lot 42, Carré 118')
  await page.fill('input[name="ville"]', 'Cotonou')
  await page.selectOption('select[name="type"]', 'Maison')
  await page.waitForTimeout(600)
  const coches = await page.evaluate(() => {
    const couche = document.querySelector('[role="region"][aria-label="Visite guidée"]')
    return couche ? couche.querySelectorAll('svg').length : 0
  })
  noter('Les champs remplis sont cochés', coches >= 3, `${coches} marque(s) dans la bulle`)

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

  // ── 6 bis. Actions inattendues, parcours EN COURS ──────────────────────
  //
  // C'est ici que l'exigence a un sens : la visite est ouverte, il reste
  // quatre étapes. Une fois le parcours terminé, il n'y a plus rien à guider
  // et disparaître après un rechargement n'est pas un défaut.

  await page.mouse.click(5, 5)
  await page.waitForTimeout(600)
  noter('Un clic à côté ne la ferme pas', await visite.isVisible().catch(() => false))

  await page.goto(`${BASE}/app/logements`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1300)
  noter('Une navigation manuelle ne la casse pas', await visite.isVisible().catch(() => false))

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  noter(
    'Un rafraîchissement en plein parcours la conserve',
    await visite.isVisible().catch(() => false),
  )

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(900)
  noter(
    'Elle reste affichée sur un écran de 390 px',
    await visite.isVisible().catch(() => false),
  )
  const surMobile = await page.evaluate(() => {
    const tous = [...document.querySelectorAll('[data-visite="nav-locataires"]')]
    return { total: tous.length, visibles: tous.filter((n) => n.offsetParent !== null).length }
  })
  noter(
    'Aucune cible fantôme n’est retenue sur écran étroit',
    surMobile.visibles <= 1,
    `${surMobile.visibles} visible(s) sur ${surMobile.total} dans le DOM`,
  )
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForTimeout(500)

  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

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

  // ── 9. Le parcours en ENTIER, jusqu'à la quittance ─────────────────────
  //
  // Les quatre étapes restantes reposent sur le même mécanisme que la
  // première, mais « reposer sur le même mécanisme » n'est pas une preuve.
  // On les déroule donc pour de vrai.

  /** Lit l'étape affichée dans la bulle, après l'avoir laissée se replacer. */
  const etapeAffichee = async () => {
    await page.waitForTimeout(1400)
    return (await visite.innerText().catch(() => '')).replace(/\n+/g, ' | ')
  }

  page.on('pageerror', (e) => console.log('    [erreur page]', String(e).slice(0, 300)))
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('    [console]', m.text().slice(0, 300))
  })

  // ── Locataire ──
  await page.locator('[role="region"] a:has-text("Ajouter un locataire")').click()
  await page.waitForURL(/\/app\/locataires\/nouveau/, { timeout: 20000 })
  await page.fill('input[name="nom"]', 'Awa Hounkpatin')
  await page.fill('#telephone', '0197000001')
  await page.check('input[name="consentement"]')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/app\/locataires(\?|$)/, { timeout: 20000 })
  noter('Le locataire est créé', (await compter('locataires', compte.id)) === 1)
  const apresLocataire = await etapeAffichee()
  noter('L’étape passe au bail', /Reliez les deux par un bail/i.test(apresLocataire))
  noter('La progression est à 2/5', /2\/5/.test(apresLocataire))

  // ── Bail ──
  await page.locator('[role="region"] a:has-text("Créer le bail")').click()
  await page.waitForURL(/\/app\/baux\/nouveau/, { timeout: 20000 })
  noter(
    'Le formulaire de bail est bien rendu (aucun diagnostic bloquant)',
    (await page.locator('select[name="logementId"]').count()) === 1,
  )
  await page.selectOption('select[name="logementId"]', { index: 1 })
  await page.selectOption('select[name="locataireId"]', { index: 1 })
  await page.fill('input[name="loyerMensuel"]', '75000')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/app\/baux\/[0-9a-f-]{36}/, { timeout: 20000 })
  noter('Le bail est créé', (await compter('baux', compte.id)) === 1, page.url().replace(BASE, ''))
  const apresBail = await etapeAffichee()
  noter('L’étape passe au paiement', /Enregistrez un loyer reçu/i.test(apresBail))
  noter('La progression est à 3/5', /3\/5/.test(apresBail))

  // ── Paiement : saisie puis confirmation ──
  await page.locator('[role="region"] a:has-text("Enregistrer un paiement")').click()
  await page.waitForURL(/\/app\/paiements\/nouveau/, { timeout: 20000 })
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/app\/paiements\/[0-9a-f-]{36}\/confirmer/, { timeout: 20000 })
  noter('La saisie mène à l’écran de confirmation', true, page.url().replace(BASE, ''))

  // Amené dans le champ de vision par Playwright, qui effectue un vrai
  // défilement et l'attend. `scrollIntoView()` depuis `page.evaluate` ne
  // suffisait pas : la mesure suivait trop vite, et le centre du bouton
  // tombait 19 px sous la fenêtre — `elementFromPoint` rendait alors `null`,
  // ce qui ne dit rien d'un recouvrement par la visite et faisait échouer le
  // contrôle sur une page parfaitement utilisable (le clic juste après passe).
  await page
    .locator('button', { hasText: /Confirmer et générer/i })
    .first()
    .scrollIntoViewIfNeeded()

  const surConfirmation = await page.evaluate(() => {
    const couche = document.querySelector('[role="region"][aria-label="Visite guidée"]')
    const bouton = [...document.querySelectorAll('button')].find((b) =>
      /Confirmer et générer/i.test(b.textContent || ''),
    )
    if (!bouton) return { ok: false, raison: 'bouton de confirmation absent' }

    const tous = [...document.querySelectorAll('button')].filter((b) => /Confirmer et générer/i.test(b.textContent || ''))

    const r = bouton.getBoundingClientRect()
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return {
      ok: Boolean(dessus) && (!couche || !couche.contains(dessus)),
      raison: dessus
        ? `${dessus.tagName}${dessus === bouton ? ' (le bouton lui-même)' : ''}`
        : `rien — ${tous.length} bouton(s), rect ${Math.round(r.top)},${Math.round(r.left)} ${Math.round(r.width)}x${Math.round(r.height)}, offsetParent ${bouton.offsetParent ? 'oui' : 'NON'}, fenêtre ${window.innerWidth}x${window.innerHeight}`,
    }
  })
  noter('La visite ne recouvre pas le bouton de confirmation', surConfirmation.ok, surConfirmation.raison)

  await page.locator('button:has-text("Confirmer et générer")').first().click()
  await page.waitForURL(/\/app\/quittances\/[0-9a-f-]{36}/, { timeout: 30000 })
  noter('La confirmation mène à la quittance', true, page.url().replace(BASE, ''))
  noter('Le paiement est validé', (await compter('paiements', compte.id)) === 1)

  // ── Écran final ──
  const fin = await etapeAffichee()
  noter('La visite annonce la fin du parcours', /Félicitations/i.test(fin), fin.slice(0, 70))
  noter('Les cinq jalons sont accomplis', /5\/5/.test(fin))
  noter('Les jalons portent des pastilles vertes', /🟢/.test(fin))
  noter('L’écran de fin propose quoi découvrir ensuite', /À découvrir ensuite/i.test(fin))
  noter(
    'Il renvoie vers les impayés, la signature et l’export',
    (await page.locator('[role="region"] a[href="/app/impayes"]').count()) === 1 &&
      (await page.locator('[role="region"] a[href="/app/parametres/signature"]').count()) === 1 &&
      (await page.locator('[role="region"] a[href="/app/parametres/donnees"]').count()) === 1,
  )
  noter(
    'Un bouton conclut le parcours',
    (await page.locator('[role="region"] button:has-text("Terminer la visite")').count()) === 1,
  )

  await page.locator('[role="region"] button:has-text("Terminer la visite")').click()
  await page.waitForTimeout(1600)
  noter('La visite se ferme', !(await visite.isVisible().catch(() => false)))

  const apresFin = await bailleur(compte.id)
  noter(
    'Elle est enregistrée comme terminée',
    Boolean(apresFin?.tutoriel_vu_le),
    `tutoriel_vu_le = ${apresFin?.tutoriel_vu_le}`,
  )
  noter(
    'La trace d’abandon est effacée',
    apresFin?.visite_quittee_le === null,
    `visite_quittee_le = ${apresFin?.visite_quittee_le}`,
  )

  // ── 10. Terminée, elle ne revient plus ─────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  noter('Elle ne redémarre pas à la visite suivante', !(await visite.isVisible().catch(() => false)))
  noter(
    'Mais elle reste rejouable',
    await page.locator('button:has-text("Revoir la visite guidée")').isVisible().catch(() => false),
  )

  // ── 11. Actions inattendues ────────────────────────────────────────────
  await page.locator('button:has-text("Revoir la visite guidée")').click()
  await page.waitForTimeout(1600)
  noter('Le rejeu rouvre la visite', await visite.isVisible().catch(() => false))
  noter(
    'Tout étant accompli, elle s’ouvre sur l’écran final',
    /Félicitations/i.test(await visite.innerText().catch(() => '')),
  )

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
