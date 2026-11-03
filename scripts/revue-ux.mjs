/** Captures en lecture seule de l’instance Demo locale, via les comptes et parcours réels. */
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright-core'

const role = process.argv[2] || 'public'
if (!['public', 'pro', 'me', 'find'].includes(role)) throw new Error('Rôle attendu : public, pro, me ou find')
const base = process.env.REVUE_URL || 'http://127.0.0.1:3000'
const destination = new URL(base)
if (!['127.0.0.1', 'localhost'].includes(destination.hostname)) throw new Error('La revue est limitée au serveur local')
const prive = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'), 'sikaloc-demo-local')
const marqueur = JSON.parse(await readFile(path.join(prive, 'instance.json'), 'utf8'))
if (!/^sikaloc-demo-[a-f0-9]{12}$/.test(marqueur.projectId) || marqueur.schemaState !== 'ready') throw new Error('Instance Demo non identifiée')
const statut = spawnSync(path.resolve('node_modules/.bin/supabase'), ['status', '--output', 'env', '--workdir', prive], { encoding: 'utf8' })
if (statut.status !== 0) throw new Error('Pile Demo indisponible')
const valeurs = Object.fromEntries([...statut.stdout.matchAll(/^([A-Z_]+)="?(.*?)"?$/gm)].map(m => [m[1], m[2].replace(/"$/, '')]))
const api = new URL(valeurs.API_URL)
if (!['127.0.0.1', 'localhost'].includes(api.hostname) || api.port !== '54821') throw new Error('Base hors de la pile Demo')
const client = createClient(valeurs.API_URL, valeurs.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
let compte
if (role !== 'public') {
  const secrets = JSON.parse(await readFile(path.join(prive, 'secrets.json'), 'utf8'))
  compte = process.env.REVUE_COMPTE_NEUF === '1' && role === 'pro'
    ? JSON.parse(await readFile(path.join(prive, 'compte-revue-ux.json'), 'utf8'))
    : secrets.comptes?.[role]
  if (!compte?.email?.endsWith('@sikaloc-demo.test') || !compte.motDePasse) throw new Error('Compte Demo absent')
  const { error } = await client.auth.signInWithPassword({ email: compte.email, password: compte.motDePasse })
  if (error) throw new Error(`Connexion Demo refusée (${error.code || error.status})`)
}
const articles = [...(await readFile('src/lib/articles.ts', 'utf8')).matchAll(/slug: '([^']+)'/g)].map(m => `/blog/${m[1]}`)
let routes = role === 'public'
  ? ['/', '/pro?presentation=1', '/me/rejoindre', '/me/invitation/invitation-invalide-revue-ux', '/entrer', '/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe', '/verification', '/questions', '/blog', ...articles, '/legal/conditions', '/legal/confidentialite', '/legal/mentions', '/guide/confirmer', '/guide/desinscription', '/find', '/find/introuvable']
  : role === 'pro'
    ? ['/pro/tableau-de-bord', '/pro/logements', '/pro/logements/nouveau', '/pro/locataires', '/pro/locataires/nouveau', '/pro/baux', '/pro/baux/nouveau', '/pro/paiements', '/pro/paiements/nouveau', '/pro/impayes', '/pro/annonces', '/pro/annonces/nouvelle', '/pro/parametres', ...['profil', 'signature', 'preferences', 'abonnement', 'parrainage', 'donnees'].map(x => `/pro/parametres/${x}`), '/pro/onboarding']
    : role === 'me' ? ['/me', '/me/bail', '/me/loyers', '/me/paiements', '/me/preferences', '/me/candidatures']
      : ['/find', '/me/candidatures']
if (role === 'pro') {
  for (const [table, build] of [
    ['logements', id => [`/pro/logements/${id}/modifier`]],
    ['locataires', id => [`/pro/locataires/${id}/modifier`]],
    ['baux', id => [`/pro/baux/${id}`, `/pro/baux/${id}/historique`, `/pro/baux/${id}/modifier`]],
    ['paiements', id => [`/pro/paiements/${id}/confirmer`, `/pro/paiements/${id}/modifier`]],
    ['quittances', id => [`/pro/quittances/${id}`]],
    ['annonces', id => [`/pro/annonces/${id}`, `/pro/annonces/${id}/candidatures`]],
  ]) {
    const { data, error } = await client.from(table).select('id').limit(1)
    if (error) throw new Error(`Lecture autorisée impossible : ${table} (${error.code})`)
    if (data?.[0]) routes.push(...build(data[0].id))
  }
}
if (role === 'find' || role === 'public') {
  const { data, error } = await client.rpc('annonces_recherche', { p_limite: 1, p_decalage: 0 })
  if (error) throw new Error(`Catalogue indisponible (${error.code})`)
  if (data?.[0]?.reference) routes.push(`/find/${data[0].reference}`, `/find/${data[0].reference}/candidater`)
}
if (process.env.REVUE_ROUTES) routes = process.env.REVUE_ROUTES.split(',')
const largeurs = (process.env.REVUE_LARGEURS || '375,1440').split(',').map(Number)
const dossier = process.env.REVUE_DOSSIER_SORTIE
  ? path.resolve(process.env.REVUE_DOSSIER_SORTIE)
  : path.join(prive, 'revue-ux', `${new Date().toISOString().replaceAll(':', '-')}-${role}${process.env.REVUE_COMPTE_NEUF === '1' ? '-neuf' : ''}`)
await mkdir(dossier, { recursive: true, mode: 0o700 })
const navigateur = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' })
const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', timezoneId: 'Africa/Porto-Novo' })
const page = await contexte.newPage()
if (compte) {
  await page.goto(`${base}/connexion`, { waitUntil: 'networkidle' })
  await page.locator('[name=email]').fill(compte.email)
  await page.locator('[name=motDePasse]').fill(compte.motDePasse)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/connexion'), { timeout: 20000 })
}
const resultats = []
function espaceCapture(route) {
  const pathname = new URL(route, base).pathname
  if (pathname.startsWith('/find')) return 'Find'
  if (/^\/(connexion|entrer|inscription|mot-de-passe-oublie|reinitialiser-mot-de-passe|verification)(\/|$)/.test(pathname)) return 'Authentification'
  if (pathname === '/me/rejoindre' || pathname.startsWith('/me/invitation/')) return 'Authentification'
  if (pathname === '/pro' && route.includes('presentation=1')) return 'Public'
  if (pathname === '/pro' || pathname.startsWith('/pro/')) return role === 'public' ? 'Public' : 'Pro'
  if (pathname === '/me' || pathname.startsWith('/me/')) return 'Me'
  return 'Public'
}
try {
  for (const largeur of largeurs) for (const route of routes) {
    const erreurs = []
    const noterErreur = error => erreurs.push(error.message)
    page.on('pageerror', noterErreur)
    await page.setViewportSize({ width: largeur, height: 1000 })
    const reponse = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 })
    await page.evaluate(() => document.fonts.ready)
    // Charger les visuels différés avant la capture complète.
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight
      for (let y = 0; y < h; y += innerHeight) {
        scrollTo({ top: y, behavior: 'instant' })
        await new Promise(resolve => setTimeout(resolve, 40))
      }
      scrollTo({ top: 0, behavior: 'instant' })
      // Le screenshot pleine page ne déclenche pas toujours les images `lazy`
      // sous Chrome headless. Les rendre eager ici évite de confondre le délai
      // du banc avec un état vide de l’interface.
      const images = [...document.images]
      images.forEach(image => { image.loading = 'eager' })
      await Promise.all(images.map(image => image.complete
        ? Promise.resolve()
        : Promise.race([
            new Promise(resolve => {
              image.addEventListener('load', resolve, { once: true })
              image.addEventListener('error', resolve, { once: true })
            }),
            new Promise(resolve => setTimeout(resolve, 8000)),
          ])))
      // `complete` et `naturalWidth` peuvent être vrais avant le décodage
      // graphique. Chrome headless a alors peint des rectangles vides dans
      // la capture pleine page malgré une réponse image réussie.
      await Promise.all(images.map(image => image.decode?.().catch(() => undefined)))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    const mesures = await page.evaluate(() => ({
      titre: document.querySelector('h1')?.textContent.trim(),
      largeur: document.documentElement.clientWidth,
      contenu: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      erreursAffichees: [...document.querySelectorAll('[role=alert]')].map(e => e.textContent.trim()),
      images: [...document.images].map(image => ({
        src: new URL(image.currentSrc || image.src, location.href).pathname,
        chargee: image.complete && image.naturalWidth > 0,
        largeurNaturelle: image.naturalWidth,
        alt: image.alt,
      })),
    }))
    const nomCapture = `${route.replaceAll(/[^a-zA-Z0-9-]/g, '_') || 'accueil'}-${largeur}.jpg`
    const cheminCapture = path.join(espaceCapture(route), nomCapture)
    await mkdir(path.dirname(path.join(dossier, cheminCapture)), { recursive: true, mode: 0o700 })
    await page.screenshot({ path: path.join(dossier, cheminCapture), type: 'jpeg', quality: 86, fullPage: true, animations: 'disabled' })
    page.off('pageerror', noterErreur)
    const resultat = { route, espace: espaceCapture(route), largeur, statut: reponse.status(), destination: new URL(page.url()).pathname, ...mesures, erreurs, capture: cheminCapture }
    resultats.push(resultat)
    await writeFile(path.join(dossier, 'manifest.json'), JSON.stringify({ role, dossier, resultats }, null, 2))
    console.log(`${role} ${largeur}px ${route} → ${resultat.statut} · débordement ${mesures.contenu - mesures.largeur}px · JS ${erreurs.length}`)
  }
} finally {
  await navigateur.close()
  await client.auth.signOut()
}
console.log(`Captures et mesures : ${dossier}`)
if (resultats.some(r => r.contenu > r.largeur + 1 || r.erreurs.length)) process.exitCode = 1
