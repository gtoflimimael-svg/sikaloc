/**
 * Parcours de bout en bout de la capture de signature.
 *
 *   npm run banc:parcours
 *
 * Monte les VRAIS composants (`CaptureSignature`, `SignatureDessin`,
 * `SignatureImport`) dans un navigateur et rejoue ce que fait un bailleur :
 * il dessine au doigt, il annule, il efface, il importe une photo, il recadre,
 * il détoure. Le test vérifie à chaque étape ce que le formulaire posterait
 * réellement — le contenu de l'<input type="file"> caché — parce que c'est cela
 * seul qui arrive à la Server Action.
 *
 * La page de signature exige une session connectée, que ce banc ne peut pas
 * ouvrir. Il ne remplace donc pas un essai sur l'application déployée ; il
 * garantit que les composants eux-mêmes se comportent comme prévu.
 */
const { build } = require('esbuild')
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')

const RACINE = path.resolve(__dirname, '..')

const POINT_ENTREE = `
import { createRoot } from 'react-dom/client'
import { createElement as h, useState } from 'react'
import { CaptureSignature } from '@/components/app/capture-signature'

function Banc() {
  const [fichier, setFichier] = useState(null)
  window.__fichier = fichier
  return h('form', { id: 'formulaire' },
    h(CaptureSignature, { onFichier: setFichier }))
}

createRoot(document.getElementById('racine')).render(h(Banc))
`

