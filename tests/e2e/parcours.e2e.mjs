// Tests de bout en bout (QA-01, FN-01) : navigateur réel contre l'application
// en mode production, sur une pile Supabase locale jetable.
// Lancer via `npm run test:e2e` (scripts/e2e/lancer.mjs), jamais directement.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, test } from 'node:test'

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright-core'

import { demarrerFauxFedaPay, signerWebhook } from '../../scripts/e2e/faux-fedapay.mjs'

const BASE = process.env.E2E_BASE
const C = JSON.parse(readFileSync(process.env.E2E_COMPTES, 'utf8'))
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const CHROME = process.env.E2E_CHROME ?? '/usr/bin/google-chrome'

let navigateur
before(async () => { navigateur = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] }) })
after(async () => { await navigateur?.close() })

async function page({ largeur = 1366, hauteur = 900 } = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur } })
  const p = await contexte.newPage()
  p.erreurs = []
  await p.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => {
    console.error(`CSP ${e.violatedDirective} ${e.blockedURI || 'inline'}`)
  }))
  p.on('pageerror', (e) => p.erreurs.push(`pageerror ${e.message}`))
  p.on('console', (m) => { if (m.type() === 'error') p.erreurs.push(m.text()) })
  return p
}

async function connecter(p, compte) {
  await p.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await p.fill('input[type=email]', compte.email)
  await p.fill('input[type=password]', compte.motDePasse)
  await Promise.all([
    p.waitForURL((u) => !/^\/(connexion|entrer)$/.test(u.pathname), { timeout: 30_000 }),
    p.click('button[type=submit]'),
  ])
  await p.waitForLoadState('networkidle')
}

async function visiter(p, chemin) {
  const reponse = await p.goto(BASE + chemin, { waitUntil: 'networkidle' })
  const h1 = await p.locator('h1').count()
  return { statut: reponse?.status(), fin: new URL(p.url()).pathname, h1 }
}

describe('Accès sans session', () => {
  test('les espaces protégés renvoient vers la connexion ; le PDF répond 401', async () => {
    const p = await page()
    for (const chemin of ['/pro/tableau-de-bord', '/pro/paiements', '/me', '/me/paiements']) {
      assert.equal((await visiter(p, chemin)).fin, '/connexion', chemin)
    }
    const pdf = await p.request.get(`${BASE}/api/quittances/00000000-0000-4000-8000-000000000000/pdf`, { maxRedirects: 0 })
    assert.equal(pdf.status(), 401)
    assert.deepEqual(p.erreurs, [])
    await p.context().close()
  })

  test('chaque page publique porte une CSP à nonce, sans unsafe-inline pour les scripts', async () => {
    for (const chemin of ['/', '/connexion', '/inscription', '/blog']) {
      const csp = (await fetch(BASE + chemin)).headers.get('content-security-policy') ?? ''
      const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) ?? ''
      assert.match(scriptSrc, /'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/, chemin)
      assert.doesNotMatch(scriptSrc, /unsafe-inline|unsafe-eval/, chemin)
    }
  })
})

