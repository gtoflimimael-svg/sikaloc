/**
 * Produit les trois aperçus Pro destinés à la page marketing.
 *
 * Rendu statique et hors ligne : aucune session, aucun appel Supabase,
 * aucune donnée du compte local ou hébergé. Les données affichées sont
 * synthétiques et chaque image porte sa mention de démonstration.
 *
 * Usage : npm run capturer:apercus-pro
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright-core')

const RACINE = process.cwd()
const SORTIE = path.join(RACINE, 'public/demo')
const LOGO = path.join(RACINE, 'public/marque/sikaloc-officiel-noir.svg')
const CHROME = process.env.SIKA_CHROMIUM || '/usr/bin/google-chrome'
const LARGEUR = 1280
const HAUTEUR = 860

const logo = `data:image/svg+xml;base64,${fs.readFileSync(LOGO).toString('base64')}`

const icones = {
  tableau: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  retards: '<path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
  logements: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z"/>',
  personnes: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  bail: '<path d="M7 3h10l4 4v14H7z"/><path d="M17 3v5h4M10 12h8m-8 4h8"/><path d="M3 7v14"/>',
  paiement: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19m-14 5h4"/>',
  annonce: '<path d="M4 14V9a2 2 0 0 1 2-2h3l9-4v17l-9-4H6a2 2 0 0 1-2-2Z"/><path d="m8 16 1 5h4l-2-4"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.4.8l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.4-.8l-1.7.6-1.4-2.4L8 15a8 8 0 0 1 0-1.8l-1.5-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.4-.8l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.4.8l1.7-.6 1.4 2.4-1.5 1.1a8 8 0 0 1 0 1.8Z"/>',
  ajouter: '<path d="M12 5v14M5 12h14"/>',
}

const navigation = [
  { groupe: 'Pilotage', liens: [['tableau', 'Tableau de bord'], ['retards', 'Impayés']] },
  { groupe: 'Gestion locative', liens: [['logements', 'Logements'], ['personnes', 'Locataires'], ['bail', 'Baux'], ['paiement', 'Paiements']] },
  { groupe: 'Commercialisation', liens: [['annonce', 'Annonces']] },
  { groupe: 'Compte', liens: [['reglages', 'Paramètres']] },
]

function icone(nom) {
  return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icones[nom]}</svg>`
}

function navActuelle(active) {
  return navigation.map(({ groupe, liens }) => `
    <section class="nav-group">
      <p class="nav-heading">${groupe}</p>
      ${liens.map(([nom, libelle]) => `
        <div class="nav-link ${active === nom ? 'is-active' : ''}">${icone(nom)}<span>${libelle}</span>${nom === 'retards' ? '<small class="nav-count">1</small>' : ''}</div>
      `).join('')}
    </section>
  `).join('')
}

const style = `
  * { box-sizing: border-box; }
  html, body { width: ${LARGEUR}px; height: ${HAUTEUR}px; margin: 0; overflow: hidden; }
  body { color: #111810; background: #eaf1e7; font-family: Inter, Manrope, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
  .app { display: flex; width: 100%; height: 100%; }
  .sidebar { width: 248px; flex: 0 0 248px; display: flex; flex-direction: column; padding: 19px 14px 15px; border-right: 1px solid #dfe7dd; background: #fff; }
  .brand { height: 51px; display: flex; align-items: center; gap: 11px; padding: 0 11px 14px; border-bottom: 1px solid #edf1eb; }
  .brand img { display: block; width: 97px; height: auto; }
  .brand-space { padding-left: 11px; border-left: 1px solid #cdd8cc; color: #17311c; font-size: 13px; font-weight: 700; }
  .nav { display: grid; align-content: start; gap: 16px; padding-top: 20px; }
  .nav-heading { margin: 0 0 5px; padding: 0 11px; color: #7a887c; font-size: 10px; font-weight: 700; letter-spacing: .06em; }
  .nav-link { position: relative; display: flex; height: 34px; align-items: center; gap: 11px; padding: 0 11px; border-radius: 9px; color: #526055; font-size: 12px; font-weight: 550; }
  .nav-link.is-active { background: #f0fbe4; color: #17311c; font-weight: 700; }
  .nav-link.is-active::before { position: absolute; left: -14px; width: 3px; height: 21px; border-radius: 0 5px 5px 0; background: #b8f36d; content: ""; }
  .nav-icon { width: 16px; height: 16px; flex: 0 0 auto; }
  .nav-count { display: grid; width: 17px; height: 17px; margin-left: auto; place-items: center; border-radius: 50%; background: #f9e8e5; color: #9c3d33; font-size: 10px; font-weight: 700; }
  .sidebar-bottom { margin-top: auto; padding: 12px 10px 0; border-top: 1px solid #edf1eb; color: #758176; font-size: 11px; }
  .theme-control { display: flex; width: 74px; justify-content: space-between; margin-bottom: 10px; padding: 6px 9px; border: 1px solid #e4eae2; border-radius: 20px; color: #576459; font-size: 11px; }
  .main { display: flex; min-width: 0; flex: 1; flex-direction: column; }
  .topbar { display: flex; height: 64px; flex: 0 0 64px; align-items: center; gap: 16px; padding: 0 28px; border-bottom: 1px solid #dfe7dd; background: #fff; }
  .context { min-width: 0; margin-right: auto; }
  .context small { display: block; color: #7a887c; font-size: 10px; line-height: 1.4; }
  .context strong { display: block; overflow: hidden; color: #27372a; font-size: 12px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
  .button { display: inline-flex; height: 36px; align-items: center; justify-content: center; gap: 8px; padding: 0 15px; border: 1px solid transparent; border-radius: 9px; background: #b8f36d; color: #111810; font: inherit; font-size: 11px; font-weight: 750; white-space: nowrap; }
  .button svg { width: 14px; height: 14px; }
  .account { display: flex; align-items: center; gap: 8px; color: #344237; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .avatar { display: grid; width: 29px; height: 29px; place-items: center; border: 1px solid #d9e6d5; border-radius: 50%; background: #eaf1e7; color: #17311c; font-size: 9px; font-weight: 750; }
  .content { width: 100%; max-width: 1100px; min-height: 0; flex: 1; margin: 0 auto; padding: 24px 28px 22px; overflow: hidden; }
  .demo-label { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 9px; padding: 5px 8px; border: 1px solid #d8e8d1; border-radius: 6px; background: #f5faef; color: #31513a; font-size: 9px; font-weight: 750; letter-spacing: .035em; }
  .demo-label span { padding-left: 8px; border-left: 1px solid #d3e3ce; color: #748174; font-size: 8px; font-weight: 650; }
  .page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 17px; }
  h1 { margin: 0; color: #111810; font-size: 25px; font-weight: 750; letter-spacing: -.045em; line-height: 1.16; }
  .subtitle { margin: 5px 0 0; color: #69776c; font-size: 11px; line-height: 1.5; }
  .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .metric { min-height: 87px; padding: 13px 15px; border: 1px solid #e1e9df; border-top: 2px solid #d5dfd3; border-radius: 10px; background: #fff; }
  .metric.primary { border-top-color: #b8f36d; background: #eff9e5; }
  .metric.alert { border-top-color: #d8897c; }
  .metric-title { color: #68766a; font-size: 9px; font-weight: 700; letter-spacing: .045em; }
  .metric-value { margin-top: 6px; color: #17251a; font-size: 21px; font-weight: 750; letter-spacing: -.04em; line-height: 1.1; }
  .metric-note { margin-top: 5px; color: #7b887d; font-size: 9px; }
  .quick-actions { display: flex; align-items: center; gap: 10px; margin: 13px 0 15px; padding: 10px 12px; border: 1px solid #e1e9df; border-radius: 10px; background: #fff; }
  .quick-title { margin-right: auto; color: #28382b; font-size: 11px; font-weight: 700; }
  .button.secondary { height: 32px; border-color: #dce5da; background: #fff; color: #304233; font-size: 10px; }
  .late-item { display: flex; align-items: center; gap: 11px; margin-bottom: 14px; padding: 10px 13px; border: 1px solid #efddd8; border-left: 3px solid #d8897c; border-radius: 9px; background: #fff; }
  .late-indicator { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: #c8685b; }
  .late-copy { min-width: 0; margin-right: auto; }
  .late-copy strong { color: #28382b; font-size: 10px; }
  .late-copy small { display: block; margin-top: 3px; color: #758176; font-size: 9px; }
  .late-amount { color: #26362a; font-size: 11px; font-weight: 750; white-space: nowrap; }
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  h2 { margin: 0; color: #19281c; font-size: 14px; font-weight: 720; letter-spacing: -.02em; }
  .text-link { color: #315b36; font-size: 10px; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
  .panel { overflow: hidden; border: 1px solid #e1e9df; border-radius: 10px; background: #fff; }
  table { width: 100%; border-collapse: collapse; text-align: left; }
  th { padding: 9px 10px; border-bottom: 1px solid #e9eee7; color: #788579; font-size: 8px; font-weight: 700; letter-spacing: .05em; }
  td { padding: 10px; border-bottom: 1px solid #edf1eb; color: #425045; font-size: 9px; white-space: nowrap; }
  tr:last-child td { border-bottom: 0; }
  td strong { color: #243428; font-weight: 680; }
  .money { color: #19281c; font-weight: 720; font-variant-numeric: tabular-nums; }
  .status { display: inline-flex; padding: 4px 7px; border-radius: 20px; background: #e9f5e5; color: #2d663a; font-size: 8px; font-weight: 750; }
  .status.partial { background: #fbf3dc; color: #866417; }
  .status.draft { background: #f0f2ef; color: #68746a; }
  .document { color: #315b36; font-size: 9px; font-weight: 700; }
  .filters { display: grid; grid-template-columns: 1fr 1fr auto; align-items: end; gap: 10px; margin-bottom: 12px; }
  .field label { display: block; margin-bottom: 5px; color: #5d6b60; font-size: 9px; font-weight: 700; }
  .select { display: flex; height: 33px; align-items: center; justify-content: space-between; padding: 0 10px; border: 1px solid #dfe7dd; border-radius: 8px; background: #fff; color: #3f4e42; font-size: 10px; }
  .select b { color: #869287; font-size: 9px; }
  .summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; color: #788579; font-size: 9px; }
  .summary strong { color: #354638; font-weight: 700; }
  .summary em { color: #17311c; font-style: normal; font-weight: 750; }
  .lease-list { display: grid; gap: 9px; }
  .lease { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 18px; padding: 12px 14px; border: 1px solid #e1e9df; border-left: 3px solid #b8f36d; border-radius: 10px; background: #fff; }
  .lease-main { display: flex; min-width: 0; align-items: center; gap: 11px; }
  .lease-icon { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border-radius: 9px; background: #eaf1e7; color: #315b36; }
  .lease-icon svg { width: 17px; height: 17px; }
  .lease-name { color: #26362a; font-size: 11px; font-weight: 750; }
  .lease-address { margin-top: 3px; color: #6f7c71; font-size: 9px; }
  .lease-meta { margin-top: 5px; color: #879188; font-size: 8px; }
  .lease-side { display: grid; justify-items: end; gap: 7px; }
  .lease-price { color: #17251a; font-size: 12px; font-weight: 750; white-space: nowrap; }
  .lease-price small { color: #7a877c; font-size: 8px; font-weight: 500; }
  .filters-pills { display: flex; gap: 6px; margin-bottom: 11px; }
  .pill { padding: 6px 10px; border: 1px solid #e0e8dd; border-radius: 18px; background: #fff; color: #657267; font-size: 9px; font-weight: 650; }
  .pill.active { border-color: #c6dfa9; background: #eff9e5; color: #24432a; }
`

function entete({ active, groupe, page, titre, description, action = 'Enregistrer un paiement' }) {
  return `
    <div class="app">
      <aside class="sidebar">
        <div class="brand"><img src="${logo}" alt="Sikaloc"/><span class="brand-space">Pro</span></div>
        <nav class="nav">${navActuelle(active)}</nav>
        <div class="sidebar-bottom"><div class="theme-control"><span>☼</span><span>◐</span></div>Bénin</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="context"><small>Sikaloc Pro · ${groupe}</small><strong>${page}</strong></div>
          <button class="button">${icone('ajouter')} ${action}</button>
          <div class="account"><span class="avatar">D</span><span>Compte démo</span><span aria-hidden="true">⌄</span></div>
        </header>
        <main class="content">
          <div class="demo-label">APERÇU DE DÉMONSTRATION <span>DONNÉES FICTIVES</span></div>
          <div class="page-heading"><div><h1>${titre}</h1><p class="subtitle">${description}</p></div></div>
  `
}

function pied() {
  return '</main></div></div>'
}

function tableau() {
  return `
    ${entete({ active: 'tableau', groupe: 'Pilotage', page: 'Tableau de bord', titre: 'Tableau de bord', description: 'Votre activité locative en temps réel.', action: 'Enregistrer un paiement' })}
    <section class="metrics" aria-label="Indicateurs de démonstration">
      <article class="metric"><div class="metric-title">TAUX D’OCCUPATION</div><div class="metric-value">75 %</div><div class="metric-note">3 baux actifs · 4 logements</div></article>
      <article class="metric"><div class="metric-title">TAUX DE RECOUVREMENT</div><div class="metric-value">75 %</div><div class="metric-note">180 000 sur 240 000 FCFA attendus</div></article>
      <article class="metric alert"><div class="metric-title">IMPAYÉS</div><div class="metric-value">1</div><div class="metric-note">45 000 FCFA à recouvrer</div></article>
      <article class="metric primary"><div class="metric-title">CA DU MOIS</div><div class="metric-value">180 000 FCFA</div><div class="metric-note">Paiements encaissés ce mois-ci</div></article>
    </section>
    <section class="quick-actions"><span class="quick-title">Actions rapides</span><button class="button">＋ Nouveau paiement</button><button class="button secondary">＋ Créer un bail</button><button class="button secondary">Suivre les retards</button></section>
    <section>
      <div class="section-head"><h2>Loyers en retard</h2><span class="text-link">Tout voir</span></div>
      <div class="late-item"><span class="late-indicator" aria-hidden="true"></span><div class="late-copy"><strong>Locataire C · Septembre 2026</strong><small>Logement démo 03 · Abomey-Calavi · période dépassée</small></div><span class="late-amount">45 000 FCFA</span></div>
    </section>
    <section>
      <div class="section-head"><h2>Derniers paiements</h2><span class="text-link">Tout voir</span></div>
      <div class="panel"><table><thead><tr><th>LOCATAIRE</th><th>PÉRIODE</th><th>DATE</th><th>MODE</th><th>MONTANT</th></tr></thead><tbody>
        <tr><td><strong>Locataire C</strong></td><td>Octobre 2026</td><td>07/10/2026</td><td>Espèces</td><td class="money">60 000 FCFA</td></tr>
        <tr><td><strong>Locataire B</strong></td><td>Octobre 2026</td><td>05/10/2026</td><td>Virement bancaire</td><td class="money">60 000 FCFA</td></tr>
        <tr><td><strong>Locataire A</strong></td><td>Octobre 2026</td><td>03/10/2026</td><td>Mobile Money</td><td class="money">60 000 FCFA</td></tr>
      </tbody></table></div>
    </section>
    ${pied()}
  `
}

function paiements() {
  return `
    ${entete({ active: 'paiement', groupe: 'Gestion locative', page: 'Paiements', titre: 'Historique des paiements', description: 'Les règlements enregistrés et leurs documents associés.', action: 'Nouveau paiement' })}
    <div class="filters" aria-label="Filtres de démonstration">
      <div class="field"><label>Bail</label><div class="select">Tous les baux <b>⌄</b></div></div>
      <div class="field"><label>Statut</label><div class="select">Tous <b>⌄</b></div></div>
      <button class="button secondary">Filtrer</button>
    </div>
    <div class="summary"><span><strong>4 paiements</strong> · 4 affichés</span><span>Total validé affiché : <em>240 000 FCFA</em></span></div>
    <div class="panel"><table><thead><tr><th>LOCATAIRE</th><th>PÉRIODE</th><th>DATE</th><th>MODE</th><th>STATUT</th><th>MONTANT</th><th>DOCUMENT</th></tr></thead><tbody>
      <tr><td><strong>Locataire C</strong></td><td>Oct. 2026</td><td>07/10/2026</td><td>Espèces</td><td><span class="status partial">Partiel</span></td><td class="money">60 000</td><td class="document">Reçu</td></tr>
      <tr><td><strong>Locataire B</strong></td><td>Oct. 2026</td><td>05/10/2026</td><td>Virement bancaire</td><td><span class="status partial">Partiel</span></td><td class="money">60 000</td><td class="document">Reçu</td></tr>
      <tr><td><strong>Locataire A</strong></td><td>Oct. 2026</td><td>03/10/2026</td><td>Mobile Money</td><td><span class="status">Payé</span></td><td class="money">60 000</td><td class="document">Quittance</td></tr>
      <tr><td><strong>Locataire C</strong></td><td>Sept. 2026</td><td>02/10/2026</td><td>Espèces</td><td><span class="status partial">Partiel</span></td><td class="money">60 000</td><td class="document">Reçu</td></tr>
    </tbody></table></div>
    <div class="summary" style="margin-top:12px"><span>Reçu : versement partiel · Quittance : période soldée</span><span>Montants fictifs</span></div>
    ${pied()}
  `
}

function baux() {
  return `
    ${entete({ active: 'bail', groupe: 'Gestion locative', page: 'Baux', titre: 'Baux', description: 'Le contrat qui relie un logement, un locataire et un loyer.', action: 'Nouveau bail' })}
    <div class="filters-pills"><span class="pill active">Tous</span><span class="pill">Actifs</span><span class="pill">Résiliés</span></div>
    <div class="summary"><span><strong>3 baux affichés</strong></span><span>Logements, locataires et conditions de location</span></div>
    <section class="lease-list" aria-label="Baux de démonstration">
      <article class="lease"><div class="lease-main"><span class="lease-icon">${icone('bail')}</span><div><div class="lease-name">Locataire A</div><div class="lease-address">Logement démo 01 · Cotonou</div><div class="lease-meta">Depuis le 01/03/2026 · échéance le 5 · tolérance 5 jours</div></div></div><div class="lease-side"><span class="status">Actif</span><div class="lease-price">60 000 FCFA <small>/mois</small></div></div></article>
      <article class="lease"><div class="lease-main"><span class="lease-icon">${icone('bail')}</span><div><div class="lease-name">Locataire B</div><div class="lease-address">Logement démo 02 · Porto-Novo</div><div class="lease-meta">Depuis le 15/06/2026 · échéance le 25 · tolérance 5 jours</div></div></div><div class="lease-side"><span class="status">Actif</span><div class="lease-price">75 000 FCFA <small>/mois</small></div></div></article>
      <article class="lease"><div class="lease-main"><span class="lease-icon">${icone('bail')}</span><div><div class="lease-name">Locataire C</div><div class="lease-address">Logement démo 03 · Abomey-Calavi</div><div class="lease-meta">Depuis le 01/09/2026 · échéance le 25 · tolérance 3 jours</div></div></div><div class="lease-side"><span class="status">Actif</span><div class="lease-price">105 000 FCFA <small>/mois</small></div></div></article>
    </section>
    ${pied()}
  `
}

const vues = [
  { nom: 'pro-tableau-de-bord.png', contenu: tableau() },
  { nom: 'pro-paiements-quittances.png', contenu: paiements() },
  { nom: 'pro-baux-locataires.png', contenu: baux() },
]

;(async () => {
  fs.mkdirSync(SORTIE, { recursive: true })
  const navigateur = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  const contexte = await navigateur.newContext({ viewport: { width: LARGEUR, height: HAUTEUR }, deviceScaleFactor: 2, colorScheme: 'light' })
  const page = await contexte.newPage()

  for (const vue of vues) {
    await page.setContent(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${style}</style></head><body>${vue.contenu}</body></html>`, { waitUntil: 'domcontentloaded' })
    const fichier = path.join(SORTIE, vue.nom)
    await page.screenshot({ path: fichier, type: 'png' })
    console.log(`Aperçu synthétique écrit : public/demo/${vue.nom}`)
  }

  await navigateur.close()
})().catch((erreur) => {
  console.error('Impossible de produire les aperçus de démonstration hors ligne.')
  console.error(erreur.message)
  process.exit(1)
})
