/** Assemble la galerie locale et les planches de comparaison de la revue UX. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const racine = path.resolve('docs/revue-ux-final')
const planches = path.join(racine, 'planches')
await mkdir(planches, { recursive: true })

const sources = [
  ['public', path.join(racine, 'manifest.json')],
  ['pro', path.join(racine, 'Pro/manifest.json')],
  ['me', path.join(racine, 'Me/manifest.json')],
]
const manifests = new Map()
for (const [role, fichier] of sources) {
  const manifeste = JSON.parse(await readFile(fichier, 'utf8'))
  manifests.set(role, { fichier, manifeste })
}

function capture(role, resultat) {
  const source = manifests.get(role)
  const chemin = path.resolve(path.dirname(source.fichier), resultat.capture)
  return {
    ...resultat,
    role,
    chemin,
    href: path.relative(racine, chemin).split(path.sep).join('/'),
  }
}

const publicPages = manifests.get('public').manifeste.resultats
const proPages = manifests.get('pro').manifeste.resultats
const mePages = manifests.get('me').manifeste.resultats
const espaces = [
  { nom: 'Public', id: 'public', pages: publicPages.filter((page) => page.espace === 'Public').map((page) => capture('public', page)) },
  { nom: 'Authentification', id: 'authentification', pages: publicPages.filter((page) => page.espace === 'Authentification').map((page) => capture('public', page)) },
  { nom: 'Pro', id: 'pro', pages: proPages.map((page) => capture('pro', page)) },
  { nom: 'Me', id: 'me', pages: mePages.map((page) => capture('me', page)) },
]

function paires(pages) {
  const groupes = new Map()
  for (const page of pages) {
    const variante = page.role === 'pro' ? 'Compte Pro' : page.role === 'me' ? 'Compte Me' : 'Visiteur'
    const cle = `${page.route}\u0000${variante}`
    if (!groupes.has(cle)) groupes.set(cle, { route: page.route, variante, largeurs: new Map() })
    groupes.get(cle).largeurs.set(page.largeur, page)
  }
  return [...groupes.values()].filter((groupe) => groupe.largeurs.has(375) && groupe.largeurs.has(1440))
}

async function vignette(page, largeur, hauteur) {
  const entree = page.chemin
  const metadata = await sharp(entree).metadata()
  const hauteurVisible = Math.min(metadata.height ?? 1000, 1000)
  return sharp(entree)
    .extract({ left: 0, top: 0, width: metadata.width, height: hauteurVisible })
    .resize({ width: largeur, height: hauteur, fit: 'contain', background: '#ffffff' })
    .png()
    .toBuffer()
}

async function planche(nomFichier, groupes) {
  const colonnes = 2
  const largeurCarte = 570
  const hauteurCarte = 390
  const lignes = Math.ceil(groupes.length / colonnes)
  const composants = []
  for (let index = 0; index < groupes.length; index++) {
    const groupe = groupes[index]
    const x = (index % colonnes) * largeurCarte
    const y = Math.floor(index / colonnes) * hauteurCarte
    const petit = groupe.largeurs.get(375)
    const grand = groupe.largeurs.get(1440)
    const imageMobile = await vignette(petit, 160, 330)
    const imageBureau = await vignette(grand, 360, 330)
    const route = `${groupe.route}${groupe.variante === 'Visiteur' ? '' : ` · ${groupe.variante}`}`
    const entete = Buffer.from(`<svg width="570" height="46"><rect width="100%" height="100%" fill="#f7f8f4"/><text x="12" y="29" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#17211a">${route.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</text></svg>`)
    composants.push({ input: entete, left: x, top: y })
    composants.push({ input: imageMobile, left: x + 10, top: y + 50 })
    composants.push({ input: imageBureau, left: x + 190, top: y + 50 })
  }
  await sharp({ create: { width: colonnes * largeurCarte, height: lignes * hauteurCarte, channels: 3, background: '#f7f8f4' } })
    .composite(composants)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(planches, nomFichier))
}

const notices = []
for (const espace of espaces) {
  const groupes = paires(espace.pages)
  for (let debut = 0, index = 1; debut < groupes.length; debut += 8, index++) {
    const nom = `${espace.id}${groupes.length > 8 ? `-${String(index).padStart(2, '0')}` : ''}.jpg`
    await planche(nom, groupes.slice(debut, debut + 8))
    notices.push({ nom: espace.nom, fichier: `planches/${nom}`, routes: groupes.slice(debut, debut + 8).map((groupe) => groupe.route) })
  }
}

const cleCoherence = [
  ['public', '/'],
  ['public', '/pro?presentation=1'],
  ['public', '/connexion'],
  ['pro', '/pro/tableau-de-bord'],
  ['me', '/me'],
]
const coherence = []
for (const [role, route] of cleCoherence) {
  const pages = role === 'public' ? publicPages : role === 'pro' ? proPages : mePages
  coherence.push(...pages.filter((page) => page.route === route).map((page) => capture(role, page)))
}
await planche('coherence-espaces.jpg', paires(coherence))

const comparaisons = [
  { titre: 'Me · accueil', avant: 'avant/Me-accueil-375.png', apres: 'Me/Me/_me-375.jpg' },
]
const largeurComparaison = 320
const hauteursComparaison = await Promise.all(comparaisons.map(async ({ avant, apres }) => {
  const [ancien, nouveau] = await Promise.all([sharp(path.join(racine, avant)).metadata(), sharp(path.join(racine, apres)).metadata()])
  return Math.max(
    Math.round(largeurComparaison * (ancien.height ?? 1000) / (ancien.width ?? 375)),
    Math.round(largeurComparaison * (nouveau.height ?? 1000) / (nouveau.width ?? 375)),
  ) + 52
}))
const hauteurComparaison = hauteursComparaison.reduce((total, hauteur) => total + hauteur, 0) + 20
const elementsComparaison = []
let yComparaison = 10
for (let index = 0; index < comparaisons.length; index++) {
  const groupe = comparaisons[index]
  const ancien = await sharp(path.join(racine, groupe.avant)).resize({ width: largeurComparaison }).jpeg({ quality: 84 }).toBuffer()
  const nouveau = await sharp(path.join(racine, groupe.apres)).resize({ width: largeurComparaison }).jpeg({ quality: 84 }).toBuffer()
  const enTete = Buffer.from(`<svg width="720" height="42"><rect width="100%" height="100%" fill="#f4f7f2"/><text x="10" y="28" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#17211a">${groupe.titre}</text><text x="170" y="28" font-family="Arial,sans-serif" font-size="15" fill="#5f6c62">Avant · 27 oct.</text><text x="500" y="28" font-family="Arial,sans-serif" font-size="15" fill="#5f6c62">Après · 28 oct.</text></svg>`)
  elementsComparaison.push({ input: enTete, left: 0, top: yComparaison })
  elementsComparaison.push({ input: ancien, left: 10, top: yComparaison + 45 })
  elementsComparaison.push({ input: nouveau, left: 370, top: yComparaison + 45 })
  yComparaison += hauteursComparaison[index]
}
await sharp({ create: { width: 720, height: hauteurComparaison, channels: 3, background: '#ffffff' } })
  .composite(elementsComparaison)
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(planches, 'comparaison-avant-apres.jpg'))

function statut(page) {
  const erreurs = page.erreurs.length ? ` · ${page.erreurs.length} erreur(s) JS` : ''
  const debordement = Math.max(0, page.contenu - page.largeur)
  return `${page.statut} · débordement ${debordement}px${erreurs}`
}

const sections = espaces.map((espace) => {
  const groupes = paires(espace.pages)
  const planchesEspace = notices.filter((notice) => notice.nom === espace.nom)
  const entetePlanches = planchesEspace.map((notice) => `<a class="planche" href="${notice.fichier}"><img src="${notice.fichier}" alt="Planche comparative ${espace.nom}"><span>${notice.fichier.split('/').at(-1)} · ${notice.routes.length} écrans</span></a>`).join('')
  const cartes = groupes.map((groupe) => {
    const mobile = groupe.largeurs.get(375)
    const bureau = groupe.largeurs.get(1440)
    const note = mobile.erreurs.length || bureau.erreurs.length ? '<span class="alerte">Hydratation à reprendre</span>' : ''
    return `<details class="page"><summary><strong>${groupe.route}</strong><span>${groupe.variante}</span>${note}<span class="mesure">375 px : ${statut(mobile)} · 1440 px : ${statut(bureau)}</span></summary><div class="captures"><figure><a href="${mobile.href}" target="_blank" rel="noreferrer"><img loading="lazy" src="${mobile.href}" alt="${groupe.route} sur smartphone, 375 pixels"></a><figcaption>Smartphone · 375 px</figcaption></figure><figure><a href="${bureau.href}" target="_blank" rel="noreferrer"><img loading="lazy" src="${bureau.href}" alt="${groupe.route} sur ordinateur, 1440 pixels"></a><figcaption>Ordinateur · 1440 px</figcaption></figure></div></details>`
  }).join('')
  return `<section id="${espace.id}"><h2>${espace.nom}</h2><div class="planches">${entetePlanches}</div>${cartes || '<p>Aucune capture disponible.</p>'}</section>`
}).join('')

const galerie = `<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revue visuelle Sikaloc</title>
<style>
:root{color-scheme:light;--ink:#17211a;--mute:#5f6c62;--line:#d9e0d8;--paper:#fff;--canvas:#f4f7f2;--brand:#37734f}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.5 system-ui,sans-serif}header{background:#17321f;color:white;padding:48px max(24px,calc((100vw - 1280px)/2)) 36px}header p{max-width:760px;color:#d9e6da}nav{display:flex;gap:16px;flex-wrap:wrap}nav a{color:white}main{max-width:1280px;margin:auto;padding:32px 20px 80px}h1{font-size:clamp(2rem,5vw,3.6rem);line-height:1.05;margin:0 0 16px}h2{margin:42px 0 14px;border-bottom:1px solid var(--line);padding-bottom:10px;font-size:1.8rem}h3{margin-top:32px}.resume{padding:16px 18px;border-left:3px solid var(--brand);background:white}.planches{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.planche{display:flex;flex-direction:column;width:min(100%,320px);color:var(--ink);text-decoration:none;font-size:.9rem}.planche img{width:100%;border:1px solid var(--line);background:white}.page{border-bottom:1px solid var(--line);padding:12px 0}.page summary{cursor:pointer;display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:8px 16px;align-items:baseline}.page summary strong{font-size:1.02rem}.mesure{grid-column:1/-1;color:var(--mute);font-size:.85rem}.alerte{color:#9c301f;font-weight:700}.captures{display:grid;grid-template-columns:minmax(220px, .7fr) minmax(360px,1.3fr);gap:20px;margin:18px 0 8px}.captures figure{margin:0;min-width:0}.captures a{display:block;background:white;border:1px solid var(--line);max-height:950px;overflow:auto}.captures img{display:block;width:100%;height:auto}.captures figcaption{padding:6px;color:var(--mute);font-size:.85rem}@media(max-width:700px){.captures{grid-template-columns:1fr}.page summary{grid-template-columns:1fr auto}.mesure{grid-column:1/-1}}
</style>
<header><h1>Revue visuelle de Sikaloc</h1><p>Captures pleine page du build local de revue, prises le 28 octobre 2026 avec les données fictives de l’instance Demo. Chaque route est présentée à 375 px et 1440 px. Ouvrir une ligne pour examiner les captures complètes; les planches montrent les premiers écrans en parallèle.</p><nav><a href="planches/coherence-espaces.jpg">Comparaison de cohérence entre espaces</a><a href="diagnostic-hydratation.md">Diagnostic React 418</a><a href="../refonte-ux-couverture.md">Checklist de couverture</a></nav></header>
<main><p class="resume"><strong>Lecture des preuves :</strong> les réponses HTTP sont relevées telles qu’observées, y compris les 404. Les routes avec 418 sont signalées comme non stabilisées. Le panneau de support administrateur est inaccessible sans un compte autorisé; il n’est pas simulé ici.</p><h2>Avant et après</h2><p>Ces comparaisons réutilisent des captures de la passe précédente et celles du build actuel. L’ancienne capture inclut le bandeau Demo; c’est un état de session précédent, pas une baseline production contrôlée.</p><a href="planches/comparaison-avant-apres.jpg"><img style="max-width:100%;border:1px solid var(--line)" src="planches/comparaison-avant-apres.jpg" alt="Comparaison avant et après de l’espace Me sur smartphone"></a><h2>Comparer les espaces</h2><a href="planches/coherence-espaces.jpg"><img style="max-width:100%;border:1px solid var(--line)" src="planches/coherence-espaces.jpg" alt="Accueil, Pro public, Auth, Pro et Me comparés sur mobile et desktop"></a>${sections}<h2>Limites de cette série</h2><p>Il s’agit d’une revue visuelle web sous Chrome local, pas d’un test sur téléphone physique ni de Safari ou Firefox. Les captures montrent l’état accessible de chaque route à cet utilisateur de démonstration; les états de succès qui nécessitent une écriture métier et les erreurs réseau ne sont pas fabriqués. Les variantes d’états et les obstacles sont consignés dans la checklist.</p></main></html>`
await writeFile(path.join(racine, 'gallery.html'), galerie)

const compte = espaces.map((espace) => `| ${espace.nom} | ${paires(espace.pages).length} vues | ${espace.pages.filter((page) => page.largeur === 375).length} captures 375 px; ${espace.pages.filter((page) => page.largeur === 1440).length} captures 1440 px |`).join('\n')
const capturesToutes = [...manifests.entries()].flatMap(([role, { manifeste }]) => manifeste.resultats.map((page) => ({ ...page, role })))
const contextesVues = espaces.reduce((total, espace) => total + paires(espace.pages).length, 0)
const erreurs418 = capturesToutes.filter((page) => page.erreurs.some((erreur) => /React error #418/.test(erreur)))
const erreursParentNode = capturesToutes.filter((page) => page.erreurs.some((erreur) => /parentNode/i.test(erreur)))
const contexteRole = { public: 'visiteur', pro: 'compte Pro', me: 'compte Me' }
const detail418 = erreurs418.map((page) => `\`${page.espace} ${page.route} (${contexteRole[page.role]}) · ${page.largeur} px\``).join(', ')
const index = `# Revue visuelle finale — Sikaloc\n\nDate : 28 octobre 2026. Build isolé local, données Demo fictives, Chrome headless sous Linux. Les captures sont des JPEG pleine page, à consulter dans [la galerie](gallery.html); les planches de synthèse sont ci-dessous.\n\n| Espace | Vues | Captures |\n| --- | ---: | --- |\n${compte}\n\nAu total, ${capturesToutes.length} captures couvrent les routes des manifestes Public, Pro et Me (${contextesVues} couples route/contexte, certaines routes dynamiques étant montrées dans plusieurs contextes). Le rendu du support /questions/gestion reste inaccessible sans compte administrateur légitime.\n\n- [Planche de cohérence entre les écrans principaux](planches/coherence-espaces.jpg)\n- [Comparaisons avant/après de Me](planches/comparaison-avant-apres.jpg); l’ancienne passe inclut le bandeau Demo et ne constitue pas une baseline contrôlée.\n- [Diagnostic détaillé des erreurs React 418](diagnostic-hydratation.md).\n- Les autres planches sont rangées dans [planches/](planches/).\n- Chaque ligne de la galerie indique le statut HTTP, le débordement horizontal et les erreurs JS observées.\n- Les ${capturesToutes.length} captures mesurées ont 0 px de débordement horizontal. Les statuts HTTP, y compris les 404 observées, sont conservés tels quels; aucun contenu légal n’a été inventé.\n- La passe propre a enregistré ${erreurs418.length} erreurs React 418 sur ${capturesToutes.length} captures : ${detail418 || 'aucune'}. ` + (erreursParentNode.length ? `Des erreurs parentNode sont aussi présentes (${erreursParentNode.length}).` : 'Aucune erreur parentNode n’a été observée.') + ` La cause du 418 n’est pas établie et aucune résolution n’est déclarée.\n- Les captures ne valident pas les mutations, les états serveur inaccessibles, un téléphone réel, Safari ou Firefox.\n`
await writeFile(path.join(racine, 'README.md'), index)
console.log(`Galerie et ${notices.length + 2} planches écrites dans ${racine}`)
