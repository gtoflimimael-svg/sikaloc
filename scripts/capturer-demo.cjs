/**
 * Captures du produit pour la section « Démo visuelle » de l'accueil.
 *
 *   supabase start
 *   set -a && . ./.env.local && set +a && . <env pointant sur la pile locale>
 *   npm run build && npm run start
 *   node scripts/capturer-demo.cjs
 *
 * Les captures montrent la VRAIE interface, peuplée par `supabase/seed.sql` :
 * trois locataires, un loyer payé, un partiel, un en retard. Les personnes et
 * les montants sont fictifs ; l'écran, lui, est celui que le bailleur verra.
 *
 * La session s'ouvre par un lien de vérification obtenu de l'API
 * d'administration LOCALE, jamais en saisissant un mot de passe dans le
 * formulaire de connexion. Le compte de démonstration n'existe que dans le
 * conteneur de cette machine ; le script refuse de tourner sur autre chose que
 * `127.0.0.1`.
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE_DEMO || 'http://localhost:3000'
const SORTIE = path.join(process.cwd(), 'public/demo')

const COMPTE_DEMO = 'demo@sikaloc.com'

/** Garde-fou : jamais sur autre chose qu'une machine locale. */
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
  console.error(`Refus : ${BASE} n'est pas une adresse locale.`)
  process.exit(1)
}

const CAPTURES = [
  { nom: 'tableau-de-bord', chemin: '/app', attendre: 'text=/Ce mois|Encaiss/i' },
  { nom: 'saisie-paiement', chemin: '/app/paiements/nouveau', attendre: 'form' },
  // `/app/quittances` n'a pas d'index : les quittances se téléchargent depuis
  // la liste des paiements. C'est donc elle qui montre le document au visiteur.
  { nom: 'liste-paiements', chemin: '/app/paiements', attendre: 'text=/Paiement/i' },
]

