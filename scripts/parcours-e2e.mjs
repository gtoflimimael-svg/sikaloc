/**
 * Parcours bailleur de bout en bout sur la vraie base.
 *   connexion → tableau de bord → impayés → saisie d'un paiement
 *   → confirmation → quittance générée
 */
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { chromium } from 'playwright-core'

const SORTIE = process.argv[2] ?? '.'
const BASE = process.env.SIKA_BASE_URL ?? 'http://localhost:3000'

/**
 * Playwright n'est pas installé avec ses navigateurs (playwright-core seul) :
 * on réutilise un Chromium déjà présent sur la machine plutôt que d'en
 * télécharger un seul pour ce script.
 */
function trouverNavigateur() {
  if (process.env.SIKA_CHROMIUM) return process.env.SIKA_CHROMIUM

  const cache = join(homedir(), '.cache', 'ms-playwright')
  if (existsSync(cache)) {
    for (const dossier of readdirSync(cache)) {
      for (const relatif of [
        join('chrome-linux64', 'chrome'),
        join('chrome-linux', 'chrome'),
        join('chrome-headless-shell-linux64', 'chrome-headless-shell'),
      ]) {
        const candidat = join(cache, dossier, relatif)
        if (existsSync(candidat)) return candidat
      }
    }
  }

  for (const systeme of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(systeme)) return systeme
  }

  throw new Error(
    'Aucun Chromium trouvé. Indiquez-en un via la variable SIKA_CHROMIUM.',
  )
}

const EXEC = trouverNavigateur()

const navigateur = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-gpu'],
})

const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await contexte.newPage()

const erreurs = []
page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') erreurs.push(`console: ${m.text()}`)
})

function etape(n, texte) {
  console.log(`\n[${n}] ${texte}`)
}

