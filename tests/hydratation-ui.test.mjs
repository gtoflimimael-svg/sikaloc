import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright-core'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const origine = process.env.HYDRATION_TEST_URL
if (!origine || !['127.0.0.1', 'localhost'].includes(new URL(origine).hostname)) {
  throw new Error('HYDRATION_TEST_URL doit désigner explicitement un serveur local de revue')
}

async function verifierAssociations(route) {
  const navigateur = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
  const contexte = await navigateur.newContext({
    viewport: { width: 320, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Africa/Porto-Novo',
    colorScheme: 'light',
  })
  const page = await contexte.newPage()

  try {
    for (let essai = 1; essai <= 12; essai++) {
      const erreurs = []
      const relever = (erreur) => erreurs.push({
        message: erreur.message,
        pile: erreur.stack?.split('\n').slice(0, 12) ?? [],
      })
      page.on('pageerror', relever)

      const reponse = await page.goto(new URL(route, origine).href, { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForTimeout(100)
      const associations = await page.evaluate(() => {
        const identifiants = [...document.querySelectorAll('[id]')].map((element) => element.id)
        const references = [...document.querySelectorAll('[aria-controls], label[for]')]
        return {
          doublons: identifiants.filter((id, index) => identifiants.indexOf(id) !== index),
          referencesManquantes: references.flatMap((element) => {
            const ids = [element.getAttribute('aria-controls'), element.getAttribute('for')].filter(Boolean)
            return ids.filter((id) => !document.getElementById(id)).map((id) => `${element.tagName} → #${id}`)
          }),
          faq: [...document.querySelectorAll('.home-faq-question')].map((bouton) => ({
            id: bouton.id,
            panneau: bouton.getAttribute('aria-controls'),
            etiqueteePar: document.getElementById(bouton.getAttribute('aria-controls'))?.getAttribute('aria-labelledby'),
          })),
          filtres: [...document.querySelectorAll('button[aria-controls="find-filtres-avances"]')].map((bouton) => ({
            panneau: bouton.getAttribute('aria-controls'),
            present: Boolean(document.getElementById('find-filtres-avances')),
          })),
        }
      })

      page.off('pageerror', relever)
      assert.equal(reponse.status(), 200, `${route}, essai ${essai}: statut HTTP`)
      assert.deepEqual(associations.doublons, [], `${route}, essai ${essai}: identifiants dupliqués`)
      assert.deepEqual(associations.referencesManquantes, [], `${route}, essai ${essai}: association de contrôle absente`)
      if (route === '/') {
        assert.ok(associations.faq.length > 0, `/, essai ${essai}: FAQ absente`)
        assert.ok(associations.faq.every((faq) => faq.id && faq.etiqueteePar === faq.id), `/, essai ${essai}: FAQ mal associée`)
      } else {
        assert.ok(associations.filtres.length > 0, `/find, essai ${essai}: commande des filtres absente`)
        assert.ok(associations.filtres.every((filtre) => filtre.present), `/find, essai ${essai}: panneau avancé absent`)
      }
      assert.ok(!erreurs.some(({ message }) => /418|parentNode/i.test(message)), `${route}, essai ${essai}: ${JSON.stringify(erreurs)}`)
    }
  } finally {
    await contexte.close()
    await navigateur.close()
  }
}

test('les identifiants et la FAQ de l’accueil restent stables sur 12 chargements', () => verifierAssociations('/'))
test('les identifiants et filtres Find restent stables sur 12 chargements', () => verifierAssociations('/find'))

test('les quatre routes publiques historiquement touchées restent stables sur 30 accès directs', async () => {
  const navigateur = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
  const routes = ['/pro?presentation=1', '/find', '/find/23875frvc7/candidater', '/connexion']
  const regressions = []
  try {
    for (const route of routes) {
      for (let essai = 1; essai <= 30; essai++) {
        const contexte = await navigateur.newContext({
          viewport: { width: 375, height: 900 },
          locale: 'fr-FR',
          timezoneId: 'Africa/Porto-Novo',
          colorScheme: 'light',
        })
        const page = await contexte.newPage()
        const erreurs = []
        page.on('request', (requete) => {
          if (!['127.0.0.1', 'localhost'].includes(new URL(requete.url()).hostname)) {
            void requete.abort().catch(() => {})
          }
        })
        page.on('pageerror', (erreur) => erreurs.push({
          message: erreur.message,
          pile: erreur.stack?.split('\n').slice(0, 10) ?? [],
        }))
        try {
          const reponse = await page.goto(new URL(route, origine).href, { waitUntil: 'networkidle', timeout: 45000 })
          await page.waitForTimeout(120)
          if (reponse.status() !== 200 || erreurs.some(({ message }) => /418|parentNode/i.test(message))) {
            regressions.push({ route, essai, statut: reponse.status(), erreurs })
          }
        } finally {
          await contexte.close()
        }
      }
    }
  } finally {
    await navigateur.close()
  }
  assert.deepEqual(regressions, [], `${regressions.length} anomalies sur les accès publics : ${JSON.stringify(regressions)}`)
})

test('le menu public mobile ouvre, piège et rend le focus sans bloquer le défilement', async () => {
  const navigateur = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
  const contexte = await navigateur.newContext({
    viewport: { width: 320, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Africa/Porto-Novo',
    colorScheme: 'light',
  })
  const page = await contexte.newPage()

  try {
    await page.goto(new URL('/pro?presentation=1', origine).href, { waitUntil: 'networkidle', timeout: 45000 })
    const declencheur = page.getByRole('button', { name: 'Ouvrir le menu' })
    const idPanneau = await declencheur.getAttribute('aria-controls')
    assert.ok(idPanneau, 'le bouton doit référencer son panneau monté')
    assert.equal(await page.locator(`#${idPanneau}`).count(), 1, 'aria-controls doit viser un dialogue unique même fermé')
    await declencheur.click()
    const panneau = page.getByRole('dialog', { name: 'Menu' })
    assert.equal(await panneau.isVisible(), true, 'le tiroir mobile doit s’ouvrir')
    assert.equal(await declencheur.getAttribute('aria-expanded'), 'true')
    assert.equal(await panneau.evaluate((element) => document.activeElement === element), true, 'le focus doit entrer dans le tiroir')
    assert.equal(await page.locator('body').evaluate((element) => getComputedStyle(element).overflow), 'hidden')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(30)
    assert.equal(await panneau.isVisible(), false, 'Échap doit fermer le tiroir')
    assert.equal(await declencheur.getAttribute('aria-expanded'), 'false')
    assert.equal(await declencheur.evaluate((element) => document.activeElement === element), true, 'Échap doit rendre le focus au bouton')
    assert.notEqual(await page.locator('body').evaluate((element) => getComputedStyle(element).overflow), 'hidden')
  } finally {
    await contexte.close()
    await navigateur.close()
  }
})

test('les transitions Pro, Me et Find restent sans React 418 ni parentNode sur le Demo local', {
  skip: process.env.HYDRATION_TEST_AUTH !== '1' ? 'activer explicitement avec HYDRATION_TEST_AUTH=1' : false,
}, async () => {
  const demo = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'), 'sikaloc-demo-local')
  const marqueur = JSON.parse(await readFile(path.join(demo, 'instance.json'), 'utf8'))
  assert.match(marqueur.projectId, /^sikaloc-demo-[a-f0-9]{12}$/)
  assert.equal(marqueur.schemaState, 'ready')
  const pile = spawnSync(path.resolve('node_modules/.bin/supabase'), ['status', '--output', 'env', '--workdir', demo], { encoding: 'utf8' })
  assert.equal(pile.status, 0, 'la pile Demo locale doit être active')
  const api = pile.stdout.match(/^API_URL="?([^"\n]+)"?$/m)?.[1]
  assert.ok(api, 'URL de la pile Demo absente')
  const urlApi = new URL(api)
  assert.ok(['127.0.0.1', 'localhost'].includes(urlApi.hostname) && urlApi.port === '54821', 'la base doit être la pile Demo locale')
  const secrets = JSON.parse(await readFile(path.join(demo, 'secrets.json'), 'utf8'))

  const navigateur = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
  const largeur = Number(process.env.HYDRATION_TEST_WIDTH || 375)
  const regressions = []
  try {
    for (const role of ['pro', 'me', 'find']) {
      const compte = secrets.comptes?.[role]
      assert.ok(compte?.email?.endsWith('@sikaloc-demo.test') && compte.motDePasse, `compte Demo ${role} absent`)
      const contexte = await navigateur.newContext({
        viewport: { width: largeur, height: 900 },
        locale: 'fr-FR',
        timezoneId: 'Africa/Porto-Novo',
        colorScheme: 'light',
      })
      const page = await contexte.newPage()
      try {
        await page.goto(new URL('/connexion', origine).href, { waitUntil: 'networkidle', timeout: 45000 })
        await page.locator('[name=email]').fill(compte.email)
        await page.locator('[name=motDePasse]').fill(compte.motDePasse)
        await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
        await page.waitForURL((url) => !url.pathname.startsWith('/connexion'), { timeout: 25000 })
        if (role === 'find') await page.waitForTimeout(3000)

        const routes = role === 'pro'
          ? ['/pro/paiements?statut=Brouillon', '/pro/paiements', '/pro/paiements?statut=Valid%C3%A9', '/pro/tableau-de-bord', '/pro/logements']
          : role === 'me'
            ? ['/me', '/me/bail', '/me/preferences', '/me/paiements', '/me/candidatures']
            : ['/find']
        for (const route of routes) {
          const repetitions = role === 'find' ? 30 : 6
          for (let essai = 1; essai <= repetitions; essai++) {
            const erreurs = []
            const tracesReact = []
            const relever = (erreur) => erreurs.push({
              message: erreur.message,
              pile: erreur.stack?.split('\n').slice(0, 12) ?? [],
            })
            const releverTrace = (message) => {
              if (/418|hydration|hydratation|parentNode/i.test(message.text())) {
                tracesReact.push({ type: message.type(), texte: message.text().slice(0, 1200) })
              }
            }
            page.on('pageerror', relever)
            page.on('console', releverTrace)
            const reponse = await page.goto(new URL(route, origine).href, { waitUntil: 'networkidle', timeout: 45000 })
            await page.waitForTimeout(120)
            page.off('pageerror', relever)
            page.off('console', releverTrace)
            if (reponse.status() !== 200) regressions.push({ role, route, essai, status: reponse.status() })
            const symptome = erreurs.find(({ message }) => /418|parentNode/i.test(message))
            if (symptome || tracesReact.some((trace) => trace.type === 'error')) {
              regressions.push({ role, route, essai, symptome: symptome?.message ?? null, pile: symptome?.pile ?? [], tracesReact })
            }
          }
        }
      } finally {
        await contexte.close()
      }
    }
  } finally {
    await navigateur.close()
  }
  assert.deepEqual(regressions, [], `${regressions.length} anomalies d’hydratation : ${JSON.stringify(regressions)}`)
})

test('30 accès directs à Find après authentification candidat fraîche restent stables', {
  skip: process.env.HYDRATION_TEST_AUTH !== '1' ? 'activer explicitement avec HYDRATION_TEST_AUTH=1' : false,
}, async () => {
  const demo = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'), 'sikaloc-demo-local')
  const marqueur = JSON.parse(await readFile(path.join(demo, 'instance.json'), 'utf8'))
  assert.match(marqueur.projectId, /^sikaloc-demo-[a-f0-9]{12}$/)
  assert.equal(marqueur.schemaState, 'ready')
  const pile = spawnSync(path.resolve('node_modules/.bin/supabase'), ['status', '--output', 'env', '--workdir', demo], { encoding: 'utf8' })
  assert.equal(pile.status, 0, 'la pile Demo locale doit être active')
  const api = pile.stdout.match(/^API_URL="?([^"\n]+)"?$/m)?.[1]
  assert.ok(api, 'URL de la pile Demo absente')
  const urlApi = new URL(api)
  assert.ok(['127.0.0.1', 'localhost'].includes(urlApi.hostname) && urlApi.port === '54821', 'la base doit être la pile Demo locale')
  const compte = JSON.parse(await readFile(path.join(demo, 'secrets.json'), 'utf8')).comptes?.find
  assert.ok(compte?.email?.endsWith('@sikaloc-demo.test') && compte.motDePasse, 'compte candidat Demo absent')

  const navigateur = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
  const resultats = []
  try {
    for (let essai = 1; essai <= 30; essai++) {
      const contexte = await navigateur.newContext({
        viewport: { width: Number(process.env.HYDRATION_TEST_WIDTH || 375), height: 900 },
        locale: 'fr-FR',
        timezoneId: 'Africa/Porto-Novo',
        colorScheme: 'light',
      })
      const page = await contexte.newPage()
      const erreurs = []
      let etape = 'connexion'
      page.on('pageerror', (erreur) => erreurs.push({
        etape,
        route: new URL(page.url()).pathname,
        message: erreur.message,
        pile: erreur.stack?.split('\n').slice(0, 12) ?? [],
      }))
      try {
        await page.goto(new URL('/connexion', origine).href, { waitUntil: 'networkidle', timeout: 45000 })
        await page.locator('[name=email]').fill(compte.email)
        await page.locator('[name=motDePasse]').fill(compte.motDePasse)
        await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
        await page.waitForURL((url) => url.pathname === '/me/candidatures', { timeout: 25000 })
        await page.waitForTimeout(3000)
        etape = 'find-direct'
        const reponse = await page.goto(new URL('/find', origine).href, { waitUntil: 'networkidle', timeout: 45000 })
        await page.waitForTimeout(120)
        resultats.push({ essai, statut: reponse.status(), route: new URL(page.url()).pathname, erreurs })
      } finally {
        await contexte.close()
      }
    }
  } finally {
    await navigateur.close()
  }
  const defauts = resultats.filter(({ statut, route, erreurs }) =>
    statut !== 200 || route !== '/find' || erreurs.some(({ message }) => /418|parentNode/i.test(message)),
  )
  assert.equal(resultats.length, 30, '30 connexions fraîches suivies d’un accès direct sont requises')
  assert.deepEqual(defauts, [], `${defauts.length} anomalies sur Find candidat direct : ${JSON.stringify(defauts)}`)
})

test('30 navigations candidat par « Voir les logements » gardent Find stable', {
  skip: process.env.HYDRATION_TEST_AUTH !== '1' ? 'activer explicitement avec HYDRATION_TEST_AUTH=1' : false,
}, async () => {
  const demo = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'), 'sikaloc-demo-local')
  const marqueur = JSON.parse(await readFile(path.join(demo, 'instance.json'), 'utf8'))
  assert.match(marqueur.projectId, /^sikaloc-demo-[a-f0-9]{12}$/)
  assert.equal(marqueur.schemaState, 'ready')
  const pile = spawnSync(path.resolve('node_modules/.bin/supabase'), ['status', '--output', 'env', '--workdir', demo], { encoding: 'utf8' })
  assert.equal(pile.status, 0, 'la pile Demo locale doit être active')
  const api = pile.stdout.match(/^API_URL="?([^"\n]+)"?$/m)?.[1]
  assert.ok(api, 'URL de la pile Demo absente')
  const urlApi = new URL(api)
  assert.ok(['127.0.0.1', 'localhost'].includes(urlApi.hostname) && urlApi.port === '54821', 'la base doit être la pile Demo locale')
  const secrets = JSON.parse(await readFile(path.join(demo, 'secrets.json'), 'utf8'))
  const compte = secrets.comptes?.find
  assert.ok(compte?.email?.endsWith('@sikaloc-demo.test') && compte.motDePasse, 'compte candidat Demo absent')

  const navigateur = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
  const erreurs = []
  try {
    for (let essai = 1; essai <= 30; essai++) {
      const contexte = await navigateur.newContext({
        viewport: { width: Number(process.env.HYDRATION_TEST_WIDTH || 375), height: 900 },
        locale: 'fr-FR',
        timezoneId: 'Africa/Porto-Novo',
        colorScheme: 'light',
      })
      const page = await contexte.newPage()
      try {
        await page.goto(new URL('/connexion', origine).href, { waitUntil: 'networkidle', timeout: 45000 })
        await page.locator('[name=email]').fill(compte.email)
        await page.locator('[name=motDePasse]').fill(compte.motDePasse)
        await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
        await page.waitForURL((url) => !url.pathname.startsWith('/connexion'), { timeout: 25000 })
        await page.waitForURL((url) => url.pathname === '/me/candidatures', { timeout: 10000 })
        await page.waitForTimeout(3000)
        const erreursEssai = []
        page.on('pageerror', (erreur) => erreursEssai.push(erreur.message))
        await page.getByRole('link', { name: 'Voir les logements', exact: true }).click()
        await page.waitForURL((url) => url.pathname === '/find', { timeout: 15000 })
        await page.waitForTimeout(120)
        if (erreursEssai.some((message) => /418|parentNode/i.test(message))) {
          erreurs.push({ essai, route: '/find', pageerrors: erreursEssai })
        }
      } finally {
        await contexte.close()
      }
    }
  } finally {
    await navigateur.close()
  }
  assert.deepEqual(erreurs, [], `${erreurs.length} anomalies sur le lien Find candidat : ${JSON.stringify(erreurs)}`)
})