;(async () => {
  fs.mkdirSync(SORTIE, { recursive: true })

  const navigateur = await chromium.launch({
    executablePath:
      require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })

  // Facteur 2 : les captures sont affichées à ~380 px de large sur l'accueil,
  // et doivent rester nettes sur un écran à haute densité.
  const contexte = await navigateur.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
  })
  const page = await contexte.newPage()

  console.log('Ouverture de session sur la pile locale…')

  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabase || !service) {
    console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.')
    process.exit(1)
  }
  if (!/127\.0\.0\.1|localhost/.test(supabase)) {
    console.error(`Refus : ${supabase} n'est pas une pile locale.`)
    process.exit(1)
  }

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Deux appels à l'API locale : un jeton à usage unique, puis son échange
  // contre une session. Ni mot de passe saisi, ni cookie fabriqué à la main.
  //
  // Le lien de vérification tout fait n'est pas utilisable ici : `config.toml`
  // pointe volontairement `site_url` sur la production — pour qu'un
  // `config push` distrait ne casse pas l'authentification réelle — et la
  // redirection partirait donc vers le site en ligne.
  const jeton = await (
    await fetch(`${supabase}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'magiclink', email: COMPTE_DEMO }),
    })
  ).json()

  if (!jeton.hashed_token) {
    console.error('Jeton non obtenu :', JSON.stringify(jeton).slice(0, 200))
    process.exit(1)
  }

  const session = await (
    await fetch(`${supabase}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'magiclink', token_hash: jeton.hashed_token }),
    })
  ).json()

  if (!session.access_token) {
    console.error('Session non obtenue :', JSON.stringify(session).slice(0, 200))
    process.exit(1)
  }

  /*
   * Les cookies sont produits par `@supabase/ssr` LUI-MÊME, pas reconstitués à
   * la main : nom, encodage et découpage en tranches sont des détails internes
   * qui changent d'une version à l'autre. On lui donne un adaptateur qui note
   * ce qu'il veut écrire, et on le recopie tel quel dans le navigateur.
   *
   * Le fragment d'URL, qui aurait été plus simple, ne fonctionne pas ici :
   * l'authentification de Sikaloc est entièrement côté serveur et aucun client
   * Supabase ne tourne dans la page pour le lire.
   */
  const { createServerClient } = require('@supabase/ssr')

  const aEcrire = []
  const client = createServerClient(supabase, anon, {
    cookies: { getAll: () => [], setAll: (liste) => aEcrire.push(...liste) },
  })

  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  if (aEcrire.length === 0) {
    console.error('Aucun cookie de session produit.')
    process.exit(1)
  }

  const hote = new URL(BASE)
  await contexte.addCookies(
    aEcrire.map(({ name, value }) => ({
      name,
      value,
      domain: hote.hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    })),
  )

  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })

  if (!/\/app(\/|$|\?)/.test(page.url())) {
    console.error(`Session non établie — page actuelle : ${page.url().slice(0, 90)}`)
    process.exit(1)
  }
  console.log(`  ✓ session ouverte (${session.user.email})\n`)

  /*
   * Le jeu de démonstration n'émet aucune quittance : la colonne « Document »
   * afficherait « À confirmer » sur toutes les lignes, et le visiteur ne verrait
   * jamais le document que la page d'accueil lui promet.
   *
   * Confirmer un paiement du seed est impossible : ils sont figés, la fenêtre de
   * correction de cinq minutes étant écoulée depuis longtemps. On en saisit donc
   * un neuf, ce qui a l'avantage d'exercer le parcours réel de bout en bout —
   * saisie, confirmation, génération du PDF.
   */
  async function emettreUneQuittance() {
    await page.goto(`${BASE}/app/paiements/nouveau`, { waitUntil: 'networkidle' })

    // Un bail dont les mois récents sont libres, pour éviter un doublon.
    const bail = page.locator('select').first()
    const options = await bail.locator('option').allTextContents()
    const choisi = options.find((o) => /Pascal/i.test(o)) ?? options[0]
    await bail.selectOption({ label: choisi })

    // Le loyer exact : un montant inférieur produirait un reçu, pas une
    // quittance — c'est écrit sous le champ, autant le respecter.
    const aide = await page.locator('text=/Loyer mensuel de ce bail/').innerText()
    const montant = (aide.match(/([\d\s\u202f]+)\s*FCFA/) || [])[1]
    if (montant) {
      await page.locator('input[name="montant"], input[type="number"]').first()
        .fill(montant.replace(/[^\d]/g, ''))
    }

    await page.locator('button:has-text("Continuer")').first().click()
    await page.waitForURL(/confirmer/, { timeout: 20000 })

    /*
     * `BoutonAction` confirme en deux temps, mais le second bouton reprend le
     * même libellé et passe aussitôt en « Génération… ». Chercher deux fois le
     * libellé d'origine échoue donc une fois sur deux, selon la vitesse de la
     * page. On clique tant qu'un bouton portant ce libellé est cliquable.
     */
    for (let essai = 0; essai < 2; essai++) {
      const bouton = page.locator('button:has-text("Confirmer et générer")').last()
      if ((await bouton.count()) === 0) break
      if (!(await bouton.isEnabled().catch(() => false))) break
      await bouton.click().catch(() => undefined)
      await page.waitForTimeout(800)
    }

    try {
      // Le document émis s'annonce par son numéro : « N° 2026-0002 ».
      await page.waitForSelector('text=/N°\\s*\\d{4}-\\d{4}/', { timeout: 45000 })
      console.log('  ✓ quittance émise par le parcours réel')
    } catch {
      const texte = (await page.locator('main').innerText().catch(() => '')) || ''
      const erreur = texte.split('\n').find((l) => /erreur|impossible|échou/i.test(l))
      console.log(`  ⚠ quittance non émise — ${erreur || texte.slice(0, 140).replace(/\n/g, ' ')}`)
    }
  }

  await emettreUneQuittance()

  console.log('')

  for (const { nom, chemin, attendre } of CAPTURES) {
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' })
    try {
      await page.waitForSelector(attendre, { timeout: 10000 })
    } catch {
      console.log(`  ⚠ ${nom} — repère « ${attendre} » introuvable, capture quand même`)
    }

    // Laisse les animations d'entrée se terminer.
    await page.waitForTimeout(600)

    const fichier = path.join(SORTIE, `${nom}.png`)
    await page.screenshot({ path: fichier })
    const taille = Math.round(fs.statSync(fichier).size / 1024)
    console.log(`  ✓ ${nom.padEnd(18)} ${chemin.padEnd(26)} ${taille} ko`)
  }

  await navigateur.close()
  console.log(`\nCaptures écrites dans public/demo/`)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
