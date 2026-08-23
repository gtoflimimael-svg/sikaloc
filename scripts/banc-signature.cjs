/**
 * Banc d'essai de l'extraction de signature.
 *
 *   npm run banc:signature
 *
 * Compile le VRAI module `src/lib/signature/extraction.ts` pour le navigateur et
 * lui soumet les dix situations que rencontre un bailleur : encre noire, encre
 * bleue, ombre portée, trait fin, papier réglé, texte autour, image bruitée,
 * page vierge. Il n'y a pas de « bonne » image dans ce banc : une extraction qui
 * ne réussit que sur un scan parfait ne sert à rien sur le terrain.
 *
 * Les images sont écrites dans le dossier de travail pour relecture à l'œil —
 * les chiffres disent si un trait a été trouvé, pas s'il est beau.
 */
const { build } = require('esbuild')
const { chromium } = require('playwright-core')
const fs = require('fs')

const SC =
  '/tmp/claude-1000/-home-ma-l-toflimi-gbinlo-Bureau-New-project-Projet-Sika-MVP-Sika/7a1fea1d-ab94-4997-95b5-1dfed7f8b936/scratchpad'

/** Fabrique une photo de signature plausible et la rend en data URI JPEG. */
const FABRIQUER = `
(function fabriquer(cas) {
  const { largeur, hauteur, ombre, jaunissement, epaisseur, bruit, encre, lignes, texte, sansTrait } = cas
  const c = document.createElement('canvas')
  c.width = largeur; c.height = hauteur
  const x = c.getContext('2d')

  x.fillStyle = 'rgb(' + (252 - jaunissement) + ',' + (250 - jaunissement) + ',' + (242 - jaunissement * 2) + ')'
  x.fillRect(0, 0, largeur, hauteur)

  // Papier réglé
  if (lignes) {
    x.strokeStyle = 'rgb(150,170,205)'
    x.lineWidth = Math.max(1, hauteur * 0.004)
    for (let y = hauteur * 0.2; y < hauteur; y += hauteur * 0.22) {
      x.beginPath(); x.moveTo(0, y); x.lineTo(largeur, y); x.stroke()
    }
  }

  // Texte de document autour de la signature
  if (texte) {
    x.fillStyle = 'rgb(45,45,50)'
    x.font = Math.round(hauteur * 0.075) + 'px sans-serif'
    x.fillText('Fait à Cotonou, le 12 mars 2026', largeur * 0.06, hauteur * 0.16)
    x.fillText('Le bailleur,', largeur * 0.06, hauteur * 0.30)
    x.fillText('Lu et approuvé — bon pour accord', largeur * 0.06, hauteur * 0.95)
  }

  // Ombre portée en diagonale
  const g = x.createLinearGradient(0, 0, largeur * ombre, hauteur)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.30)')
  x.fillStyle = g
  x.fillRect(0, 0, largeur, hauteur)

  if (!sansTrait) {
    x.strokeStyle = encre || 'rgb(32,32,36)'
    x.lineWidth = epaisseur
    x.lineCap = 'round'; x.lineJoin = 'round'
    const bx = largeur * 0.18, by = hauteur * 0.60
    x.beginPath()
    x.moveTo(bx, by)
    x.bezierCurveTo(bx+largeur*0.06, by-hauteur*0.26, bx+largeur*0.12, by+hauteur*0.15, bx+largeur*0.17, by-hauteur*0.04)
    x.bezierCurveTo(bx+largeur*0.22, by-hauteur*0.22, bx+largeur*0.27, by+hauteur*0.12, bx+largeur*0.33, by-hauteur*0.02)
    x.bezierCurveTo(bx+largeur*0.39, by-hauteur*0.17, bx+largeur*0.46, by+hauteur*0.09, bx+largeur*0.54, by-hauteur*0.07)
    x.stroke()
    // Paraphe final, plus fin — le premier à disparaître si le seuillage est dur
    x.lineWidth = Math.max(1, epaisseur * 0.4)
    x.beginPath()
    x.moveTo(bx+largeur*0.54, by-hauteur*0.07)
    x.bezierCurveTo(bx+largeur*0.60, by+hauteur*0.05, bx+largeur*0.50, by+hauteur*0.10, bx+largeur*0.62, by+hauteur*0.03)
    x.stroke()
  }

  const img = x.getImageData(0, 0, largeur, hauteur)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * bruit
    img.data[i] += n; img.data[i+1] += n; img.data[i+2] += n
  }
  x.putImageData(img, 0, 0)

  return c.toDataURL('image/jpeg', 0.85)
})
`

