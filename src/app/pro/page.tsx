import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ApercuQuittanceDemonstration } from '@/components/marketing/apercu-quittance-demonstration'
import { EnTetePublic, LIENS_PRO, LIENS_TIROIR_PRO } from '@/components/marketing/en-tete-public'
import { FormulaireGuide } from '@/components/marketing/formulaire-guide'
import { PiedDePage } from '@/components/marketing/pied-de-page'
import { WidgetWhatsApp } from '@/components/marketing/widget-whatsapp'
import { formaterFCFA } from '@/lib/format'
import { LIMITE_LOGEMENTS_GRATUIT, PRIX_STANDARD_FCFA } from '@/lib/plan'
import { ESPACE_PRO } from '@/lib/roles'
import { creerClientServeur, obtenirUtilisateur } from '@/lib/supabase/serveur'
import type { Bailleur } from '@/lib/types/database'
import { etatVerification } from '@/lib/verification/etat'

const manropePro = localFont({
  src: [
    { path: '../fonts/Manrope-PDF-Regular.ttf', weight: '400' },
    { path: '../fonts/Manrope-PDF-Medium.ttf', weight: '500' },
    { path: '../fonts/Manrope-PDF-SemiBold.ttf', weight: '600' },
    { path: '../fonts/Manrope-PDF-Bold.ttf', weight: '700' },
    { path: '../fonts/Manrope-PDF-Extrabold.ttf', weight: '800' },
  ],
  variable: '--font-pro-display',
  display: 'swap',
  preload: false,
})

const TITRE_PRO = `Gestion locative au Bénin — ${ESPACE_PRO.nom}`
const DESCRIPTION_PRO =
  'Organisez vos logements, locataires et baux, suivez les paiements enregistrés et retrouvez les documents disponibles avec Sikaloc Pro.'

export const metadata: Metadata = {
  title: { absolute: TITRE_PRO },
  description: DESCRIPTION_PRO,
  alternates: { canonical: '/pro' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Sikaloc',
    url: '/pro',
    title: TITRE_PRO,
    description: DESCRIPTION_PRO,
  },
  twitter: { card: 'summary_large_image', title: TITRE_PRO, description: DESCRIPTION_PRO },
}

const situations = [
  {
    numero: '01',
    titre: 'Retrouver le bon contexte',
    texte: 'Un logement, un bail, un locataire : les informations restent reliées à la location concernée.',
  },
  {
    numero: '02',
    titre: 'Suivre les périodes',
    texte: 'Consultez les paiements enregistrés et repérez les périodes qui demandent encore votre attention.',
  },
  {
    numero: '03',
    titre: 'Rassembler les documents',
    texte: 'Retrouvez les reçus et quittances disponibles avec le paiement et la période correspondants.',
  },
]

const etapes = [
  {
    numero: '01',
    titre: 'Ajoutez votre logement',
    texte: 'Renseignez les informations du bien pour préparer son suivi.',
  },
  {
    numero: '02',
    titre: 'Associez locataire et bail',
    texte: 'Reliez les personnes, le logement et les conditions de la location.',
  },
  {
    numero: '03',
    titre: 'Suivez paiements et documents',
    texte: 'Consultez les versements enregistrés et les documents disponibles pour chaque période.',
  },
]