;(async () => {
  const paquet = await build({
    stdin: { contents: POINT_ENTREE, resolveDir: RACINE, loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'iife',
    target: 'chrome120',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    alias: { '@': path.join(RACINE, 'src') },
    define: { 'process.env.NODE_ENV': '"development"' },
  })

  const navigateur = await chromium.launch({
    executablePath: require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })

  const page = await navigateur.newPage({ viewport: { width: 900, height: 1000 } })
  const plaintes = []
  page.on('pageerror', (e) => plaintes.push('erreur JS : ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') plaintes.push('console : ' + m.text())
  })

  // Tailwind n'est pas chargé dans ce banc : on redonne aux seules classes qui
  // portent une géométrie leur effet réel, faute de quoi les boîtes n'ont pas de
  // dimensions et le test mesurerait un composant qui n'existe nulle part.
  // `react-easy-crop` positionne tout son recadreur par CSS. Le banc neutralise
  // les imports de feuilles de style, donc on réinjecte la sienne : sans elle le
  // cadre a une hauteur nulle et aucune zone n'est jamais sélectionnée.
  const CSS_RECADREUR = fs.readFileSync(
    path.join(RACINE, 'node_modules/react-easy-crop/react-easy-crop.css'),
    'utf-8',
  )

  await page.setContent(`<body style="margin:0;font-family:sans-serif">
    <style>
      #racine { width: 640px; padding: 16px }
      .h-\\[13rem\\] { height: 13rem }
      .h-\\[16rem\\] { height: 16rem }
      .relative { position: relative }
      .hidden { display: none }
      canvas { display: block }
      \${CSS_RECADREUR}
    </style>
    <div id="racine"></div></body>`)
  await page.addScriptTag({ content: paquet.outputFiles[0].text })
  await page.waitForSelector('canvas')

  const etapes = []
  const noter = (nom, ok, detail) => {
    etapes.push({ nom, ok, detail })
    console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
  }

  /** Ce que le formulaire posterait à cet instant. */
  const poste = () =>
    page.evaluate(() => {
      const champ = document.querySelector('input[name="signature"]')
      const f = champ && champ.files && champ.files[0]
      return f ? { nom: f.name, type: f.type, taille: f.size } : null
    })

  /**
   * Attend que ce qui serait posté satisfasse une condition.
   *
   * L'export passe par `canvas.toBlob`, asynchrone et parfois lent sur une
   * grande zone de dessin. Un délai fixe lirait l'état précédent et ferait
   * échouer le test sur un produit sain — c'est exactement ce qui est arrivé
   * en écrivant ce banc.
   */
  const attendrePoste = async (condition, limite = 8000) => {
    const fin = Date.now() + limite
    for (;;) {
      const etat = await poste()
      if (condition(etat)) return etat
      if (Date.now() > fin) return etat
      await page.waitForTimeout(60)
    }
  }

  console.log('Parcours de capture de signature\n')

  // ── 1. État initial ──────────────────────────────────────────────────────
  noter('Le mode « Dessiner » est proposé d’emblée',
    await page.getAttribute('[role="tab"]:has-text("Dessiner")', 'aria-selected') === 'true')
  noter('Rien n’est posté tant que rien n’est signé', (await poste()) === null)

  // ── 2. Dessin au doigt ───────────────────────────────────────────────────
  const zone = await page.locator('canvas').boundingBox()
  const tracer = async (decalage) => {
    await page.mouse.move(zone.x + 60 + decalage, zone.y + zone.height * 0.6)
    await page.mouse.down()
    for (let i = 0; i <= 20; i++) {
      await page.mouse.move(
        zone.x + 60 + decalage + i * 6,
        zone.y + zone.height * 0.6 - Math.sin(i / 2.2) * 34,
      )
    }
    await page.mouse.up()
  }

  await tracer(0)
  let f = await attendrePoste((e) => e !== null)
  noter('Un trait dessiné produit un PNG', f !== null && f.type === 'image/png',
    f ? `${f.nom} · ${Math.round(f.taille / 1024)} ko` : 'rien posté')

  const dimensions = await page.evaluate(async () => {
    const src = document.querySelector('img[alt^="Aperçu"]').src
    const img = new Image()
    await new Promise((ok) => { img.onload = ok; img.src = src })
    return { l: img.width, h: img.height }
  })
  const canvasPx = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    return { l: c.width, h: c.height }
  })
  noter('Le tracé est recadré, pas la zone entière',
    dimensions.l < canvasPx.l && dimensions.h < canvasPx.h,
    `aperçu ${dimensions.l}×${dimensions.h} pour un canvas ${canvasPx.l}×${canvasPx.h}`)

  noter('Le rendu dépasse la résolution CSS (net à l’impression)',
    canvasPx.l >= zone.width * 2, `${canvasPx.l} px pour ${Math.round(zone.width)} px CSS`)

  // ── 3. Second trait, puis annulation ─────────────────────────────────────
  const avant = (await poste()).taille
  await tracer(200)
  const apresDeux = (await attendrePoste((e) => e && e.taille !== avant)).taille
  noter('Un second trait s’ajoute au premier', apresDeux !== avant)

  await page.click('button:has-text("Annuler le dernier trait")')
  const apresAnnulation = await attendrePoste((e) => e && e.taille !== apresDeux)
  noter('« Annuler » retire le dernier trait sans tout perdre',
    apresAnnulation !== null && apresAnnulation.taille !== apresDeux)

  // ── 4. Tout effacer ──────────────────────────────────────────────────────
  await page.click('button:has-text("Tout effacer")')
  noter('« Tout effacer » vide ce qui serait posté',
    (await attendrePoste((e) => e === null)) === null)
  noter('L’aperçu disparaît avec le tracé',
    (await page.locator('img[alt^="Aperçu"]').count()) === 0)

  // ── 5. Import d’une photo ────────────────────────────────────────────────
  await page.click('[role="tab"]:has-text("Importer")')
  await page.waitForSelector('#signature-source')

  // Un fichier qui se prétend PNG mais n'en est pas un.
  await page.setInputFiles('#signature-source', {
    name: 'signature.png',
    mimeType: 'image/png',
    buffer: Buffer.from('%PDF-1.4 ceci est un PDF déguisé'),
  })
  await page.waitForTimeout(250)
  const refus = await page.locator('text=/n’est pas une image/').count()
  noter('Un faux PNG est refusé sur son contenu, pas son nom', refus > 0)

  // Une vraie photo de signature.
  const photo = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 1600; c.height = 900
    const x = c.getContext('2d')
    x.fillStyle = 'rgb(246,244,236)'; x.fillRect(0, 0, 1600, 900)
    x.fillStyle = 'rgb(50,50,55)'; x.font = '40px sans-serif'
    x.fillText('Fait à Cotonou, le 12 mars 2026', 90, 120)
    x.strokeStyle = 'rgb(35,55,150)'; x.lineWidth = 7; x.lineCap = 'round'
    x.beginPath(); x.moveTo(300, 600)
    x.bezierCurveTo(420, 470, 540, 700, 660, 560)
    x.bezierCurveTo(780, 430, 900, 660, 1040, 540)
    x.stroke()
    return c.toDataURL('image/jpeg', 0.85)
  })

  await page.setInputFiles('#signature-source', {
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(photo.split(',')[1], 'base64'),
  })
  await page.waitForSelector('button:has-text("Détourer cette zone")')
  noter('Une vraie photo ouvre l’étape de recadrage', true)

  await page.click('button:has-text("Détourer cette zone")')
  await page.waitForSelector('img[alt^="Aperçu"]', { timeout: 15000 })

  f = await poste()
  noter('Le détourage produit le PNG que le formulaire postera',
    f !== null && f.type === 'image/png',
    f ? `${Math.round(f.taille / 1024)} ko` : 'rien posté')

  const transparent = await page.evaluate(async () => {
    const img = new Image()
    await new Promise((ok) => { img.onload = ok; img.src = document.querySelector('img[alt^="Aperçu"]').src })
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    c.getContext('2d').drawImage(img, 0, 0)
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let vides = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] === 0) vides++
    return { pct: Math.round((vides / (d.length / 4)) * 100), l: img.width, h: img.height }
  })
  noter('Le fond est bien transparent', transparent.pct > 60,
    `${transparent.pct} % de pixels vides · ${transparent.l}×${transparent.h}`)

  // ── 6. Changement de mode ────────────────────────────────────────────────
  await page.click('[role="tab"]:has-text("Dessiner")')
  noter('Changer de mode n’abandonne pas une signature fantôme',
    (await attendrePoste((e) => e === null)) === null &&
      (await page.locator('img[alt^="Aperçu"]').count()) === 0)

  // ── Bilan ────────────────────────────────────────────────────────────────
  if (plaintes.length > 0) {
    console.log('\nPlaintes du navigateur :')
    for (const p of [...new Set(plaintes)]) console.log('  · ' + p)
  }

  const echecs = etapes.filter((e) => !e.ok).length
  console.log(
    echecs === 0 && plaintes.length === 0
      ? `\n✓ ${etapes.length} étapes du parcours, aucune erreur navigateur.`
      : `\n✗ ${echecs} étape(s) en échec, ${plaintes.length} plainte(s) navigateur.`,
  )

  await navigateur.close()
  process.exit(echecs === 0 && plaintes.length === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