describe('Bailleur (Pro)', () => {
  test('toutes les pages principales s’affichent, un seul h1, sans erreur ni violation CSP', async () => {
    const p = await page()
    await connecter(p, C.proA)
    assert.equal(new URL(p.url()).pathname, '/pro/tableau-de-bord')
    for (const chemin of ['/pro/tableau-de-bord', '/pro/logements', '/pro/locataires', '/pro/baux', `/pro/baux/${C.dossierA.bailId}`,
      '/pro/paiements', '/pro/paiements/nouveau', '/pro/impayes', '/pro/parametres', '/pro/parametres/profil',
      '/pro/parametres/abonnement', '/pro/parametres/signature', '/pro/parametres/donnees']) {
      const r = await visiter(p, chemin)
      assert.equal(r.statut, 200, chemin)
      assert.equal(r.fin, chemin, chemin)
      assert.equal(r.h1, 1, `${chemin} : ${r.h1} h1`)
    }
    assert.deepEqual(p.erreurs, [])
    await p.context().close()
  })

  test('isolation : le bail d’un autre bailleur est introuvable', async () => {
    const p = await page()
    await connecter(p, C.proA)
    const r = await visiter(p, `/pro/baux/${C.dossierB.bailId}`)
    assert.equal(r.statut, 404)
    const contenu = await p.locator('main').innerText()
    assert.equal(contenu.includes('Adresse E2E pro-b'), false)
    await p.context().close()
  })

  test('premier paiement : signature puis quittance en un clic, aperçu fidèle, PDF valide', async () => {
    const p = await page()
    await connecter(p, C.proA)
    await p.goto(`${BASE}/pro/paiements/nouveau`, { waitUntil: 'networkidle' })
    await p.selectOption('#bailId', C.dossierA.bailId)
    const periodes = await p.$$eval('#periodeDebut option', (o) => o.map((e) => e.value).filter(Boolean))
    await p.selectOption('#periodeDebut', periodes[1]) // mois courant (le premier est le mois d'avance)
    await p.fill('#montant', '100000')
    await p.click('button:has-text("Continuer vers la confirmation")')
    await p.waitForURL('**/confirmer', { timeout: 30_000 })
    await p.waitForLoadState('networkidle')
    const recapitulatif = (await p.locator('main').innerText()).replace(/\s+/g, ' ')
    assert.match(recapitulatif, /Document qui sera émis Quittance de loyer/)

    await p.click('button:has-text("Confirmer et générer le document")')
    await p.waitForURL('**/confirmer/signature**', { timeout: 30_000 })
    await p.waitForSelector('canvas')
    await p.waitForTimeout(500)
    const zone = await p.locator('canvas').first().boundingBox()
    await p.mouse.move(zone.x + 50, zone.y + zone.height * 0.6)
    await p.mouse.down()
    for (let i = 1; i <= 14; i++) await p.mouse.move(zone.x + 50 + i * 14, zone.y + zone.height * (0.6 - Math.sin(i / 2) * 0.25), { steps: 2 })
    await p.mouse.up()
    await p.click('button:has-text("Enregistrer et continuer")')

    // FN-04 : la quittance s'affiche sans second clic.
    await p.waitForURL('**/pro/quittances/**', { timeout: 60_000 })
    await p.waitForLoadState('networkidle')
    assert.equal((await p.locator('h1').first().textContent()).trim(), 'Quittance de loyer')
    const idQuittance = new URL(p.url()).pathname.split('/').pop()
    const pdf = await p.request.get(`${BASE}/api/quittances/${idQuittance}/pdf`)
    assert.equal(pdf.status(), 200)
    assert.equal((await pdf.body()).subarray(0, 5).toString(), '%PDF-')
    assert.deepEqual(p.erreurs, [])
    await p.context().close()
  })

  test('une saisie répétée reprend le même brouillon', async () => {
    const p = await page()
    await connecter(p, C.proA)
    for (const montant of ['30000', '45000']) {
      await p.goto(`${BASE}/pro/paiements/nouveau`, { waitUntil: 'networkidle' })
      await p.selectOption('#bailId', C.dossierA.bailId)
      const periodes = await p.$$eval('#periodeDebut option', (o) => o.map((e) => e.value).filter(Boolean))
      await p.selectOption('#periodeDebut', periodes[0])
      await p.fill('#montant', montant)
      await p.click('button:has-text("Continuer vers la confirmation")')
      await p.waitForURL('**/confirmer', { timeout: 30_000 })
    }
    const { data } = await admin.from('paiements').select('montant')
      .eq('bail_id', C.dossierA.bailId).eq('statut', 'Brouillon')
    assert.equal(data.length, 1)
    assert.equal(Number(data[0].montant), 45000)
    await p.context().close()
  })
})

describe('Locataire (Me)', () => {
  test('voit et télécharge sa quittance ; l’espace Pro lui est fermé', async () => {
    const p = await page({ largeur: 390, hauteur: 844 })
    await connecter(p, C.me)
    assert.equal(new URL(p.url()).pathname, '/me')
    for (const chemin of ['/me', '/me/bail', '/me/loyers', '/me/paiements', '/me/preferences']) {
      const r = await visiter(p, chemin)
      assert.equal(r.statut, 200, chemin)
      assert.equal(r.fin, chemin, chemin)
    }
    await p.goto(`${BASE}/me/paiements`, { waitUntil: 'networkidle' })
    const liens = await p.$$eval('a[href*="/api/quittances/"]', (as) => as.map((a) => a.getAttribute('href')))
    assert.ok(liens.length >= 1, 'aucun document visible côté locataire')
    const pdf = await p.request.get(BASE + liens[0])
    assert.equal(pdf.status(), 200)
    assert.equal((await visiter(p, '/pro/tableau-de-bord')).fin, '/me')
    assert.deepEqual(p.erreurs, [], 'erreurs console (dont hydratation)')
    await p.context().close()
  })
})