const questions = [
  {
    q: 'Puis-je commencer gratuitement ?',
    r: `Oui. Le plan Gratuit permet de gérer jusqu’à ${LIMITE_LOGEMENTS_GRATUIT} logements. Il ne nécessite pas de souscrire au plan Standard pour commencer.`,
  },
  {
    q: 'Combien de logements puis-je gérer ?',
    r: `Le plan Gratuit est limité à ${LIMITE_LOGEMENTS_GRATUIT} logements. Le plan Standard, à ${formaterFCFA(PRIX_STANDARD_FCFA)} par mois, permet d’en enregistrer sans plafond tant que l’abonnement est actif.`,
  },
  {
    q: 'Comment enregistrer les paiements de mes locataires ?',
    r: 'Le bailleur enregistre ou confirme les versements dans Sikaloc Pro, en indiquant le bail, la période et les informations demandées. Sikaloc ne prélève pas automatiquement le loyer.',
  },
  {
    q: 'Quand une quittance est-elle disponible ?',
    r: 'Une quittance correspond à une période entièrement réglée. Un versement partiel donne lieu à un reçu correspondant au versement, selon les informations enregistrées.',
  },
  {
    q: 'Mes locataires peuvent-ils consulter leurs documents ?',
    r: 'Le bailleur peut inviter son locataire à rejoindre Sikaloc Me. Celui-ci accède alors aux informations et documents mis à sa disposition, selon les autorisations du compte.',
  },
  {
    q: 'Que comprend le plan Standard ?',
    r: `Le plan Standard coûte ${formaterFCFA(PRIX_STANDARD_FCFA)} par mois. Il permet d’enregistrer des logements sans plafond et inclut les relances WhatsApp des impayés. Les capacités effectives dépendent de l’abonnement actif.`,
  },
  {
    q: 'Une quittance garantit-elle un résultat juridique ?',
    r: 'Non. Sikaloc produit un document à partir des informations fournies, mais ne donne pas de conseil juridique et ne peut garantir l’issue d’un litige. Pour un usage juridique, demandez conseil à un professionnel.',
  },
]

