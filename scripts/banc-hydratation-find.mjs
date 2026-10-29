/** Diagnostic navigateur Find, sans mutation ni clé serveur; les hôtes externes sont bloqués. */
import { chromium } from 'playwright-core'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const origine = process.env.REVUE_URL || 'http://127.0.0.1:3000'
if (!['127.0.0.1', 'localhost'].includes(new URL(origine).hostname)) throw new Error('Serveur local requis')
const repetitions = Number(process.env.REVUE_REPETITIONS || 40)
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 200) throw new Error('1 à 200 répétitions attendues')
const lent = process.env.REVUE_RESEAU_LENT === '1'
const largeurs = (process.env.REVUE_LARGEURS || '320,375,768,1440').split(',').map(Number)
if (!largeurs.length || largeurs.some((largeur) => ![320, 360, 375, 414, 768, 1024, 1440].includes(largeur))) {
  throw new Error('Largeurs autorisées : 320, 360, 375, 414, 768, 1024, 1440')
}
const dossier = path.join(os.homedir(), '.local/share/sikaloc-demo-local/revue-ux', `${new Date().toISOString().replaceAll(':', '-')}-hydratation`)
await mkdir(dossier, { recursive: true, mode: 0o700 })
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
const resultats = []
try {
  for (let essai = 1; essai <= repetitions; essai++) {
    const largeur = largeurs[(essai - 1) % largeurs.length]
    const contexte = await browser.newContext({
      viewport: { width: largeur, height: 900 },
      locale: 'fr-FR',
      timezoneId: 'Africa/Porto-Novo',
      colorScheme: 'light',
    })
    const page = await contexte.newPage()
    const erreurs = []
    const erreursConsole = []
    const requetesEchouees = []
    const hotesExternes = []
    page.on('pageerror', (e) => erreurs.push({ message: e.message, pile: e.stack?.split('\n').slice(0, 16) ?? [] }))
    page.on('console', (message) => {
      if (message.type() === 'error' && /react|hydration|hydratation|418/i.test(message.text())) {
        erreursConsole.push(message.text())
      }
    })
    page.on('requestfailed', (request) => {
      const url = new URL(request.url())
      requetesEchouees.push({ methode: request.method(), chemin: url.pathname, erreur: request.failure()?.errorText })
    })
    await contexte.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
        hotesExternes.push(url.hostname || url.protocol)
        await route.abort()
        return
      }
      await route.continue()
    })
    if (lent) {
      const cdp = await contexte.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 512 * 1024, uploadThroughput: 256 * 1024 })
    }
    try {
      const reponse = await page.goto(`${origine}/find`, { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForTimeout(350)
      resultats.push({
        essai,
        largeur,
        statut: reponse.status(),
        titre: await page.locator('h1').textContent(),
        erreurs,
        erreursConsole,
        requetesEchouees,
        hôtesExternesBloqués: [...new Set(hotesExternes)],
      })
    } catch (e) {
      resultats.push({ essai, largeur, erreurs: [...erreurs, { message: e.message, pile: e.stack?.split('\n').slice(0, 16) ?? [] }], erreursConsole, requetesEchouees, hôtesExternesBloqués: [...new Set(hotesExternes)] })
    }
    await writeFile(path.join(dossier, 'manifest.json'), JSON.stringify({ lent, largeurs, resultats }, null, 2), { mode: 0o600 })
    await contexte.close()
    if (essai % 10 === 0) console.log(`${essai} chargements; ${resultats.filter(r => r.erreurs.length || r.erreursConsole.length).length} échecs`)
  }
} finally { await browser.close() }
console.log(`Preuves : ${dossier}`)
if (resultats.some(r => r.erreurs.length || r.erreursConsole.length || r.statut !== 200 || r.hôtesExternesBloqués.length)) process.exitCode = 1