describe('Connexion', () => {
  test('cinq échecs, puis blocage temporaire', async () => {
    const p = await page()
    const email = `inconnu-${Date.now()}@sikaloc-e2e.test`
    const messages = []
    for (let i = 1; i <= 6; i++) {
      await p.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
      await p.fill('input[type=email]', email)
      await p.fill('input[type=password]', `mauvais-${i}`)
      await p.click('button[type=submit]')
      const alerte = p.locator('[role=alert]').filter({ hasText: /\S/ }).first()
      await alerte.waitFor({ timeout: 30_000 })
      messages.push((await alerte.textContent()).trim())
    }
    assert.deepEqual(new Set(messages.slice(0, 5)), new Set(['Email ou mot de passe incorrect.']))
    assert.match(messages[5], /^Trop de tentatives de connexion\. Réessayez dans \d+ minutes?\.$/)
    await p.context().close()
  })
})

describe('Abonnement FedaPay (service simulé)', () => {
  let fedapay
  before(async () => { fedapay = await demarrerFauxFedaPay(Number(process.env.E2E_FEDAPAY_PORT)) })
  after(async () => { await fedapay?.fermer() })

  const envoyer = (corps, signature) => fetch(`${BASE}/api/abonnement/fedapay`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-fedapay-signature': signature }, body: corps,
  })
  const etatBailleur = async () => (await admin.from('bailleurs').select('plan,date_fin_abonnement').eq('id', C.proA.id).single()).data

  test('paiement approuvé : un seul crédit, rejeux et fausses signatures sans effet', async () => {
    const p = await page()
    await connecter(p, C.proA)
    await p.goto(`${BASE}/pro/parametres/abonnement`, { waitUntil: 'networkidle' })
    assert.equal((await etatBailleur()).plan, 'Gratuit')
    await p.click('button:has-text("Payer par Mobile Money")')
    try {
      await p.waitForURL(/127\.0\.0\.1:\d+\/paiement\/\d+/, { timeout: 30_000 })
    } catch (erreur) {
      const alerte = await p.locator('[role=alert]').filter({ hasText: /\S/ }).first().textContent().catch(() => null)
      throw new Error(`redirection vers le paiement absente — écran : ${alerte ?? '(aucun message)'} — url : ${p.url()} — appels FedaPay : ${JSON.stringify(fedapay.appels)} — console : ${JSON.stringify(p.erreurs)}`, { cause: erreur })
    }
    const transactionId = new URL(p.url()).pathname.split('/').pop()
    const appelsApi = fedapay.appels.filter((a) => a.chemin.startsWith('/v1/'))
    assert.ok(appelsApi.length >= 2, 'création et jeton attendus')
    assert.ok(appelsApi.every((a) => a.autorisation), 'appel d’API FedaPay sans clé')

    // Webhook avant règlement : rien n'est crédité.
    const corps = JSON.stringify({ name: 'transaction.approved', entity: { id: Number(transactionId) } })
    let reponse = await envoyer(corps, signerWebhook(corps, process.env.FEDAPAY_WEBHOOK_SECRET))
    assert.equal(reponse.status, 200)
    assert.equal((await etatBailleur()).plan, 'Gratuit')

    // Signature fausse ou périmée : refus.
    assert.equal((await envoyer(corps, signerWebhook(corps, 'mauvais-secret'))).status, 401)
    assert.equal((await envoyer(corps, signerWebhook(corps, process.env.FEDAPAY_WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 3600))).status, 401)

    // Règlement confirmé par l'API : crédit.
    fedapay.definirStatut(transactionId, 'approved')
    reponse = await envoyer(corps, signerWebhook(corps, process.env.FEDAPAY_WEBHOOK_SECRET))
    assert.equal(reponse.status, 200)
    const credite = await etatBailleur()
    assert.equal(credite.plan, 'Standard')
    assert.ok(credite.date_fin_abonnement > new Date().toISOString().slice(0, 10))

    // Notification dupliquée : pas de second mois.
    reponse = await envoyer(corps, signerWebhook(corps, process.env.FEDAPAY_WEBHOOK_SECRET))
    assert.equal(reponse.status, 200)
    assert.equal((await etatBailleur()).date_fin_abonnement, credite.date_fin_abonnement)

    // Transaction inconnue de FedaPay : aucun effet. L'application ne distingue
    // pas « inconnue » de « API injoignable » : elle répond 503 pour que
    // FedaPay réessaie, sans jamais créditer (choix prudent, documenté).
    const inconnu = JSON.stringify({ name: 'transaction.approved', entity: { id: 9999999 } })
    assert.ok([200, 503].includes((await envoyer(inconnu, signerWebhook(inconnu, process.env.FEDAPAY_WEBHOOK_SECRET))).status))
    assert.equal((await etatBailleur()).date_fin_abonnement, credite.date_fin_abonnement)
    await p.context().close()
  })
})
