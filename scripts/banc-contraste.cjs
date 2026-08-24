/**
 * Banc de contraste — WCAG 1.4.3, sur les pages publiques.
 *
 *   npm run banc:contraste                    (toutes les pages, deux thèmes)
 *   node scripts/banc-contraste.cjs <url> [clair|sombre]
 *
 * Deux pièges ont produit de fausses alertes avant que ce banc n'existe. Ils
 * sont désormais désamorcés dans le code ci-dessous, et il faut les garder en
 * tête si l'on écrit un autre outil de mesure :
 *
 *   1. `getComputedStyle` rend les fonds à opacité de Tailwind v4 en `oklab()`,
 *      et `canvas.fillStyle` ne les convertit PAS. Lire « oklab(0.969 0.0026
 *      -0.0089) » comme du RGB donne un quasi-noir — d'où un 1,85:1 annoncé sur
 *      des liens parfaitement lisibles. La parade : peindre le pixel et le
 *      relire.
 *
 *   2. Une couche semi-transparente doit être COMPOSÉE sur ce qu'elle recouvre.
 *      L'en-tête du site est translucide ; le prendre tel quel fausse tout.
 *
 * Le seuil suit la spécification : 3:1 à partir de 24 px, ou 18,66 px en gras.
 */
const { chromium } = require('playwright-core')

const BASE = process.env.BASE_CONTRASTE || 'http://localhost:3000'

/** Les pages accessibles sans session. Le reste demande une connexion. */
const PAGES = [
  '/',
  '/exemple-quittance',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  '/legal/conditions',
  '/legal/confidentialite',
]

const THEMES = ['clair', 'sombre']

const MESURE = () => {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })

  /**
   * Résout une couleur CSS en RGBA réels, en la PEIGNANT puis en relisant le
   * pixel.
   *
   * Lire `canvas.fillStyle` ne suffit pas : Chrome renvoie `oklab(…)` tel
   * quel, et Tailwind v4 exprime les fonds à opacité dans cette notation.
   * Interpréter « oklab(0.969 0.0026 -0.0089) » comme du RGB donne un
   * quasi-noir — d'où le fameux 1,85:1 sur des liens parfaitement lisibles.
   * Peindre force le moteur à faire la conversion lui-même.
   */
  const resoudre = (couleur) => {
    c.clearRect(0, 0, 1, 1)
    c.fillStyle = couleur
    c.fillRect(0, 0, 1, 1)
    const d = c.getImageData(0, 0, 1, 1).data
    return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }
  }

  const lum = ([r, g, b]) => {
    const f = (x) => {
      const s = x / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }

  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }

  /**
   * Fond effectif : les couches semi-transparentes sont composées sur ce
   * qu'elles recouvrent, jamais prises telles quelles.
   */
  const fond = (el) => {
    const couches = []
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const { rgb: couleur, a } = resoudre(getComputedStyle(n).backgroundColor)
      if (a === 0) continue
      couches.push({ couleur, a })
      if (a === 1) break
    }
    couches.push({ couleur: [255, 255, 255], a: 1 })

    let resultat = couches[couches.length - 1].couleur
    for (let i = couches.length - 2; i >= 0; i--) {
      const { couleur, a } = couches[i]
      resultat = resultat.map((sous, k) => Math.round(couleur[k] * a + sous * (1 - a)))
    }
    return resultat
  }

  const sorties = []
  const vus = new Set()

  for (const el of document.querySelectorAll('body *')) {
    // Seuls les éléments portant directement du texte visible comptent.
    const texte = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim()
    if (!texte) continue

    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue

    const style = getComputedStyle(el)
    if (style.visibility === 'hidden' || style.opacity === '0') continue

    const taille = parseFloat(style.fontSize)
    const gras = Number(style.fontWeight) >= 700
    // WCAG 1.4.3 : 3:1 suffit à partir de 24 px, ou 18,66 px en gras.
    const grand = taille >= 24 || (gras && taille >= 18.66)
    const seuil = grand ? 3 : 4.5

    const valeur = ratio(resoudre(style.color).rgb, fond(el))
    if (valeur >= seuil) continue

    const cle = `${style.color}|${texte.slice(0, 30)}`
    if (vus.has(cle)) continue
    vus.add(cle)

    sorties.push({
      texte: texte.slice(0, 46),
      ratio: Math.round(valeur * 100) / 100,
      seuil,
      taille: Math.round(taille * 10) / 10,
      gras,
      couleur: style.color,
      classe: (el.className.toString() || '').slice(0, 60),
    })
  }

  return sorties.sort((a, b) => a.ratio - b.ratio)
}

;(async () => {
  const navigateur = await chromium.launch({
    executablePath:
      require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })

  // Un argument explicite l'emporte : utile pour n'inspecter qu'une page.
  const cibles = process.argv[2]
    ? [{ url: process.argv[2], theme: process.argv[3] || 'clair' }]
    : PAGES.flatMap((chemin) => THEMES.map((theme) => ({ url: BASE + chemin, theme })))

  console.log(`Contraste WCAG 1.4.3 — ${cibles.length} vérifications\n`)
  let total = 0

  for (const { url, theme } of cibles) {
    const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } })

    // Le thème passe par le même `localStorage` que l'application. Poser
    // `data-theme` à la main ne marche pas : le composant de thème l'efface au
    // montage, et la mesure se ferait en clair en croyant l'inverse.
    await page.addInitScript((t) => window.localStorage.setItem('sikaloc-theme', t), theme)

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    } catch {
      console.log(`  ✗ ${url} [${theme}] — page injoignable`)
      total++
      await page.close()
      continue
    }

    const echecs = await page.evaluate(MESURE)
    total += echecs.length

    const nom = url.replace(BASE, '') || '/'
    if (echecs.length === 0) {
      console.log(`  ✓ ${nom.padEnd(26)} ${theme}`)
    } else {
      console.log(`  ✗ ${nom.padEnd(26)} ${theme}`)
      for (const e of echecs) {
        console.log(
          `      ${e.ratio.toFixed(2)} / ${e.seuil}  « ${e.texte} »  ${e.taille}px` +
            `${e.gras ? ' gras' : ''} · ${e.couleur}`,
        )
      }
    }

    await page.close()
  }

  console.log(
    total === 0
      ? '\n✓ Tous les textes atteignent leur seuil.'
      : `\n✗ ${total} texte(s) sous le seuil.`,
  )

  await navigateur.close()
  process.exit(total === 0 ? 0 : 1)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
