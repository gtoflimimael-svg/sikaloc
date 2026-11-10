import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright-core'

const origine = process.env.HYDRATION_TEST_URL
if (!origine || !['127.0.0.1', 'localhost'].includes(new URL(origine).hostname)) {
  throw new Error('HYDRATION_TEST_URL doit désigner explicitement un serveur local de revue')
}

test('accueil sans liens Find, associations ARIA cohérentes et pas d’identifiants dupliqués', async () => {
  const navigateur = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
  const contexte = await navigateur.newContext({ viewport: { width: 375, height: 900 }, locale: 'fr-FR' })
  const page = await contexte.newPage()
  try {
    const reponse = await page.goto(new URL('/', origine).href, { waitUntil: 'networkidle', timeout: 45000 })
    assert.equal(reponse.status(), 200)
    const etat = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((element) => element.id)
      const controles = [...document.querySelectorAll('[aria-controls], label[for]')]
      return {
        doublons: ids.filter((id, index) => ids.indexOf(id) !== index),
        absents: controles.flatMap((element) => [element.getAttribute('aria-controls'), element.getAttribute('for')]
          .filter(Boolean).filter((id) => !document.getElementById(id))),
        routesArchivees: [...document.querySelectorAll('a[href]')]
          .map((lien) => lien.getAttribute('href'))
          .filter((href) => /^\/(find|pro\/annonces|me\/candidatures)(\/|$)/.test(href ?? '')),
      }
    })
    assert.deepEqual(etat.doublons, [])
    assert.deepEqual(etat.absents, [])
    assert.deepEqual(etat.routesArchivees, [])
  } finally {
    await contexte.close()
    await navigateur.close()
  }
})

test('les anciennes routes Find répondent en 404 sans redirection', async () => {
  const navigateur = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
  const page = await navigateur.newPage()
  try {
    for (const chemin of ['/find', '/find/ancienne-reference', '/pro/annonces', '/me/candidatures']) {
      const reponse = await page.goto(new URL(chemin, origine).href, { waitUntil: 'networkidle', timeout: 45000 })
      assert.equal(reponse.status(), 404, `${chemin} doit être inaccessible sans redirection`)
      assert.equal(new URL(page.url()).pathname, chemin)
    }
  } finally {
    await navigateur.close()
  }
})