const CAS = [
  { nom: 'noire-nette',      largeur: 1400, hauteur: 700,  ombre: 0.3, jaunissement: 4,  epaisseur: 7,  bruit: 6,  attendu: 'trait' },
  { nom: 'bleue-nette',      largeur: 1400, hauteur: 700,  ombre: 0.3, jaunissement: 4,  epaisseur: 7,  bruit: 6,  encre: 'rgb(40,70,190)', attendu: 'trait' },
  { nom: 'bleue-delavee',    largeur: 1400, hauteur: 700,  ombre: 0.4, jaunissement: 6,  epaisseur: 6,  bruit: 8,  encre: 'rgb(105,130,215)', attendu: 'trait' },
  { nom: 'ombre-forte',      largeur: 1400, hauteur: 700,  ombre: 1.0, jaunissement: 12, epaisseur: 7,  bruit: 10, attendu: 'trait' },
  { nom: 'trait-tres-fin',   largeur: 1400, hauteur: 700,  ombre: 0.5, jaunissement: 8,  epaisseur: 2,  bruit: 8,  attendu: 'trait' },
  { nom: 'papier-regle',     largeur: 1400, hauteur: 700,  ombre: 0.4, jaunissement: 6,  epaisseur: 7,  bruit: 8,  lignes: true, attendu: 'trait' },
  { nom: 'document-texte',   largeur: 1400, hauteur: 700,  ombre: 0.4, jaunissement: 6,  epaisseur: 7,  bruit: 8,  texte: true, attendu: 'trait' },
  { nom: 'tres-bruitee',     largeur: 1000, hauteur: 500,  ombre: 0.6, jaunissement: 14, epaisseur: 5,  bruit: 60, attendu: 'trait' },
  { nom: 'telephone-3200',   largeur: 3200, hauteur: 1600, ombre: 0.5, jaunissement: 8,  epaisseur: 14, bruit: 8,  attendu: 'trait' },
  { nom: 'page-vierge',      largeur: 1400, hauteur: 700,  ombre: 0.4, jaunissement: 6,  epaisseur: 7,  bruit: 8,  sansTrait: true, attendu: 'refus' },
]

;(async () => {
  const paquet = await build({
    entryPoints: ['src/lib/signature/extraction.ts'],
    bundle: true, write: false, format: 'iife', globalName: 'Extraction', target: 'chrome120',
  })

  const navigateur = await chromium.launch({
    executablePath: require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })
  const p = await navigateur.newPage({ viewport: { width: 1200, height: 800 } })
  await p.setContent('<body style="margin:0;background:#fff"></body>')
  await p.addScriptTag({ content: paquet.outputFiles[0].text })

  console.log('Extraction de signature — dix situations réelles\n')
  let echecs = 0

  for (const cas of CAS) {
    const r = await p.evaluate(async ({ fabriquer, cas }) => {
      const photo = eval(fabriquer)(cas)
      const t0 = performance.now()
      try {
        const res = await window.Extraction.extraireSignature(photo)
        const ms = Math.round(performance.now() - t0)
        const img = new Image()
        await new Promise((ok) => { img.onload = ok; img.src = res.apercu })
        const c = document.createElement('canvas')
        c.width = img.width; c.height = img.height
        c.getContext('2d').drawImage(img, 0, 0)
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
        let opaques = 0, doux = 0
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] === 0) continue
          if (d[i] > 230) opaques++; else doux++
        }
        return { issue: 'trait', ms, largeur: res.largeur, hauteur: res.hauteur,
                 douxPct: Math.round((doux / (opaques + doux)) * 100),
                 diagnostic: res.diagnostic, apercu: res.apercu, photo }
      } catch (e) {
        return { issue: 'refus', nom: e.name, message: String(e.message || e), photo }
      }
    }, { fabriquer: FABRIQUER, cas })

    const conforme = r.issue === cas.attendu
    if (!conforme) echecs++

    const marque = conforme ? '✓' : '✗'
    if (r.issue === 'trait') {
      console.log(`  ${marque} ${cas.nom.padEnd(17)} ${r.largeur}×${r.hauteur} · bords doux ${r.douxPct}% · ` +
        `encre ${r.diagnostic.encre}${r.diagnostic.lignesRetirees ? ' · lignes retirées' : ''} · ${r.ms} ms`)
      fs.writeFileSync(`${SC}/sig-${cas.nom}.png`, Buffer.from(r.apercu.split(',')[1], 'base64'))
    } else {
      console.log(`  ${marque} ${cas.nom.padEnd(17)} refusé (${r.nom}) — ${r.message.slice(0, 62)}…`)
    }
    fs.writeFileSync(`${SC}/src-${cas.nom}.jpg`, Buffer.from(r.photo.split(',')[1], 'base64'))
  }

  console.log(echecs === 0
    ? '\n✓ Les dix situations donnent l’issue attendue.'
    : `\n✗ ${echecs} situation(s) hors attendu.`)

  await navigateur.close()
  process.exit(echecs === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
