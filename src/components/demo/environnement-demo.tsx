'use client'

import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  CircleAlert,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'

import { MarqueSikaloc } from '@/components/ui/logo'
import {
  CANDIDATS_DEMO,
  creerDonneesDemo,
  estDonneeDemoValide,
  LOCATAIRES_DEMO,
  PROFILS_DEMO,
  type CandidatureDemo,
  type DonneesDemo,
  type DocumentDemo,
  type EspaceDemo,
  type LogementDemo,
  type PeriodeDemo,
  type ProfilDemo,
  type StatutCandidatureDemo,
} from '@/lib/demo/donnees'

import styles from './demo.module.css'

const CLE_STOCKAGE = 'sikaloc-demo-locale-v1'
const FORMATEUR_FCFA = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

const TITRES_VUES: Record<string, { titre: string; description: string }> = {
  tableau: { titre: 'Vue d’ensemble', description: 'Le portefeuille de démonstration, avec des données fictives cohérentes.' },
  logements: { titre: 'Logements', description: 'Les biens associés au profil propriétaire sélectionné.' },
  locataires: { titre: 'Locataires', description: 'Les personnes liées aux baux de ce portefeuille.' },
  baux: { titre: 'Baux', description: 'Contrats actifs et historiques de l’environnement fictif.' },
  paiements: { titre: 'Paiements et échéances', description: 'Périodes réglées, versements partiels et soldes à suivre.' },
  documents: { titre: 'Documents', description: 'Aperçus locaux portant tous la mention document fictif.' },
  candidatures: { titre: 'Annonces et candidatures', description: 'Les demandes reçues pour les annonces de ce portefeuille.' },
  accueil: { titre: 'Mon espace locataire', description: 'Les informations liées au profil locataire fictif sélectionné.' },
  loyers: { titre: 'Mes loyers', description: 'Un aperçu des périodes et versements rattachés à votre bail.' },
  preferences: { titre: 'Préférences de démonstration', description: 'Ce réglage est conservé dans ce navigateur uniquement.' },
  catalogue: { titre: 'Trouver un logement', description: 'Catalogue fictif : les visuels sont illustratifs, pas des photos de biens.' },
  'mes-candidatures': { titre: 'Mes candidatures', description: 'Suivez les demandes fictives de ce profil candidat.' },
}

const NAVIGATION: Record<EspaceDemo, { id: string; titre: string; icone: typeof Home }[]> = {
  pro: [
    { id: 'tableau', titre: 'Vue d’ensemble', icone: LayoutDashboard },
    { id: 'logements', titre: 'Logements', icone: Building2 },
    { id: 'locataires', titre: 'Locataires', icone: UsersRound },
    { id: 'baux', titre: 'Baux', icone: ClipboardList },
    { id: 'paiements', titre: 'Paiements', icone: WalletCards },
    { id: 'documents', titre: 'Documents', icone: FileText },
    { id: 'candidatures', titre: 'Annonces & demandes', icone: Search },
  ],
  me: [
    { id: 'accueil', titre: 'Mon logement', icone: Home },
    { id: 'loyers', titre: 'Loyers et paiements', icone: WalletCards },
    { id: 'documents', titre: 'Mes documents', icone: FileText },
    { id: 'preferences', titre: 'Préférences', icone: BadgeCheck },
  ],
  find: [
    { id: 'catalogue', titre: 'Catalogue', icone: Search },
    { id: 'mes-candidatures', titre: 'Mes candidatures', icone: ClipboardList },
  ],
}

function fcfa(montant: number) {
  return `${FORMATEUR_FCFA.format(montant)} FCFA`
}

function obtenirBail(donnees: DonneesDemo, bailId: string) {
  return donnees.baux.find((bail) => bail.id === bailId)
}

function obtenirLogement(donnees: DonneesDemo, logementId: string) {
  return donnees.logements.find((logement) => logement.id === logementId)
}

function nomLocataire(locataireId: string) {
  return LOCATAIRES_DEMO.find((locataire) => locataire.id === locataireId)?.nom ?? 'Profil fictif'
}

function nomCandidat(candidatId: string) {
  return CANDIDATS_DEMO.find((candidat) => candidat.id === candidatId)?.nom ?? 'Candidat fictif'
}

function statutPeriode(statut: PeriodeDemo['statut']) {
  if (statut === 'regle') return { libelle: 'Réglée', classe: styles.statusPaid }
  if (statut === 'partiel') return { libelle: 'Partielle', classe: styles.statusPartial }
  return { libelle: 'À régler', classe: styles.statusDue }
}

function statutCandidature(statut: StatutCandidatureDemo) {
  return {
    nouvelle: 'Nouvelle',
    a_etudier: 'À examiner',
    acceptee: 'Réponse positive',
    refusee: 'Clôturée',
  }[statut]
}

type MiseAJourDemo = Dispatch<SetStateAction<DonneesDemo>>