try {
  // ── 1. Connexion ──────────────────────────────────────────────────────────
  etape(1, 'Connexion avec demo@sikaloc.com')
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await page.fill('#email', 'demo@sikaloc.com')
  await page.fill('#motDePasse', 'demo1234')
  await page.click('button[type=submit]')
  await page.waitForURL('**/app**', { timeout: 30000 })
  console.log(`    → ${page.url()}`)

  // ── 2. Tableau de bord ────────────────────────────────────────────────────
  etape(2, 'Tableau de bord')
  await page.waitForLoadState('networkidle')
  const metriques = await page.$$eval('.card, [class*="rounded-xl"]', (n) =>
    n.slice(0, 8).map((e) => e.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60)),
  )
  console.log(`    métriques lues : ${metriques.filter(Boolean).slice(0, 4).join(' | ')}`)
  await page.screenshot({ path: `${SORTIE}/01-dashboard.png`, fullPage: false })

  // ── 3. Impayés ────────────────────────────────────────────────────────────
  etape(3, 'Écran des impayés')
  await page.goto(`${BASE}/app/impayes`, { waitUntil: 'networkidle' })
  const nbImpayes = await page.locator('text=Impayé').count()
  console.log(`    ${nbImpayes} badges « Impayé » affichés`)

  const lienWa = await page.locator('a[href^="https://wa.me/"]').first().getAttribute('href')
  console.log(`    lien WhatsApp : ${lienWa ? decodeURIComponent(lienWa).slice(0, 95) + '…' : 'ABSENT'}`)
  await page.screenshot({ path: `${SORTIE}/02-impayes.png`, fullPage: false })

  // ── 4. Saisie d'un paiement ───────────────────────────────────────────────
  etape(4, 'Saisie d’un paiement')
  await page.goto(`${BASE}/app/paiements/nouveau`, { waitUntil: 'networkidle' })

  // Bail de Pascal Dossou (35 000 FCFA), impayé sur plusieurs mois.
  const options = await page.$$eval('#bailId option', (o) =>
    o.map((e) => ({ value: e.value, label: e.textContent?.trim() })),
  )
  const pascal = options.find((o) => o.label?.includes('Pascal')) ?? options[0]
  await page.selectOption('#bailId', pascal.value)
  console.log(`    bail choisi : ${pascal.label}`)

  const periodes = await page.$$eval('#periodeDebut option', (o) =>
    o.map((e) => ({ value: e.value, label: e.textContent?.trim() })),
  )
  // Le mois le plus ancien en impayé pour ce bail.
  const cible = periodes.find((p) => p.label?.includes('juin')) ?? periodes[2]
  await page.selectOption('#periodeDebut', cible.value)
  console.log(`    période      : ${cible.label}`)

  const montant = await page.inputValue('#montant')
  console.log(`    montant pré-rempli : ${montant} (loyer du bail)`)

  await page.screenshot({ path: `${SORTIE}/03-saisie.png`, fullPage: false })
  await page.click('button[type=submit]')

  // ── 5. Confirmation ───────────────────────────────────────────────────────
  etape(5, 'Récapitulatif de confirmation')
  await page.waitForURL('**/confirmer', { timeout: 30000 })
  await page.waitForLoadState('networkidle')
  const recap = await page.locator('h1').first().textContent()
  const phrase = await page.locator('.card p').first().textContent()
  console.log(`    ${recap?.trim()}`)
  console.log(`    « ${phrase?.replace(/\s+/g, ' ').trim().slice(0, 120)} »`)
  await page.screenshot({ path: `${SORTIE}/04-confirmation.png`, fullPage: false })

  // ── 6. Validation → génération de la quittance ────────────────────────────
  etape(6, 'Validation et génération du document')
  await page.click('button:has-text("Confirmer et générer")')
  await page.waitForURL('**/quittances/**', { timeout: 60000 })
  await page.waitForLoadState('networkidle')

  const titre = await page.locator('h1').first().textContent()
  // Numérotation v2.1 : AAAA-NNNN. Les documents émis avant la bascule
  // portent encore l'ancien format Q-…/R-…, tous deux acceptés ici.
  const numero = await page
    .locator('text=/N° (\\d{4}-\\d{4}|[QR]-)/')
    .first()
    .textContent()
  console.log(`    ${titre?.trim()}`)
  console.log(`    ${numero?.replace(/\s+/g, ' ').trim()}`)

  const lienEnvoi = await page
    .locator('a:has-text("Envoyer au locataire")')
    .first()
    .getAttribute('href')
    .catch(() => null)
  console.log(`    envoi WhatsApp : ${lienEnvoi ? 'lien signé présent' : 'ABSENT'}`)

  await page.screenshot({ path: `${SORTIE}/05-quittance.png`, fullPage: true })

  // ── 7. Téléchargement du PDF ──────────────────────────────────────────────
  etape(7, 'Téléchargement du PDF')
  const url = page.url()
  const idQuittance = url.split('/').pop()
  const reponse = await page.request.get(`${BASE}/api/quittances/${idQuittance}/pdf`)
  const octets = (await reponse.body()).length
  console.log(`    HTTP ${reponse.status()} · ${reponse.headers()['content-type']} · ${(octets / 1024).toFixed(1)} Ko`)

  const { writeFileSync } = await import('node:fs')
  writeFileSync(`${SORTIE}/quittance-reelle.pdf`, await reponse.body())

  console.log(
    erreurs.length === 0
      ? '\n✓ Parcours complet sans erreur console.\n'
      : `\n⚠ ${erreurs.length} erreur(s) console :\n  ${erreurs.slice(0, 5).join('\n  ')}\n`,
  )
} catch (e) {
  console.error(`\n✗ ÉCHEC : ${e.message}`)
  await page.screenshot({ path: `${SORTIE}/echec.png` }).catch(() => {})
  if (erreurs.length) console.error(`  erreurs console :\n  ${erreurs.slice(0, 5).join('\n  ')}`)
  process.exitCode = 1
} finally {
  await navigateur.close()
}