export default async function PagePresentationPro({
  searchParams,
}: {
  searchParams: Promise<{ presentation?: string }>
}) {
  const utilisateur = await obtenirUtilisateur()
  const { presentation } = await searchParams

  // Une page publique reste lisible par les locataires et les bailleurs non vérifiés.
  // Seul un bailleur vérifié qui arrive sans demander explicitement la présentation
  // est renvoyé vers son espace, comme dans le comportement historique de /pro.
  if (utilisateur && presentation === undefined) {
    const supabase = await creerClientServeur()
    const { data } = await supabase
      .from('bailleurs')
      .select('*')
      .eq('id', utilisateur.id)
      .maybeSingle()

    if (data) {
      const etat = await etatVerification(data as Bailleur)
      if (etat.pleinementVerifie) redirect(ESPACE_PRO.tableauDeBord)
    }
  }

  return (
    <div className={`pro-sales min-h-screen bg-canvas text-ink ${manropePro.variable}`}>
      <EnTetePublic
        connecte={Boolean(utilisateur)}
        espace="Pro"
        marqueHref="/pro"
        liens={LIENS_PRO}
        liensTiroir={LIENS_TIROIR_PRO}
      />

      <main id="contenu">
        <section className="pro-sales-hero">
          <div className="pro-sales-wrap">
            <p className="pro-sales-eyebrow">Sikaloc Pro <span aria-hidden="true">·</span> Gestion locative</p>
            <h1 className="pro-sales-title">Vos logements.<br />Vos loyers.<br /><span>Tout sous contrôle.</span></h1>
            <p className="pro-sales-lead">
              Organisez vos logements, suivez les paiements enregistrés et retrouvez les documents disponibles dans un espace pensé pour les bailleurs au Bénin.
            </p>
            <div className="pro-sales-actions pro-sales-actions-center">
              <Link href="/inscription" className="pro-sales-button pro-sales-button-primary">Créer mon compte bailleur <span aria-hidden="true">↗</span></Link>
              <Link href="#fonctionnalites" className="pro-sales-button pro-sales-button-secondary">Découvrir les fonctionnalités <span aria-hidden="true">↓</span></Link>
            </div>
            <p className="pro-sales-note">Gratuit jusqu’à {LIMITE_LOGEMENTS_GRATUIT} logements · Sans carte bancaire</p>
            <div className="pro-sales-hero-photo">
              <Image
                src="/images/pro/sikaloc-pro-hero.webp"
                alt="Un propriétaire béninois observe une résidence contemporaine en tenant un dossier de location. Illustration éditoriale."
                width={1536}
                height={1024}
                priority
                sizes="(max-width: 760px) 100vw, 88vw"
              />
              <span className="pro-sales-photo-caption">Une gestion plus lisible, au quotidien.</span>
            </div>
          </div>
        </section>

        <section id="situations" className="pro-sales-problem">
          <div className="pro-sales-wrap pro-sales-problem-grid">
            <div className="pro-sales-section-intro">
              <p className="pro-sales-eyebrow">Le quotidien d’un bailleur</p>
              <h2 className="pro-sales-heading">Gérer une location ne devrait pas être compliqué.</h2>
              <p className="pro-sales-copy">Quand les informations se dispersent, il devient plus difficile de retrouver le fil de chaque location.</p>
            </div>
            <ol className="pro-sales-issue-list">
              {situations.map((item) => (
                <li key={item.numero}>
                  <span className="pro-sales-number">{item.numero}</span>
                  <div>
                    <h3>{item.titre}</h3>
                    <p>{item.texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="fonctionnalites" className="pro-sales-feature">
          <div className="pro-sales-wrap pro-sales-feature-grid">
            <div className="pro-sales-feature-copy">
              <p className="pro-sales-eyebrow">01 <span aria-hidden="true">/</span> Logements et locataires</p>
              <h2 className="pro-sales-heading">Vos locations, enfin organisées.</h2>
              <p className="pro-sales-copy">Enregistrez vos biens, ajoutez vos locataires et reliez chaque location à son bail. Les informations essentielles sont rassemblées dans votre espace Pro.</p>
              <ul className="pro-sales-checklist">
                <li>Logements et caractéristiques</li>
                <li>Fiches locataires et accès Me sur invitation</li>
                <li>Baux et principales conditions de location</li>
              </ul>
              <Link href="/inscription" className="pro-sales-text-link">Organiser mes locations <span aria-hidden="true">↗</span></Link>
            </div>
            <figure className="pro-sales-feature-photo pro-sales-photo-tall">
              <Image src="/images/pro/sikaloc-pro-organisation-corridor.webp" alt="Image illustrative d’un couloir lumineux de résidence contemporaine, avec plusieurs entrées de logements distinctes." width={1500} height={1200} sizes="(max-width: 900px) 100vw, 52vw" />
              <figcaption>Les informations d’une location, réunies au même endroit.</figcaption>
            </figure>
          </div>
        </section>

        <section className="pro-sales-feature pro-sales-feature-reverse">
          <div className="pro-sales-wrap pro-sales-feature-grid">
            <figure className="pro-sales-feature-photo pro-sales-photo-wide">
              <Image src="/images/pro/sikaloc-pro-paiements.webp" alt="Une propriétaire et un locataire béninois échangent calmement au sujet d’une location, avec un téléphone dont l’écran n’est pas visible. Illustration éditoriale." width={1500} height={1200} sizes="(max-width: 900px) 100vw, 52vw" />
              <figcaption>Un suivi qui s’appuie sur les versements enregistrés.</figcaption>
            </figure>
            <div className="pro-sales-feature-copy">
              <p className="pro-sales-eyebrow">02 <span aria-hidden="true">/</span> Loyers et paiements</p>
              <h2 className="pro-sales-heading">Chaque loyer, au bon endroit.</h2>
              <p className="pro-sales-copy">Enregistrez les règlements, consultez les périodes couvertes et repérez les soldes restants ou retards confirmés à partir des informations de vos baux.</p>
              <ul className="pro-sales-checklist">
                <li>Versements liés au bail et à la période</li>
                <li>Historique et état du suivi</li>
                <li>Relances WhatsApp disponibles avec Standard</li>
              </ul>
              <p className="pro-sales-smallprint">Sikaloc Pro aide à suivre les paiements enregistrés ; le loyer n’est pas encaissé automatiquement.</p>
            </div>
          </div>
        </section>

        <section id="documents" className="pro-sales-documents">
          <div className="pro-sales-wrap pro-sales-document-grid">
            <div className="pro-sales-document-copy">
              <p className="pro-sales-eyebrow">03 <span aria-hidden="true">/</span> Documents locatifs</p>
              <h2 className="pro-sales-heading">Des documents clairs, à retrouver facilement.</h2>
              <p className="pro-sales-copy">Consultez les reçus et quittances disponibles avec les informations de paiement et la période concernée. Un reçu correspond à un versement ; une quittance, à une période entièrement réglée.</p>
              <div className="pro-sales-actions">
                <Link href="/exemple-quittance" className="pro-sales-button pro-sales-button-primary">Voir un exemple de quittance <span aria-hidden="true">↗</span></Link>
                <Link href="/exemple-recu" className="pro-sales-text-link">Voir un exemple de reçu <span aria-hidden="true">↗</span></Link>
              </div>
              <p className="pro-sales-smallprint">L’exemple est fictif et ne constitue ni un justificatif réel ni un conseil juridique.</p>
              <Link href="/legal/confidentialite" className="pro-sales-quiet-link">Lire la politique de confidentialité</Link>
            </div>
            <div className="pro-sales-document-view">
              <div className="pro-sales-document-topline">
                <span>Exemple documentaire</span>
                <span>Données fictives</span>
              </div>
              <ApercuQuittanceDemonstration />
            </div>
          </div>

          <div id="guide" className="pro-sales-wrap pro-sales-guide">
            <div>
              <p className="pro-sales-eyebrow">Pour aller plus loin</p>
              <h3>Comprendre les documents de loyer</h3>
              <p>Un guide sur les mentions, la différence entre reçu et quittance et le processus de correction des paiements. Il ne remplace pas l’avis d’un professionnel du droit.</p>
            </div>
            <div className="pro-sales-guide-form"><FormulaireGuide /></div>
          </div>
        </section>

        <section id="tableau-de-bord" className="pro-sales-overview">
          <div className="pro-sales-wrap pro-sales-overview-grid">
            <div>
              <p className="pro-sales-eyebrow">Votre espace de gestion</p>
              <h2 className="pro-sales-heading">Votre gestion locative, en un regard.</h2>
              <p className="pro-sales-copy">Le tableau de bord rassemble les repères de votre portefeuille : logements, échéances, paiements enregistrés et éléments qui demandent votre attention.</p>
              <Link href="/inscription" className="pro-sales-button pro-sales-button-primary">Découvrir Sikaloc Pro <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="pro-sales-overview-visual" role="group" aria-label="Les catégories d’informations suivies dans Sikaloc Pro">
              <p className="pro-sales-overview-kicker">Les repères du quotidien</p>
              <p className="pro-sales-overview-display">Le bon repère,<br />pour chaque location.</p>
              <ol className="pro-sales-overview-index">
                <li><span>01</span><div><h3>Logements</h3><p>Biens et baux associés</p></div></li>
                <li><span>02</span><div><h3>Paiements</h3><p>Versements par période</p></div></li>
                <li><span>03</span><div><h3>Documents</h3><p>Selon les règlements enregistrés</p></div></li>
              </ol>
              <span className="pro-sales-overview-caption">Repères éditoriaux sur les catégories suivies dans Sikaloc Pro.</span>
            </div>
          </div>
        </section>

        <section id="etapes" className="pro-sales-steps">
          <div className="pro-sales-wrap">
            <div className="pro-sales-section-intro pro-sales-section-intro-centered">
              <p className="pro-sales-eyebrow">Le parcours</p>
              <h2 className="pro-sales-heading">De votre logement à vos documents, simplement.</h2>
            </div>
            <ol className="pro-sales-step-list">
              {etapes.map((etape) => (
                <li key={etape.numero}>
                  <span>{etape.numero}</span>
                  <h3>{etape.titre}</h3>
                  <p>{etape.texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="tarifs" className="pro-sales-pricing">
          <div className="pro-sales-wrap">
            <div className="pro-sales-section-intro pro-sales-section-intro-centered">
              <p className="pro-sales-eyebrow">Des tarifs lisibles</p>
              <h2 className="pro-sales-heading">Commencez simplement. Évoluez à votre rythme.</h2>
              <p className="pro-sales-copy">Les deux offres partagent les fonctionnalités de gestion essentielles. Standard ajoute une capacité de logements sans plafond et les relances WhatsApp.</p>
            </div>
            <div className="pro-sales-price-grid">
              <article className="pro-sales-price-card">
                <p className="pro-sales-price-name">Gratuit</p>
                <p className="pro-sales-price-value">0 <span>FCFA</span></p>
                <p className="pro-sales-price-caption">Pour commencer</p>
                <ul>
                  <li>Jusqu’à {LIMITE_LOGEMENTS_GRATUIT} logements</li>
                  <li>Baux, locataires et paiements illimités</li>
                  <li>Tableau de bord et suivi des impayés</li>
                  <li>Quittances PDF numérotées et horodatées</li>
                  <li>Mention du droit de timbre</li>
                  <li className="pro-sales-excluded">Relances WhatsApp non incluses</li>
                </ul>
                <Link href="/inscription" className="pro-sales-button pro-sales-button-secondary pro-sales-button-full">Commencer gratuitement <span aria-hidden="true">↗</span></Link>
              </article>
              <article className="pro-sales-price-card pro-sales-price-card-featured">
                <div className="pro-sales-price-top"><p className="pro-sales-price-name">Standard</p><span>Plus de capacité</span></div>
                <p className="pro-sales-price-value">{formaterFCFA(PRIX_STANDARD_FCFA)} <span>/ mois</span></p>
                <p className="pro-sales-price-caption">Sans engagement · paiement Mobile Money</p>
                <ul>
                  <li>Logements sans plafond</li>
                  <li>Baux, locataires et paiements illimités</li>
                  <li>Tableau de bord et suivi des impayés</li>
                  <li>Quittances PDF numérotées et horodatées</li>
                  <li>Mention du droit de timbre (art. 423 du CGI)</li>
                  <li>Relances WhatsApp des impayés</li>
                </ul>
                <Link href="/inscription" className="pro-sales-button pro-sales-button-primary pro-sales-button-full">Choisir Standard <span aria-hidden="true">↗</span></Link>
              </article>
            </div>
            <p className="pro-sales-legal-note">Toutes les quittances portent la mention du droit de timbre, à la charge du locataire (art. 423 du CGI, modifié par la LF 2025), quel que soit le plan. Sikaloc ne calcule pas ce montant et ne fournit pas de conseil juridique.</p>
            <p className="pro-sales-referral-note">Parrainez un bailleur : vous recevez chacun 1 mois offert dès sa première souscription payante.</p>
          </div>
        </section>

        <section id="faq" className="pro-sales-faq">
          <div className="pro-sales-wrap pro-sales-faq-grid">
            <div className="pro-sales-section-intro">
              <p className="pro-sales-eyebrow">Questions fréquentes</p>
              <h2 className="pro-sales-heading">Des questions avant de vous lancer ?</h2>
              <p className="pro-sales-copy">Des réponses concrètes sur les offres et le suivi des locations.</p>
              <Link href="/questions" className="pro-sales-text-link">Poser une autre question <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="pro-sales-faq-list">
              {questions.map((item, index) => (
                <details key={item.q} open={index === 0}>
                  <summary>{item.q}<span aria-hidden="true">+</span></summary>
                  <p>{item.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="pro-sales-final">
          <div className="pro-sales-wrap pro-sales-final-card">
            <p className="pro-sales-eyebrow">Sikaloc Pro</p>
            <h2 className="pro-sales-heading">Vos locations méritent un suivi plus clair.</h2>
            <p className="pro-sales-copy">Commencez à organiser vos logements, vos loyers et vos documents depuis un seul espace.</p>
            <Link href="/inscription" className="pro-sales-button pro-sales-button-primary">Créer mon compte bailleur <span aria-hidden="true">↗</span></Link>
            <p className="pro-sales-note">Gratuit jusqu’à {LIMITE_LOGEMENTS_GRATUIT} logements · Sans carte bancaire</p>
            <p id="locataire" className="pro-sales-final-tenant">Vous êtes locataire ? <Link href="/me/rejoindre">Votre bailleur peut vous inviter sur Sikaloc Me</Link>.</p>
          </div>
        </section>
      </main>

      <PiedDePage />
      <WidgetWhatsApp />
    </div>
  )
}