export function EnvironnementDemo() {
  const [donnees, setDonnees] = useState<DonneesDemo>(() => creerDonneesDemo())
  const [monte, setMonte] = useState(false)
  const [stockageDisponible, setStockageDisponible] = useState(true)
  const [annonceLocale, setAnnonceLocale] = useState('')

  useEffect(() => {
    try {
      const sauvegarde = window.localStorage.getItem(CLE_STOCKAGE)
      if (sauvegarde) {
        const valeur: unknown = JSON.parse(sauvegarde)
        if (estDonneeDemoValide(valeur)) setDonnees(valeur)
      }
    } catch {
      setStockageDisponible(false)
    } finally {
      setMonte(true)
    }
  }, [])

  useEffect(() => {
    if (!monte) return
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees))
      setStockageDisponible(true)
    } catch {
      setStockageDisponible(false)
    }
  }, [donnees, monte])

  const profil = PROFILS_DEMO.find((option) => option.id === donnees.profilId) ?? PROFILS_DEMO[1]
  const vue = TITRES_VUES[donnees.vue] ?? TITRES_VUES.tableau

  function choisirProfil(profilId: string) {
    const suivant = PROFILS_DEMO.find((option) => option.id === profilId)
    if (!suivant) return
    setAnnonceLocale('')
    setDonnees((precedent) => ({
      ...precedent,
      profilId: suivant.id,
      espace: suivant.role,
      vue: vueInitiale(suivant.role),
    }))
  }

  function choisirEspace(espace: EspaceDemo) {
    const profilParDefaut = PROFILS_DEMO.find((option) => option.id === profilInitial(espace))
    if (!profilParDefaut) return
    setAnnonceLocale('')
    setDonnees((precedent) => ({
      ...precedent,
      espace,
      profilId: profilParDefaut.id,
      vue: vueInitiale(espace),
    }))
  }

  function choisirVue(id: string) {
    setAnnonceLocale('')
    setDonnees((precedent) => ({ ...precedent, vue: id }))
  }

  function reinitialiser() {
    if (!window.confirm('Réinitialiser uniquement les données fictives de cette démonstration dans ce navigateur ?')) return
    const initial = creerDonneesDemo()
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(initial))
      setStockageDisponible(true)
    } catch {
      setStockageDisponible(false)
    }
    setDonnees(initial)
    setAnnonceLocale('Les données locales de démonstration ont été réinitialisées.')
  }

  const proprietaire = profil.role === 'pro' ? profil : PROFILS_DEMO[1]
  const bauxProfilPro = new Set(donnees.baux.filter((bail) => bail.proprietaireId === proprietaire.id).map((bail) => bail.id))
  const nombreImpayes = donnees.periodes.filter((periode) => bauxProfilPro.has(periode.bailId) && periode.statut === 'impaye').length

  return (
    <div className={styles.demoApp}>
      <a className={styles.skipLink} href="#contenu-demo">Aller au contenu de la démonstration</a>
      <aside className={styles.sidebar} aria-label="Navigation de la démonstration">
        <div className={styles.brandBlock}>
          <MarqueSikaloc href={null} taille="sm" surSombre />
          <span className={styles.brandCaption}>ESPACE DE PRÉSENTATION</span>
        </div>

        <div className={styles.spaceChooser} role="group" aria-label="Choisir un espace">
          {(['pro', 'me', 'find'] as const).map((espace) => (
            <button
              className={`${styles.spaceButton} ${donnees.espace === espace ? styles.spaceButtonActive : ''}`}
              type="button"
              key={espace}
              aria-pressed={donnees.espace === espace}
              onClick={() => choisirEspace(espace)}
            >
              {espace === 'pro' ? 'Pro' : espace === 'me' ? 'Me' : 'Find'}
            </button>
          ))}
        </div>

        <p className={styles.navLabel}>VOTRE ESPACE</p>
        <nav className={styles.sidebarNav} aria-label={`Navigation ${donnees.espace}`}>
          {NAVIGATION[donnees.espace].map(({ id, titre, icone: Icone }) => (
            <button
              key={id}
              type="button"
              className={`${styles.navButton} ${donnees.vue === id ? styles.navButtonActive : ''}`}
              aria-current={donnees.vue === id ? 'page' : undefined}
              onClick={() => choisirVue(id)}
            >
              <Icone size={18} aria-hidden="true" />
              <span>{titre}</span>
              {id === 'paiements' && donnees.espace === 'pro' && nombreImpayes > 0 ? <span className={styles.navCount}>{nombreImpayes}</span> : null}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarNote}>
          <span className={styles.noteDot} />
          <div>
            <strong>Mode local fictif</strong>
            <span>Aucun compte réel connecté</span>
          </div>
        </div>
      </aside>

      <main id="contenu-demo" className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}>
            <MarqueSikaloc href={null} taille="sm" surSombre className={styles.mobileLogo} />
            <span className={styles.demoPill}>DÉMO LOCALE</span>
          </div>
          <div className={styles.topbarContext}>
            <span className={styles.crumb}>Sikaloc / {donnees.espace === 'pro' ? 'Pro' : donnees.espace === 'me' ? 'Me' : 'Find'}</span>
            <span className={styles.demoPill}>DONNÉES FICTIVES</span>
          </div>
          <div className={styles.topbarActions}>
            <label className={styles.profileSelectLabel} htmlFor="demo-profile">Profil</label>
            <select id="demo-profile" className={styles.profileSelect} aria-label="Choisir un profil fictif" value={profil.id} onChange={(event) => choisirProfil(event.target.value)}>
              <optgroup label="Sikaloc Pro">
                {PROFILS_DEMO.filter((option) => option.role === 'pro').map((option) => <option key={option.id} value={option.id}>{option.nom} — {option.libelle}</option>)}
              </optgroup>
              <optgroup label="Sikaloc Me">
                {PROFILS_DEMO.filter((option) => option.role === 'me').map((option) => <option key={option.id} value={option.id}>{option.nom}</option>)}
              </optgroup>
              <optgroup label="Sikaloc Find">
                {PROFILS_DEMO.filter((option) => option.role === 'find').map((option) => <option key={option.id} value={option.id}>{option.nom}</option>)}
              </optgroup>
            </select>
            <button type="button" className={styles.resetButton} onClick={reinitialiser} aria-label="Réinitialiser les données de démonstration" title="Réinitialiser la démo locale">
              <RotateCcw size={16} aria-hidden="true" />
              <span>Réinitialiser</span>
            </button>
          </div>
        </header>

        <div className={styles.mobileNav} role="group" aria-label="Choisir un espace de démonstration">
          {(['pro', 'me', 'find'] as const).map((espace) => (
            <button key={espace} type="button" aria-pressed={donnees.espace === espace} onClick={() => choisirEspace(espace)}>
              {espace === 'pro' ? 'Pro' : espace === 'me' ? 'Me' : 'Find'}
            </button>
          ))}
        </div>
        <nav className={styles.mobileSectionNav} aria-label={`Pages de démonstration ${donnees.espace}`}>
          {NAVIGATION[donnees.espace].map(({ id, titre }) => <button key={id} type="button" aria-current={donnees.vue === id ? 'page' : undefined} onClick={() => choisirVue(id)}>{titre}</button>)}
        </nav>

        <div className={styles.contentWrap}>
          <div className={styles.disclaimer} role="note">
            <CircleAlert size={17} aria-hidden="true" />
            <p><strong>Démonstration uniquement.</strong> Les profils, logements, montants et documents sont fictifs. Les actions restent dans le stockage de ce navigateur ; aucun service Sikaloc réel n’est appelé.</p>
          </div>

          {annonceLocale ? <p className={styles.liveMessage} role="status">{annonceLocale}</p> : null}
          {!stockageDisponible ? <p className={styles.storageWarning} role="status">Le navigateur ne conserve pas les changements. La démo reste consultable, mais les actions ne seront pas mémorisées.</p> : null}

          <div className={styles.pageHeading}>
            <div>
              <p className={styles.kicker}>{donnees.espace === 'pro' ? 'GESTION LOCATIVE' : donnees.espace === 'me' ? 'ESPACE PERSONNEL' : 'RECHERCHE DE LOGEMENT'}</p>
              <h1>{vue.titre}</h1>
              <p className={styles.pageDescription}>{vue.description}</p>
            </div>
            <div className={styles.identity}>
              <span className={styles.avatar}>{initiales(profil.nom)}</span>
              <span><strong>{profil.nom}</strong><small>{profil.organisation ?? profil.libelle}</small></span>
            </div>
          </div>

          {donnees.espace === 'pro' && donnees.vue === 'tableau' ? <VueTableau donnees={donnees} profil={proprietaire} aller={choisirVue} /> : null}
          {donnees.espace === 'pro' && donnees.vue === 'logements' ? <VueLogements key={profil.id} donnees={donnees} profil={proprietaire} mettreAJour={setDonnees} annoncer={setAnnonceLocale} /> : null}
          {donnees.espace === 'pro' && donnees.vue === 'locataires' ? <VueLocataires donnees={donnees} profil={proprietaire} /> : null}
          {donnees.espace === 'pro' && donnees.vue === 'baux' ? <VueBaux donnees={donnees} profil={proprietaire} /> : null}
          {donnees.espace === 'pro' && donnees.vue === 'paiements' ? <VuePaiements key={profil.id} donnees={donnees} profil={proprietaire} mettreAJour={setDonnees} annoncer={setAnnonceLocale} /> : null}
          {donnees.espace === 'pro' && donnees.vue === 'documents' ? <VueDocuments key={profil.id} donnees={donnees} profil={proprietaire} /> : null}
          {donnees.espace === 'pro' && donnees.vue === 'candidatures' ? <VueCandidatures donnees={donnees} profil={proprietaire} mettreAJour={setDonnees} annoncer={setAnnonceLocale} /> : null}
          {donnees.espace === 'me' && ['accueil', 'loyers'].includes(donnees.vue) ? <VueMe donnees={donnees} profil={profil} vue={donnees.vue} /> : null}
          {donnees.espace === 'me' && donnees.vue === 'documents' ? <VueDocuments key={profil.id} donnees={donnees} profil={profil} /> : null}
          {donnees.espace === 'me' && donnees.vue === 'preferences' ? <VuePreferences donnees={donnees} profil={profil} mettreAJour={setDonnees} /> : null}
          {donnees.espace === 'find' && donnees.vue === 'catalogue' ? <VueCatalogue key={profil.id} donnees={donnees} profil={profil} mettreAJour={setDonnees} annoncer={setAnnonceLocale} /> : null}
          {donnees.espace === 'find' && donnees.vue === 'mes-candidatures' ? <VueMesCandidatures donnees={donnees} profil={profil} /> : null}

          <footer className={styles.footerNote}>
            <span>SIKALOC · ENVIRONNEMENT LOCAL DE DÉMONSTRATION</span>
            <span>Jeu fictif v1 · stockage navigateur</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

function vueInitiale(espace: EspaceDemo) {
  return espace === 'pro' ? 'tableau' : espace === 'me' ? 'accueil' : 'catalogue'
}

function profilInitial(espace: EspaceDemo) {
  return espace === 'pro' ? 'pro-actif' : espace === 'me' ? 'me-celestin' : 'find-amina'
}

function initiales(nom: string) {
  return nom.split(' ').filter(Boolean).slice(0, 2).map((partie) => partie[0]).join('').toUpperCase()
}

function PeriodeBadge({ statut }: { statut: PeriodeDemo['statut'] }) {
  const resultat = statutPeriode(statut)
  return <span className={`${styles.status} ${resultat.classe}`}><span />{resultat.libelle}</span>
}

function VueTableau({ donnees, profil, aller }: { donnees: DonneesDemo; profil: ProfilDemo; aller: (id: string) => void }) {
  const logements = donnees.logements.filter((logement) => logement.proprietaireId === profil.id)
  const baux = donnees.baux.filter((bail) => bail.proprietaireId === profil.id)
  const bailIds = new Set(baux.map((bail) => bail.id))
  const periodes = donnees.periodes.filter((periode) => bailIds.has(periode.bailId))
  const paiements = donnees.paiements.filter((paiement) => {
    const periode = donnees.periodes.find((element) => element.id === paiement.periodeId)
    return Boolean(periode && bailIds.has(periode.bailId))
  })
  const aCompleter = periodes.filter((periode) => periode.statut !== 'regle')
  const soldeOuvert = aCompleter.reduce((total, periode) => total + periode.montantDu - periode.montantRegle, 0)
  const paiementsDuMois = paiements.filter((paiement) => paiement.date.startsWith('2026-10')).reduce((total, paiement) => total + paiement.montant, 0)
  const alertes = aCompleter.slice(0, 4)
  const derniersPaiements = paiements.slice(-5).reverse()

  return <>
    <section className={styles.metricGrid} aria-label="Résumé du portefeuille fictif">
      <CarteMesure icone={Building2} label="Logements" valeur={String(logements.length)} note={`${logements.filter((item) => item.statut === 'occupe').length} occupés`} />
      <CarteMesure icone={ClipboardList} label="Baux actifs" valeur={String(baux.filter((bail) => bail.statut === 'actif').length)} note="dans ce portefeuille" />
      <CarteMesure icone={WalletCards} label="Enregistré en octobre" valeur={fcfa(paiementsDuMois)} note="données fictives" />
      <CarteMesure icone={ArrowDownRight} label="Solde à suivre" valeur={fcfa(soldeOuvert)} note={`${aCompleter.length} périodes à compléter`} accent />
    </section>

    <section className={styles.dashboardGrid}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><p className={styles.panelEyebrow}>SUIVI DES LOYERS</p><h2>Échéances à regarder</h2></div>
          <button className={styles.textAction} type="button" onClick={() => aller('paiements')}>Tout voir <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
        {alertes.length ? <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th>Période</th><th>Logement · locataire</th><th>Solde</th><th>État</th></tr></thead>
          <tbody>{alertes.map((periode) => {
            const bail = obtenirBail(donnees, periode.bailId)
            const logement = bail ? obtenirLogement(donnees, bail.logementId) : undefined
            return <tr key={periode.id}><td>{periode.mois}</td><td><strong>{logement?.titre}</strong><small>{nomLocataire(bail?.locataireId ?? '')}</small></td><td className={styles.amount}>{fcfa(periode.montantDu - periode.montantRegle)}</td><td><PeriodeBadge statut={periode.statut} /></td></tr>
          })}</tbody>
        </table></div> : <EtatSimple titre="Aucune période à compléter" texte="Toutes les périodes de ce portefeuille sont réglées dans ce jeu de démonstration." />}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>ACTIVITÉ RÉCENTE</p><h2>Derniers versements</h2></div></div>
        <div className={styles.activityList}>{derniersPaiements.map((paiement) => {
          const periode = donnees.periodes.find((item) => item.id === paiement.periodeId)
          const bail = periode ? obtenirBail(donnees, periode.bailId) : undefined
          const logement = bail ? obtenirLogement(donnees, bail.logementId) : undefined
          return <div className={styles.activityRow} key={paiement.id}><span className={styles.activityIcon}><WalletCards size={17} aria-hidden="true" /></span><span><strong>{logement?.titre ?? 'Logement fictif'}</strong><small>{periode?.mois} · {paiement.moyen}</small></span><b>{fcfa(paiement.montant)}</b></div>
        })}</div>
        <div className={styles.panelFooter}>Les versements sont des exemples de démonstration.</div>
      </div>
    </section>

    <section className={styles.calloutPanel}>
      <div className={styles.calloutIcon}><CalendarDays size={21} aria-hidden="true" /></div>
      <div><p className={styles.panelEyebrow}>RACCOURCI DE PRÉSENTATION</p><h2>Un portefeuille lisible, du logement au document.</h2><p>Parcourez les baux, retrouvez les versements associés et ouvrez les aperçus fictifs.</p></div>
      <button type="button" className={styles.primaryButton} onClick={() => aller('documents')}>Voir les documents <ArrowRight size={16} aria-hidden="true" /></button>
    </section>
  </>
}

function CarteMesure({ icone: Icone, label, valeur, note, accent = false }: { icone: typeof Home; label: string; valeur: string; note: string; accent?: boolean }) {
  return <article className={`${styles.metricCard} ${accent ? styles.metricAccent : ''}`}><div className={styles.metricTop}><span>{label}</span><Icone size={18} aria-hidden="true" /></div><strong>{valeur}</strong><small>{note}</small></article>
}

function EtatSimple({ titre, texte }: { titre: string; texte: string }) {
  return <div className={styles.emptyState}><Check size={20} aria-hidden="true" /><strong>{titre}</strong><span>{texte}</span></div>
}

function VueLogements({ donnees, profil, mettreAJour, annoncer }: { donnees: DonneesDemo; profil: ProfilDemo; mettreAJour: MiseAJourDemo; annoncer: (message: string) => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [titre, setTitre] = useState('')
  const [ville, setVille] = useState('Cotonou')
  const [loyer, setLoyer] = useState('')
  const [type, setType] = useState('Appartement')
  const logements = donnees.logements.filter((logement) => logement.proprietaireId === profil.id)

  function ajouter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const montant = Number(loyer)
    if (!titre.trim() || !montant || montant < 10000) return
    const nouveau: LogementDemo = {
      id: `log-local-${Date.now()}`,
      proprietaireId: profil.id,
      titre: titre.trim(),
      ville,
      quartier: 'Quartier de démonstration',
      type,
      loyer: montant,
      chambres: type === 'Studio' || type === 'Chambre' ? 1 : 2,
      surface: 48,
      statut: 'disponible',
      publie: false,
      description: 'Logement ajouté dans la démonstration locale uniquement.',
      equipements: ['Visuel illustratif'],
    }
    mettreAJour((precedent) => ({ ...precedent, logements: [nouveau, ...precedent.logements] }))
    setTitre('')
    setLoyer('')
    setOuvert(false)
    annoncer('Logement fictif ajouté à ce navigateur uniquement. Il n’est pas publié sur Find.')
  }

  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>PORTEFEUILLE · {logements.length} LOGEMENTS</p><h2>Les biens de {profil.nom}</h2></div><button type="button" className={styles.primaryButton} onClick={() => setOuvert(!ouvert)}><Plus size={16} aria-hidden="true" /> Ajouter un logement fictif</button></div>
    {ouvert ? <form className={styles.inlineForm} onSubmit={ajouter}>
      <label>Nom d’affichage<input className={styles.control} value={titre} onChange={(event) => setTitre(event.target.value)} required placeholder="Ex. Appartement des Hibiscus" /></label>
      <label>Ville<select className={styles.control} value={ville} onChange={(event) => setVille(event.target.value)}><option>Cotonou</option><option>Abomey-Calavi</option><option>Porto-Novo</option><option>Ouidah</option><option>Parakou</option><option>Bohicon</option></select></label>
      <label>Type<select className={styles.control} value={type} onChange={(event) => setType(event.target.value)}><option>Appartement</option><option>Studio</option><option>Maison</option><option>Chambre</option></select></label>
      <label>Loyer mensuel indicatif<input className={styles.control} type="number" min="10000" step="5000" value={loyer} onChange={(event) => setLoyer(event.target.value)} required placeholder="100000" /></label>
      <div className={styles.formActions}><span>Action locale : aucune annonce réelle ne sera créée.</span><button className={styles.primaryButton} type="submit">Ajouter à la démo</button></div>
    </form> : null}
    <div className={styles.propertyGrid}>{logements.map((logement, index) => <article className={styles.propertyCard} key={logement.id}>
      <IllustrationLogement index={index} />
      <div className={styles.propertyContent}><div className={styles.propertyTitle}><div><h3>{logement.titre}</h3><span><MapPin size={13} aria-hidden="true" />{logement.quartier}, {logement.ville}</span></div><span className={`${styles.status} ${logement.statut === 'occupe' ? styles.statusPaid : styles.statusNeutral}`}><span />{logement.statut === 'occupe' ? 'Occupé' : 'Disponible'}</span></div>
        <div className={styles.propertyMeta}><span>{logement.type}</span><span>{logement.chambres} pièce{logement.chambres > 1 ? 's' : ''}</span><strong>{fcfa(logement.loyer)}<small>/ mois</small></strong></div>
        <p>{logement.description}</p>
      </div>
    </article>)}</div>
  </section>
}

function IllustrationLogement({ index }: { index: number }) {
  const palette = [styles.sceneSage, styles.sceneLime, styles.sceneCream, styles.sceneDeep]
  return <div className={`${styles.listingScene} ${palette[index % palette.length]}`} role="img" aria-label="Illustration architecturale d’un logement fictif, non photographique">
    <span className={styles.sceneTag}>ILLUSTRATION · BIEN FICTIF</span>
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <circle cx="256" cy="34" r="20" className={styles.sceneSun} />
      <path d="M0 124c45-24 80-12 122-7 52 6 113-28 198-5v38H0z" className={styles.sceneGround} />
      <path d="m59 75 57-43 59 43v52H59z" className={styles.sceneBuilding} />
      <path d="m49 76 67-51 69 51" className={styles.sceneRoof} />
      <path d="M82 79h20v22H82zM127 79h20v22h-20zM104 103h25v24h-25z" className={styles.sceneWindow} />
      <path d="M190 88h44v39h-44zM185 88l27-20 28 20" className={styles.sceneSideBuilding} />
    </svg>
    <span className={styles.sceneCaption}>Visuel de présentation, pas une photo</span>
  </div>
}

function VueLocataires({ donnees, profil }: { donnees: DonneesDemo; profil: ProfilDemo }) {
  const baux = donnees.baux.filter((bail) => bail.proprietaireId === profil.id)
  const ids = new Set(baux.map((bail) => bail.locataireId))
  const locataires = LOCATAIRES_DEMO.filter((locataire) => ids.has(locataire.id))
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>DOSSIERS LOCATAIRES</p><h2>{locataires.length} profils liés aux baux</h2></div><span className={styles.demoPill}>IDENTITÉS FICTIVES</span></div>
    <div className={styles.peopleList}>{locataires.map((locataire) => {
      const bauxDuLocataire = baux.filter((bail) => bail.locataireId === locataire.id)
      const bailCourant = bauxDuLocataire.find((bail) => bail.statut === 'actif') ?? bauxDuLocataire[0]
      const logement = obtenirLogement(donnees, bailCourant.logementId)
      const profilMe = PROFILS_DEMO.find((option) => option.id === locataire.profilId)
      return <article className={styles.personRow} key={locataire.id}><span className={styles.avatar}>{initiales(locataire.nom)}</span><div className={styles.personMain}><strong>{locataire.nom}</strong><span>{profilMe?.libelle} · coordonnées volontairement omises</span></div><div className={styles.personProperty}><small>LOGEMENT ASSOCIÉ</small><strong>{logement?.titre}</strong><span>{logement?.ville}</span></div><span className={`${styles.status} ${bauxDuLocataire.some((bail) => bail.statut === 'actif') ? styles.statusPaid : styles.statusNeutral}`}><span />{bauxDuLocataire.some((bail) => bail.statut === 'actif') ? 'Bail actif' : 'Historique'}</span></article>
    })}</div>
  </section>
}

function VueBaux({ donnees, profil }: { donnees: DonneesDemo; profil: ProfilDemo }) {
  const baux = donnees.baux.filter((bail) => bail.proprietaireId === profil.id)
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>CONTRATS LOCATIFS</p><h2>{baux.length} baux dans ce portefeuille</h2></div><span className={styles.panelHint}>Aperçus de démonstration · sans valeur contractuelle</span></div>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Logement</th><th>Locataire fictif</th><th>Début</th><th>Loyer / mois</th><th>État</th></tr></thead><tbody>{baux.map((bail) => { const logement = obtenirLogement(donnees, bail.logementId); return <tr key={bail.id}><td><strong>{logement?.titre}</strong><small>{logement?.ville} · {logement?.quartier}</small></td><td>{nomLocataire(bail.locataireId)}</td><td>{dateLisible(bail.debut)}</td><td className={styles.amount}>{fcfa(bail.loyer)}</td><td><span className={`${styles.status} ${bail.statut === 'actif' ? styles.statusPaid : styles.statusNeutral}`}><span />{bail.statut === 'actif' ? 'Actif' : 'Terminé'}</span></td></tr> })}</tbody></table></div>
  </section>
}

function dateLisible(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function VuePaiements({ donnees, profil, mettreAJour, annoncer }: { donnees: DonneesDemo; profil: ProfilDemo; mettreAJour: MiseAJourDemo; annoncer: (message: string) => void }) {
  const baux = donnees.baux.filter((bail) => bail.proprietaireId === profil.id)
  const ids = new Set(baux.map((bail) => bail.id))
  const periodes = donnees.periodes.filter((periode) => ids.has(periode.bailId)).sort((a, b) => b.echeance.localeCompare(a.echeance))
  const restantes = periodes.filter((periode) => periode.statut !== 'regle')
  const [periodeId, setPeriodeId] = useState(restantes[0]?.id ?? '')
  const periodeChoisie = restantes.find((periode) => periode.id === periodeId) ?? restantes[0]
  const reste = periodeChoisie ? periodeChoisie.montantDu - periodeChoisie.montantRegle : 0
  const [montant, setMontant] = useState(reste ? String(reste) : '')
  const paiements = donnees.paiements.filter((paiement) => donnees.periodes.some((periode) => periode.id === paiement.periodeId && ids.has(periode.bailId))).slice().reverse()

  function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cible = restantes.find((periode) => periode.id === periodeId) ?? restantes[0]
    const valeur = Math.floor(Number(montant))
    if (!cible || !Number.isFinite(valeur) || valeur <= 0 || valeur > cible.montantDu - cible.montantRegle) {
      annoncer('Montant non enregistré : saisissez un versement positif inférieur ou égal au solde fictif.')
      return
    }
    const paiementId = `paiement-local-${Date.now()}`
    const montantApres = cible.montantRegle + valeur
    const nouvellePeriode: PeriodeDemo = { ...cible, montantRegle: montantApres, statut: montantApres >= cible.montantDu ? 'regle' : 'partiel' }

    mettreAJour((precedent) => ({
      ...precedent,
      periodes: precedent.periodes.map((periode) => periode.id === cible.id ? nouvellePeriode : periode),
      paiements: [...precedent.paiements, { id: paiementId, periodeId: cible.id, date: '2026-10-22', montant: valeur, moyen: 'Versement de démonstration' }],
    }))
    setMontant('')
    annoncer('Versement fictif ajouté au navigateur. Aucun reçu ni quittance n’est généré automatiquement dans cette simulation.')
  }

  return <div className={styles.stack}>
    <section className={styles.paymentComposer}>
      <div className={styles.paymentComposerIntro}><span className={styles.paymentIcon}><WalletCards size={21} aria-hidden="true" /></span><p className={styles.panelEyebrow}>OPÉRATION LOCALE</p><h2>Ajouter un versement de démonstration</h2><p>Cette action modifie uniquement le jeu fictif conservé dans ce navigateur. Elle n’appelle pas le flux de paiement réel.</p></div>
      <form className={styles.paymentForm} onSubmit={enregistrer}>
        <label>Période concernée<select className={styles.control} value={periodeChoisie?.id ?? ''} onChange={(event) => { setPeriodeId(event.target.value); const cible = restantes.find((item) => item.id === event.target.value); setMontant(cible ? String(cible.montantDu - cible.montantRegle) : '') }} disabled={!restantes.length}>
          {restantes.length ? restantes.map((periode) => { const bail = obtenirBail(donnees, periode.bailId); const logement = bail ? obtenirLogement(donnees, bail.logementId) : undefined; return <option key={periode.id} value={periode.id}>{periode.mois} · {logement?.titre} · solde {fcfa(periode.montantDu - periode.montantRegle)}</option> }) : <option value="">Aucune période ouverte</option>}
        </select></label>
        <label>Montant du versement<input className={styles.control} type="number" min="1" max={reste || undefined} value={montant} onChange={(event) => setMontant(event.target.value)} placeholder="Montant en FCFA" disabled={!periodeChoisie} /></label>
        <button type="submit" className={styles.primaryButton} disabled={!periodeChoisie}><Plus size={16} aria-hidden="true" /> Ajouter le versement</button>
      </form>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>HISTORIQUE FICTIF</p><h2>Échéances et versements</h2></div><span className={styles.panelHint}>{periodes.length} périodes · montants indicatifs</span></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Période</th><th>Logement · locataire</th><th>Montant attendu</th><th>Déjà réglé</th><th>Solde</th><th>État</th></tr></thead><tbody>{periodes.map((periode) => { const bail = obtenirBail(donnees, periode.bailId); const logement = bail ? obtenirLogement(donnees, bail.logementId) : undefined; return <tr key={periode.id}><td>{periode.mois}</td><td><strong>{logement?.titre}</strong><small>{nomLocataire(bail?.locataireId ?? '')}</small></td><td className={styles.amount}>{fcfa(periode.montantDu)}</td><td className={styles.amount}>{fcfa(periode.montantRegle)}</td><td className={styles.amount}>{fcfa(periode.montantDu - periode.montantRegle)}</td><td><PeriodeBadge statut={periode.statut} /></td></tr> })}</tbody></table></div>
    </section>
    <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>VERSEMENTS ENREGISTRÉS</p><h2>{paiements.length} lignes d’historique</h2></div></div><div className={styles.transactionList}>{paiements.slice(0, 12).map((paiement) => { const periode = donnees.periodes.find((item) => item.id === paiement.periodeId); const bail = periode ? obtenirBail(donnees, periode.bailId) : undefined; const logement = bail ? obtenirLogement(donnees, bail.logementId) : undefined; return <div className={styles.transactionRow} key={paiement.id}><span className={styles.transactionMark}><Check size={16} aria-hidden="true" /></span><span><strong>{logement?.titre ?? 'Logement fictif'} · {periode?.mois}</strong><small>{dateLisible(paiement.date)} · {paiement.moyen}</small></span><b>{fcfa(paiement.montant)}</b></div> })}</div></section>
  </div>
}

function VueDocuments({ donnees, profil }: { donnees: DonneesDemo; profil: ProfilDemo }) {
  const profilMe = profil.role === 'me' ? LOCATAIRES_DEMO.find((locataire) => locataire.profilId === profil.id) : undefined
  const bauxVisibles = donnees.baux.filter((bail) => profil.role === 'pro' ? bail.proprietaireId === profil.id : bail.locataireId === profilMe?.id)
  const bailIds = new Set(bauxVisibles.map((bail) => bail.id))
  const documents = donnees.documents.filter((document) => bailIds.has(document.bailId)).slice().reverse()
  const [documentChoisi, setDocumentChoisi] = useState<DocumentDemo | null>(null)

  return <div className={styles.documentLayout}>
    <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>ARCHIVE LOCALE</p><h2>{documents.length} documents fictifs</h2></div><span className={styles.demoPill}>APERÇUS UNIQUEMENT</span></div>
      <div className={styles.documentList}>{documents.map((document) => <button type="button" key={document.id} className={`${styles.documentRow} ${documentChoisi?.id === document.id ? styles.documentSelected : ''}`} onClick={() => setDocumentChoisi(document)}><span className={styles.documentIcon}><FileText size={18} aria-hidden="true" /></span><span><strong>{document.titre}</strong><small>{document.reference} · {dateLisible(document.date)}</small></span><span className={styles.documentType}>{document.type}</span><ArrowRight size={16} aria-hidden="true" /></button>)}</div>
    </section>
    <aside className={styles.documentPreview}>
      {documentChoisi ? <>
        <div className={styles.documentPaper}><div className={styles.fakeDocBrand}>SIKALOC<span>_</span></div><p className={styles.fakeDocStamp}>DÉMONSTRATION<br />DOCUMENT FICTIF</p><p className={styles.fakeDocType}>{documentChoisi.type.toUpperCase()}</p><h3>{documentChoisi.titre}</h3><div className={styles.fakeDocLines}><span /><span /><span /></div><div className={styles.fakeDocAmount}>{documentChoisi.montant ? fcfa(documentChoisi.montant) : 'Exemple contractuel'}</div><div className={styles.fakeDocReference}>{documentChoisi.reference}</div></div>
        <p className={styles.previewNotice}>Aperçu de présentation uniquement. Aucun PDF officiel n’est généré ni téléchargeable depuis la démo.</p>
      </> : <div className={styles.previewEmpty}><FileText size={28} aria-hidden="true" /><strong>Choisissez un document</strong><span>Chaque aperçu porte une mention visible de démonstration.</span></div>}
    </aside>
  </div>
}

function VueCandidatures({ donnees, profil, mettreAJour, annoncer }: { donnees: DonneesDemo; profil: ProfilDemo; mettreAJour: MiseAJourDemo; annoncer: (message: string) => void }) {
  const logements = new Set(donnees.logements.filter((logement) => logement.proprietaireId === profil.id).map((logement) => logement.id))
  const candidatures = donnees.candidatures.filter((candidature) => logements.has(candidature.logementId)).slice().reverse()
  function changerStatut(candidatureId: string, statut: StatutCandidatureDemo) {
    mettreAJour((precedent) => ({ ...precedent, candidatures: precedent.candidatures.map((candidature) => candidature.id === candidatureId ? { ...candidature, statut } : candidature) }))
    annoncer('Statut de candidature modifié dans la démonstration locale. Aucun bail n’est créé automatiquement.')
  }
  return <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>DEMANDES REÇUES</p><h2>{candidatures.length} candidatures fictives</h2></div><span className={styles.panelHint}>Le statut ne crée pas de bail.</span></div>
    <div className={styles.applicationList}>{candidatures.map((candidature) => { const logement = obtenirLogement(donnees, candidature.logementId); return <article className={styles.applicationCard} key={candidature.id}><div className={styles.applicationHead}><span className={styles.avatar}>{initiales(nomCandidat(candidature.candidatId))}</span><div><strong>{nomCandidat(candidature.candidatId)}</strong><small>{logement?.titre} · {logement?.ville}</small></div><span className={`${styles.status} ${candidature.statut === 'acceptee' ? styles.statusPaid : candidature.statut === 'refusee' ? styles.statusNeutral : styles.statusPartial}`}><span />{statutCandidature(candidature.statut)}</span></div><p>« {candidature.message} »</p><div className={styles.applicationActions}><button type="button" className={styles.secondaryButton} onClick={() => changerStatut(candidature.id, 'a_etudier')}>À examiner</button><button type="button" className={styles.primaryButton} onClick={() => changerStatut(candidature.id, 'acceptee')}>Réponse positive</button><button type="button" className={styles.textAction} onClick={() => changerStatut(candidature.id, 'refusee')}>Clôturer</button></div></article> })}</div>
  </section>
}

function VueMe({ donnees, profil, vue }: { donnees: DonneesDemo; profil: ProfilDemo; vue: string }) {
  const locataire = LOCATAIRES_DEMO.find((item) => item.profilId === profil.id)
  const baux = donnees.baux.filter((bail) => bail.locataireId === locataire?.id)
  const bailPrincipal = baux.find((bail) => bail.statut === 'actif') ?? baux[0]
  const logement = bailPrincipal ? obtenirLogement(donnees, bailPrincipal.logementId) : undefined
  const bailIds = new Set(baux.map((bail) => bail.id))
  const periodes = donnees.periodes.filter((periode) => bailIds.has(periode.bailId)).slice().reverse()
  const versements = donnees.paiements.filter((paiement) => donnees.periodes.some((periode) => periode.id === paiement.periodeId && bailIds.has(periode.bailId))).slice().reverse()
  return <div className={styles.stack}>
    {vue === 'accueil' ? <section className={styles.tenantHero}><div><p className={styles.panelEyebrow}>VOTRE ESPACE · APERÇU FICTIF</p><h2>Les informations de votre location, réunies ici.</h2><p>Dans cette démo, votre bailleur et votre bail sont reliés au même jeu de données fictif.</p></div><div className={styles.tenantHomeCard}><span className={styles.homeMark}><Home size={20} aria-hidden="true" /></span><small>MON LOGEMENT</small><strong>{logement?.titre ?? 'Aucun logement associé'}</strong><span>{logement?.quartier}, {logement?.ville}</span><b>{bailPrincipal ? fcfa(bailPrincipal.loyer) : '—'} <small>/ mois</small></b></div></section> : null}
    <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>MON BAIL</p><h2>{baux.length} contrat{baux.length > 1 ? 's' : ''} associé{baux.length > 1 ? 's' : ''}</h2></div><span className={styles.panelHint}>Données fictives consultables en lecture</span></div>
      <div className={styles.tenantLeaseRows}>{baux.map((bail) => { const bien = obtenirLogement(donnees, bail.logementId); return <article key={bail.id}><span className={styles.documentIcon}><ClipboardList size={18} aria-hidden="true" /></span><span><strong>{bien?.titre}</strong><small>{bien?.ville} · depuis le {dateLisible(bail.debut)}{bail.fin ? ` · fin le ${dateLisible(bail.fin)}` : ''}</small></span><span className={`${styles.status} ${bail.statut === 'actif' ? styles.statusPaid : styles.statusNeutral}`}><span />{bail.statut === 'actif' ? 'Actif' : 'Terminé'}</span><b>{fcfa(bail.loyer)}</b></article> })}</div>
    </section>
    <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>ÉCHÉANCES</p><h2>Historique de loyer</h2></div><span className={styles.panelHint}>Un état inconnu ne serait pas qualifié d’impayé.</span></div>
      <div className={styles.tenantPeriodList}>{periodes.map((periode) => <div key={periode.id} className={styles.tenantPeriod}><span><strong>{periode.mois}</strong><small>{obtenirBail(donnees, periode.bailId)?.id}</small></span><span><strong>{fcfa(periode.montantDu)}</strong><small>Réglé : {fcfa(periode.montantRegle)}</small></span><PeriodeBadge statut={periode.statut} /></div>)}</div>
    </section>
    <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>PAIEMENTS</p><h2>{versements.length} versements dans l’historique</h2></div></div><div className={styles.transactionList}>{versements.slice(0, 8).map((paiement) => { const periode = donnees.periodes.find((item) => item.id === paiement.periodeId); return <div className={styles.transactionRow} key={paiement.id}><span className={styles.transactionMark}><Check size={16} aria-hidden="true" /></span><span><strong>{periode?.mois}</strong><small>{dateLisible(paiement.date)} · {paiement.moyen}</small></span><b>{fcfa(paiement.montant)}</b></div> })}</div></section>
    <p className={styles.inlineNote}>Les accès réels de Sikaloc Me dépendent d’un compte et d’une invitation valides. Ce sélecteur local ne crée aucun accès réel.</p>
  </div>
}

function VuePreferences({ donnees, profil, mettreAJour }: { donnees: DonneesDemo; profil: ProfilDemo; mettreAJour: MiseAJourDemo }) {
  return <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>RÉGLAGE DE DÉMONSTRATION</p><h2>Préférence locale</h2></div><span className={styles.demoPill}>NON TRANSMISE</span></div><label className={styles.toggleRow}><span><strong>Afficher les exemples de notifications</strong><small>Ce réglage ne contacte aucun service et ne modifie pas un vrai profil.</small></span><input type="checkbox" checked={donnees.notificationLocaleParProfil[profil.id] ?? true} onChange={(event) => mettreAJour((precedent) => ({ ...precedent, notificationLocaleParProfil: { ...precedent.notificationLocaleParProfil, [profil.id]: event.target.checked } }))} /></label><div className={styles.preferenceInfo}><BadgeCheck size={18} aria-hidden="true" /><span>Le profil locataire sélectionné consulte les informations associées dans le jeu fictif. Les préférences réelles restent inchangées.</span></div></section>
}

function VueCatalogue({ donnees, profil, mettreAJour, annoncer }: { donnees: DonneesDemo; profil: ProfilDemo; mettreAJour: MiseAJourDemo; annoncer: (message: string) => void }) {
  const [selection, setSelection] = useState('')
  const candidat = CANDIDATS_DEMO.find((item) => item.id === profil.id)
  const villes = Array.from(new Set(donnees.logements.filter((logement) => logement.publie).map((logement) => logement.ville)))
  const resultats = donnees.logements.filter((logement) => logement.publie)
    .filter((logement) => !donnees.filtreVille || logement.ville === donnees.filtreVille)
    .filter((logement) => !donnees.filtreType || logement.type === donnees.filtreType)
    .filter((logement) => !donnees.plafondLoyer || logement.loyer <= Number(donnees.plafondLoyer))
    .filter((logement) => !donnees.recherche || `${logement.titre} ${logement.quartier} ${logement.ville}`.toLowerCase().includes(donnees.recherche.toLowerCase()))
  const logementSelectionne = resultats.find((logement) => logement.id === selection)
  const candidatureExistante = donnees.candidatures.find((candidature) => candidature.logementId === logementSelectionne?.id && candidature.candidatId === profil.id)

  function postuler() {
    if (!logementSelectionne || !candidat) return
    if (candidatureExistante) {
      annoncer('Ce profil fictif possède déjà une candidature pour cette annonce.')
      return
    }
    const nouvelle: CandidatureDemo = { id: `cand-local-${Date.now()}`, logementId: logementSelectionne.id, candidatId: profil.id, date: '2026-10-22', statut: 'nouvelle', message: 'Candidature créée pendant la démonstration locale.' }
    mettreAJour((precedent) => ({ ...precedent, candidatures: [...precedent.candidatures, nouvelle] }))
    annoncer('Candidature fictive envoyée au jeu local. Elle apparaîtra dans Pro, sans créer de bail.')
  }

  return <div className={styles.stack}>
    <section className={styles.findFilters}>
      <label className={styles.searchField}><span>Rechercher</span><span className={styles.inputWithIcon}><Search size={17} aria-hidden="true" /><input className={styles.control} value={donnees.recherche} onChange={(event) => mettreAJour((precedent) => ({ ...precedent, recherche: event.target.value }))} placeholder="Quartier, ville ou logement" /></span></label>
      <label>Ville<select className={styles.control} value={donnees.filtreVille} onChange={(event) => mettreAJour((precedent) => ({ ...precedent, filtreVille: event.target.value }))}><option value="">Toutes les villes</option>{villes.map((ville) => <option key={ville}>{ville}</option>)}</select></label>
      <label>Type<select className={styles.control} value={donnees.filtreType} onChange={(event) => mettreAJour((precedent) => ({ ...precedent, filtreType: event.target.value }))}><option value="">Tous les types</option>{['Studio', 'Chambre', 'Appartement', 'Maison'].map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>Loyer max.<select className={styles.control} value={donnees.plafondLoyer} onChange={(event) => mettreAJour((precedent) => ({ ...precedent, plafondLoyer: event.target.value }))}><option value="">Sans plafond</option><option value="60000">60 000 FCFA</option><option value="100000">100 000 FCFA</option><option value="150000">150 000 FCFA</option><option value="200000">200 000 FCFA</option></select></label>
    </section>
    <div className={styles.resultsHeading}><div><p className={styles.panelEyebrow}>ANNONCES PUBLIÉES DANS LA DÉMO</p><h2>{resultats.length} logement{resultats.length === 1 ? '' : 's'} à découvrir</h2></div><span>Disponibilités fictives · aucune photo de bien</span></div>
    {resultats.length ? <section className={styles.findGrid}>{resultats.map((logement, index) => <article className={`${styles.findCard} ${selection === logement.id ? styles.findCardSelected : ''}`} key={logement.id}>
      <IllustrationLogement index={index} /><div className={styles.findCardContent}><span className={styles.findType}>{logement.type} · {logement.chambres} pièce{logement.chambres > 1 ? 's' : ''}</span><h3>{logement.titre}</h3><span className={styles.findLocation}><MapPin size={14} aria-hidden="true" />{logement.quartier}, {logement.ville}</span><p>{logement.description}</p><div className={styles.findCardBottom}><strong>{fcfa(logement.loyer)}<small>/ mois</small></strong><button type="button" className={styles.secondaryButton} onClick={() => setSelection(selection === logement.id ? '' : logement.id)}>{selection === logement.id ? 'Fermer' : 'Détails'} <ArrowRight size={14} aria-hidden="true" /></button></div>{selection === logement.id ? <div className={styles.listingDetails}><p><strong>Équipements de démonstration</strong></p><span>{logement.equipements.join(' · ')}</span><p>{logement.surface} m² environ · informations fictives</p><button type="button" className={styles.primaryButton} onClick={postuler} disabled={Boolean(candidatureExistante)}>{candidatureExistante ? 'Candidature déjà présente' : 'Déposer une candidature fictive'}</button><small>Une candidature ne crée pas automatiquement de bail.</small></div> : null}</div>
    </article>)}</section> : <EtatSimple titre="Aucune annonce ne correspond" texte="Modifiez ou effacez les filtres pour voir d’autres logements fictifs." />}
  </div>
}

function VueMesCandidatures({ donnees, profil }: { donnees: DonneesDemo; profil: ProfilDemo }) {
  const candidatures = donnees.candidatures.filter((candidature) => candidature.candidatId === profil.id).slice().reverse()
  return <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>SUIVI CANDIDAT</p><h2>{candidatures.length} candidatures fictives</h2></div><span className={styles.panelHint}>Une réponse positive ne crée pas de bail.</span></div>
    {candidatures.length ? <div className={styles.applicationList}>{candidatures.map((candidature) => { const logement = obtenirLogement(donnees, candidature.logementId); return <article className={styles.applicationCard} key={candidature.id}><div className={styles.applicationHead}><span className={styles.documentIcon}><Home size={18} aria-hidden="true" /></span><div><strong>{logement?.titre}</strong><small>{logement?.quartier}, {logement?.ville} · envoyée le {dateLisible(candidature.date)}</small></div><span className={`${styles.status} ${candidature.statut === 'acceptee' ? styles.statusPaid : candidature.statut === 'refusee' ? styles.statusNeutral : styles.statusPartial}`}><span />{statutCandidature(candidature.statut)}</span></div><p>{candidature.message}</p></article> })}</div> : <EtatSimple titre="Pas encore de candidature" texte="Passez au catalogue, choisissez une annonce fictive et essayez le parcours local." />}
  </section>
}
