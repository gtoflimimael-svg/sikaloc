/**
 * Banc d'essai du détourage de signature.
 *
 * Compile le VRAI module `src/lib/signature/scan.ts` pour le navigateur, puis
 * lui soumet des photos synthétiques représentatives de ce qu'un bailleur
 * produit avec son téléphone : papier légèrement jauni, éclairage inégal,
 * compression JPEG, trait au stylo bille.
 *
 * Le but n'est pas de juger sur une image parfaite — l'algorithme s'en sortirait
 * toujours — mais sur les conditions réelles où il est censé travailler.
 */
const { build } = require('esbuild')
const { chromium } = require('playwright-core')
const fs = require('fs')

const SC = '/tmp/claude-1000/-home-ma-l-toflimi-gbinlo-Bureau-New-project-Projet-Sika-MVP-Sika/7a1fea1d-ab94-4997-95b5-1dfed7f8b936/scratchpad'

/** Dessine une photo de signature plausible et la rend en data URI JPEG. */
const FABRIQUER_PHOTO = `
(function fabriquer({ largeur, hauteur, inclinaisonOmbre, jaunissement, epaisseurTrait, bruit }) {
  const c = document.createElement('canvas')
  c.width = largeur; c.height = hauteur
  const x = c.getContext('2d')

  // Papier : blanc cassé, légèrement jauni
  x.fillStyle = 'rgb(' + (252 - jaunissement) + ',' + (250 - jaunissement) + ',' + (242 - jaunissement * 2) + ')'
  x.fillRect(0, 0, largeur, hauteur)

  // Ombre en diagonale — le défaut nº1 d'une photo prise à la main
  const g = x.createLinearGradient(0, 0, largeur * inclinaisonOmbre, hauteur)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.28)')
  x.fillStyle = g
  x.fillRect(0, 0, largeur, hauteur)

  // Le trait : une signature cursive, encre bleu-noir
  x.strokeStyle = 'rgb(28,32,64)'
  x.lineWidth = epaisseurTrait
  x.lineCap = 'round'
  x.lineJoin = 'round'
  x.beginPath()
  const bx = largeur * 0.18, by = hauteur * 0.58
  x.moveTo(bx, by)
  x.bezierCurveTo(bx + largeur*0.06, by - hauteur*0.30, bx + largeur*0.12, by + hauteur*0.18, bx + largeur*0.17, by - hauteur*0.05)
  x.bezierCurveTo(bx + largeur*0.22, by - hauteur*0.26, bx + largeur*0.27, by + hauteur*0.14, bx + largeur*0.33, by - hauteur*0.02)
  x.bezierCurveTo(bx + largeur*0.39, by - hauteur*0.20, bx + largeur*0.46, by + hauteur*0.10, bx + largeur*0.54, by - hauteur*0.08)
  x.stroke()

  // Le paraphe final, plus fin — c'est lui qui disparaît quand le seuillage est trop dur
  x.lineWidth = Math.max(1, epaisseurTrait * 0.45)
  x.beginPath()
  x.moveTo(bx + largeur*0.54, by - hauteur*0.08)
  x.bezierCurveTo(bx + largeur*0.60, by + hauteur*0.06, bx + largeur*0.50, by + hauteur*0.12, bx + largeur*0.62, by + hauteur*0.04)
  x.stroke()

  // Grain du capteur
  const img = x.getImageData(0, 0, largeur, hauteur)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * bruit
    img.data[i] += n; img.data[i+1] += n; img.data[i+2] += n
  }
  x.putImageData(img, 0, 0)

  return c.toDataURL('image/jpeg', 0.82)
})
`

;(async () => {
  // 1. Compiler le vrai module pour le navigateur
  const bundle = await build({
    entryPoints: ['src/lib/signature/scan.ts'],
    bundle: true, write: false, format: 'iife', globalName: 'Scan', target: 'chrome120',
  })
  const code = bundle.outputFiles[0].text

  const navigateur = await chromium.launch({
    executablePath: require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })
  const p = await navigateur.newPage({ viewport: { width: 1400, height: 900 } })
  await p.setContent('<body style="margin:0;background:#fff"></body>')
  await p.addScriptTag({ content: code })

  const CAS = [
    { nom: 'telephone-3200',   largeur: 3200, hauteur: 1600, inclinaisonOmbre: 0.5, jaunissement: 8, epaisseurTrait: 14, bruit: 8 },
    { nom: 'photo-nette',      largeur: 1400, hauteur: 700, inclinaisonOmbre: 0.3, jaunissement: 4,  epaisseurTrait: 7, bruit: 6 },
    { nom: 'ombre-marquee',    largeur: 1400, hauteur: 700, inclinaisonOmbre: 1.0, jaunissement: 12, epaisseurTrait: 7, bruit: 10 },
    { nom: 'trait-fin',        largeur: 1400, hauteur: 700, inclinaisonOmbre: 0.5, jaunissement: 8,  epaisseurTrait: 3, bruit: 8 },
    { nom: 'photo-de-loin',    largeur: 700,  hauteur: 350, inclinaisonOmbre: 0.6, jaunissement: 10, epaisseurTrait: 3, bruit: 12 },
  ]

  console.log('Détourage — algorithme actuel\n')

  for (const cas of CAS) {
    const r = await p.evaluate(async ({ fabriquer, cas }) => {
      const photo = eval(fabriquer)(cas)
      const t0 = performance.now()
      try {
        const res = await window.Scan.detourerSignature(photo)
        const ms = Math.round(performance.now() - t0)

        // Mesures de qualité sur le résultat
        const img = new Image()
        await new Promise((ok) => { img.onload = ok; img.src = res.apercu })
        const c = document.createElement('canvas')
        c.width = img.width; c.height = img.height
        const x = c.getContext('2d')
        x.drawImage(img, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height).data

        let opaques = 0, semi = 0, faibles = 0
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] === 0) continue
          if (d[i] > 230) opaques++
          else if (d[i] > 90) semi++
          else faibles++
        }
        const total = opaques + semi + faibles
        return {
          ok: true, ms,
          largeur: res.largeur, hauteur: res.hauteur,
          encrePct: ((total / (c.width * c.height)) * 100).toFixed(1),
          opaquesPct: ((opaques / total) * 100).toFixed(0),
          semiPct: ((semi / total) * 100).toFixed(0),
          faiblesPct: ((faibles / total) * 100).toFixed(0),
          apercu: res.apercu,
          photo,
        }
      } catch (e) {
        return { ok: false, message: String(e && e.message || e) }
      }
    }, { fabriquer: FABRIQUER_PHOTO, cas })

    if (!r.ok) { console.log('  ' + cas.nom.padEnd(16) + '✗ ' + r.message); continue }

    console.log('  ' + cas.nom.padEnd(16) +
      r.largeur + '×' + r.hauteur + ' · encre ' + r.encrePct + '% · ' +
      'opaque ' + r.opaquesPct + '% / semi ' + r.semiPct + '% / faible ' + r.faiblesPct + '% · ' + r.ms + ' ms')

    fs.writeFileSync(SC + '/scan-' + cas.nom + '-source.jpg', Buffer.from(r.photo.split(',')[1], 'base64'))
    fs.writeFileSync(SC + '/scan-' + cas.nom + '-resultat.png', Buffer.from(r.apercu.split(',')[1], 'base64'))
  }

  console.log('\n  images écrites dans le dossier de travail')
  await navigateur.close()
})().catch((e) => { console.error(e); process.exit(1) })
