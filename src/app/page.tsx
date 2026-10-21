import {
  ArrowRight,
  Building2,
  FileCheck,
  Home,
  Lock,
  MapPin,
  Search,
  SlidersHorizontal,
  ScrollText,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

import { EnTetePublic, type LienEnTete } from '@/components/marketing/en-tete-public'
import { PiedDePage } from '@/components/marketing/pied-de-page'
import { WidgetWhatsApp } from '@/components/marketing/widget-whatsapp'
import { ESPACE_ME, ESPACE_PRO } from '@/lib/roles'
import { obtenirUtilisateur } from '@/lib/supabase/serveur'

/**
 * La page d'accueil de Sikaloc — la marque, pas l'un de ses espaces.
 *
 * ─── Ce qu'elle a cessé d'être ──────────────────────────────────────────────
 *
 * Une page de vente pour bailleurs. Elle l'était entièrement : un locataire qui
 * recevait une invitation, tapait « sikaloc.com » et lisait « Vos quittances
 * tiendront-elles devant un juge ? » concluait qu'il s'était trompé de site.
 *
 * Ce contenu n'a pas été perdu : il vit maintenant à `/pro`, où il s'adresse à
 * ceux qu'il vise. Cette page-ci a un autre métier — dire ce qu'est Sikaloc, et
 * envoyer chacun là où il a affaire.
 *
 * ─── La règle qui a décidé de chaque lien ───────────────────────────────────
 *
 * Trois espaces, trois états différents, trois traitements :
 *
 *     Sikaloc_Pro    existe et s'ouvre à tous       → lien vers /pro
 *     Sikaloc_Me     existe, mais on y entre sur
 *                    invitation de son bailleur     → lien vers /me/rejoindre,
 *                                                     qui explique comment
 *     Sikaloc_Find   existe depuis S5 : le catalogue
 *                    des annonces publiées           → lien vers /find
 *
 * Le troisième a longtemps été le seul sans lien : annoncer une recherche de
 * logements avec un bouton menant à une page introuvable aurait été la
 * promesse en trompe-l'œil que ce produit s'interdit. Le lien n'est venu
 * qu'avec la page.
 */

export const metadata: Metadata = {
  // `absolute` : le gabarit de la racine ajouterait « · Sikaloc » à un titre
  // qui commence déjà par le nom de la marque.
  title: { absolute: 'Sikaloc — gestion locative et logements au Bénin' },
  // Au présent depuis S5 : `/find` existe. Tant qu'il n'existait pas, cette
  // description disait « bientôt » — elle s'affiche seule dans un résultat de
  // recherche, et promettait sinon une page qu'on ne trouvait pas en cliquant.
  description:
    'Sikaloc réunit les espaces de la location au Bénin : Sikaloc_Pro pour ' +
    'les bailleurs, Sikaloc_Me pour les locataires, et Sikaloc_Find ' +
    'pour chercher un logement. Un seul compte, des documents partagés.',
  alternates: { canonical: '/' },
}

/**
 * Les ancres de l'en-tête.
 *
 * Trois, et courtes : la barre est mesurée au pixel près — à 1024 px elle
 * consommait 949 px pour 960 disponibles avant d'être élargie. Un quatrième
 * libellé la ferait déborder (voir les commentaires d'`EnTetePublic`).
 *
 * « Trouver un logement » a donc pris la place de « Comment ça marche », et
 * non une place de plus : une porte vers une page vaut mieux, dans la barre,
 * qu'une ancre vers une section qu'on atteint en faisant défiler. L'ancre
 * reste dans le tiroir et dans le pied de page.
 */
const LIENS_ACCUEIL: LienEnTete[] = [
  { href: '#espaces', libelle: 'Les espaces' },
  { href: '/find', libelle: 'Trouver un logement' },
  { href: '/pro', libelle: 'Bailleurs' },
]

/**
 * Le tiroir mobile : les mêmes entrées, plus la porte du locataire.
 *
 * Vers `/me/rejoindre` et non `#locataire` : cette section a quitté la page
 * d'accueil avec le reste du contenu bailleur. C'est au téléphone qu'arrive le
 * locataire qui a reçu une invitation — le tiroir est l'endroit où il la
 * cherche.
 */
const LIENS_TIROIR_ACCUEIL: LienEnTete[] = [
  { href: '#espaces', libelle: 'Les espaces' },
  { href: '#parcours', libelle: 'Comment ça marche' },
  { href: '/find', libelle: 'Trouver un logement' },
  { href: '/pro', libelle: 'Bailleurs' },
  { href: '/me/rejoindre', libelle: 'Je suis locataire' },
]

/**
 * Les trois espaces, avec leur état RÉEL.
 *
 * `disponible` n'est pas un drapeau d'affichage : c'est ce qui décide si une
 * carte porte un lien ou une mention d'attente. Sikaloc_Find est passé à
 * `true` le jour où `/find` a existé — pas avant.
 */
const ESPACES_PRESENTES = [
  {
    cle: 'pro',
    nom: ESPACE_PRO.nom,
    Icone: Building2,
    image: '/illustrations/home-02.webp',
    pour: 'Propriétaires et bailleurs',
    texte:
      'Logements, locataires, baux et versements réunis pour suivre la gestion au fil des périodes.',
    disponible: true,
    lien: { href: '/pro?presentation=1', libelle: 'Découvrir Sikaloc Pro' },
  },
  {
    cle: 'me',
    nom: ESPACE_ME.nom,
    Icone: ScrollText,
    image: '/illustrations/home-03.webp',
    pour: 'Locataires',
    texte:
      'Retrouvez les informations de votre bail, les paiements enregistrés et les documents mis à votre disposition.',
    disponible: true,
    // Pas `/me` : cette adresse exige une session, et un curieux y serait
    // renvoyé vers un formulaire de connexion sans identifiants.
    lien: { href: '/me/rejoindre', libelle: 'Comment y accéder' },
  },
  {
    cle: 'find',
    nom: 'Sikaloc_Find',
    Icone: Search,
    image: '/illustrations/home-04.webp',
    pour: 'Personnes en recherche',
    texte:
      'Chercher un logement à louer, et le trouver publié par un bailleur qui gère déjà ses biens sur Sikaloc.',
    disponible: true,
    lien: { href: '/find', libelle: 'Voir les logements' },
  },
]

/**
 * Le parcours d'un logement, d'un bout à l'autre de l'écosystème.
 *
 * C'est ce qui distingue Sikaloc d'un logiciel de gestion : le même logement,
 * le même bail et les mêmes documents traversent les trois espaces sans être
 * ressaisis.
 */
const PARCOURS = [
  {
    numero: '1',
    espace: ESPACE_PRO.nom,
    titre: 'Le bailleur enregistre son bien',
    texte:
      'Logement, locataire, bail, loyer. C’est là que vivent les paiements et les quittances.',
    avenir: false,
  },
  {
    numero: '2',
    espace: 'Sikaloc_Find',
    titre: 'Il le publie s’il est vacant',
    texte:
      'Le logement est déjà décrit : le publier ne demande pas de le ressaisir.',
    avenir: false,
  },
  {
    numero: '3',
    espace: ESPACE_ME.nom,
    titre: 'Le locataire entre dans son espace',
    texte:
      'Son bailleur l’invite. Il retrouve son bail, ses loyers et ses quittances, sans rien installer ni payer.',
    avenir: false,
  },
]

/** Ce que Sikaloc_Pro apporte au bailleur. Le détail vit sur `/pro`. */
const POUR_BAILLEURS = [
  'Logements, locataires et baux réunis dans le même espace',
  'Versements et soldes suivis par période de loyer',
  'Reçus et quittances liés aux paiements enregistrés',
]

/**
 * Ce que Sikaloc_Me apporte au locataire.
 *
 * Le troisième point est le moins spectaculaire et le plus important : c'est la
 * seule ligne de cette page qui protège le locataire contre le produit
 * lui-même.
 */
const POUR_LOCATAIRES = [
  'Le bail et les documents disponibles dans votre espace',
  'Les paiements et loyers présentés période par période',
  'Un historique inconnu reste « à déterminer », pas « impayé »',
]

/**
 * Ce que la page peut affirmer à partir des parcours réellement implémentés :
 * les annonces publiées, le traitement des candidatures et l'accès de Me.
 */
const VERIFIABLE = [
  {
    Icone: FileCheck,
    titre: 'Find montre les annonces publiées',
    texte:
      'Le catalogue présente les logements que leurs bailleurs ont choisi de publier, pas des annonces de démonstration.',
  },
  {
    Icone: Search,
    titre: 'Une candidature reste une demande',
    texte:
      'Le bailleur l’examine et décide de la suite. Elle ne crée pas automatiquement un bail.',
  },
  {
    Icone: Lock,
    titre: 'Me s’ouvre sur invitation',
    texte:
      'Le locataire rejoint l’espace que son bailleur lui ouvre et y retrouve les informations qui lui sont destinées.',
  },
]

export default async function PageAccueil() {
  const utilisateur = await obtenirUtilisateur()

  return (
    <div className="min-h-screen bg-canvas-soft">
      {/*
        Ni `espace`, ni `marqueHref` : ici la marque est Sikaloc tout court, et
        elle mène à sa propre page. C'est la seule page du site où le wordmark
        ne porte pas de suffixe — et c'est ce qui dit qu'on est au-dessus des
        trois espaces, pas dans l'un d'eux.
      */}
      <EnTetePublic
        connecte={Boolean(utilisateur)}
        liens={LIENS_ACCUEIL}
        liensTiroir={LIENS_TIROIR_ACCUEIL}
        // La page globale ignore le rôle du visiteur : `/entrer` aiguille
        // selon les rôles, exactement comme le bouton de l'en-tête juste
        // au-dessus. Sans cette ligne, le tiroir retombait sur le défaut de
        // `MenuMobile` — la destination bailleur, fausse pour un locataire
        // connecté qui ouvrirait le menu sur cette page.
        destinationTableauDeBord="/entrer"
      />

      <main id="contenu">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="public-hero home-hero relative overflow-hidden">
          <div className="home-hero-inner relative mx-auto max-w-[1320px]">
            <div className="home-hero-layout">
              <div className="home-hero-copy-block">
                <p className="home-kicker">
                  <span aria-hidden="true" className="home-kicker-mark" />
                  La location au Bénin, mieux reliée
                </p>

                <h1 className="home-hero-title text-balance">
                  Un logement à trouver.
                  <span>Des loyers à suivre.</span>
                  <span className="public-hero-accent">Des preuves à garder.</span>
                </h1>

                <p className="public-hero-copy home-hero-description">
                  Sikaloc réunit la recherche de logements, le suivi locatif et
                  les documents de location dans des espaces pensés pour les
                  bailleurs, les locataires et les candidats.
                </p>

                <div className="home-hero-actions">
                  <Link href="/pro?presentation=1" className="btn btn-primary">
                    Découvrir Sikaloc Pro <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <Link href="/find" className="home-hero-secondary">
                    Trouver un logement <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>

                <p className="home-hero-tenant">
                  Vous êtes locataire ?{' '}
                  <Link href="/me/rejoindre">Votre bailleur vous invite sur Me.</Link>
                </p>
              </div>

              <figure className="home-hero-art">
                <div aria-hidden="true" className="home-hero-art-halo" />
                <picture>
                  <source media="(max-width: 639px)" srcSet="/illustrations/home-01-mobile.webp" />
                  <Image
                    src="/illustrations/home-01.webp"
                    alt="Composition architecturale illustrée reliant trois logements stylisés"
                    width={1440}
                    height={1080}
                    priority
                    sizes="(max-width: 767px) 100vw, (max-width: 1199px) 52vw, 640px"
                    className="home-hero-image"
                  />
                </picture>
                <figcaption className="home-hero-caption">
                  <span className="home-caption-symbol" aria-hidden="true">
                    <Home size={18} strokeWidth={1.8} />
                  </span>
                  <span>
                    <strong>Un même parcours locatif</strong>
                    <small>Recherche · gestion · documents</small>
                  </span>
                </figcaption>
                <div className="home-hero-space-tags" aria-hidden="true">
                  <span>Pro</span><span>Me</span><span>Find</span>
                </div>
              </figure>
            </div>

            <div className="home-hero-index" role="group" aria-label="Les trois usages de Sikaloc">
              <span>Gérer un logement</span>
              <span>Retrouver ses documents</span>
              <span>Explorer les annonces</span>
            </div>
          </div>
        </section>

        {/* ── Le problème ──────────────────────────────────────────────── */}
        <section className="home-problem-section">
          <div className="home-problem-layout mx-auto max-w-[1200px]">
            <div className="home-problem-heading">
              <p className="home-section-label">Une location, deux points de vue</p>
              <h2 className="home-section-title">
                Quand les informations se dispersent, le suivi se complique.
              </h2>
            </div>

            <div className="home-perspectives">
              <article className="home-perspective home-perspective--owner">
                <span className="home-perspective-role">
                  <Building2 size={17} aria-hidden="true" /> Côté bailleur
                </span>
                <p className="home-perspective-question">« Quelle période reste à régler ? »</p>
                <p className="home-perspective-copy">
                  Contrat, versements et justificatifs sont plus simples à suivre
                  lorsqu’ils sont réunis au même endroit.
                </p>
              </article>
              <article className="home-perspective home-perspective--tenant">
                <span className="home-perspective-role">
                  <ScrollText size={17} aria-hidden="true" /> Côté locataire
                </span>
                <p className="home-perspective-question">« Où retrouver mon bail et mes reçus ? »</p>
                <p className="home-perspective-copy">
                  Un espace dédié permet de consulter les informations et les
                  documents que le bailleur a rendus disponibles.
                </p>
              </article>
            </div>
          </div>
          <div aria-hidden="true" className="home-problem-bridge">
            <span>Un seul fil entre les deux</span>
            <span className="home-bridge-line" />
            <span>Sikaloc</span>
          </div>
        </section>

        {/* ── Les trois espaces ────────────────────────────────────────── */}
        <section id="espaces" className="home-spaces-section">
          <div className="mx-auto max-w-[1200px]">
            <div className="home-spaces-heading">
              <div>
                <p className="home-section-label">Trois espaces, une même location</p>
                <h2 className="home-section-title">
                  Chaque personne retrouve ce qui la concerne.
                </h2>
              </div>
              <p className="home-section-intro">
                La gestion reste côté bailleur, la consultation côté locataire,
                et les annonces publiées sont ouvertes à la recherche.
              </p>
            </div>

            <div className="home-space-grid">
              {ESPACES_PRESENTES.map(({ cle, nom, Icone, image, pour, texte, disponible, lien }) => (
                <article key={nom} className={`home-space-card home-space-card--${cle}`}>
                  <div className="home-space-art">
                    <Image
                      src={image}
                      alt=""
                      width={1200}
                      height={900}
                      sizes="(max-width: 767px) 92vw, (max-width: 1100px) 46vw, 360px"
                    />
                    <span className="home-space-art-index" aria-hidden="true">
                      {cle === 'pro' ? 'Gestion' : cle === 'me' ? 'Documents' : 'Recherche'}
                    </span>
                  </div>
                  <div className="home-space-content">
                    <div className="home-space-title-row">
                      <span className="home-space-icon"><Icone size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                      <div>
                        <h3>{nom}</h3>
                        <p>{pour}</p>
                      </div>
                    </div>
                    <p className="home-space-description">{texte}</p>
                    {disponible && lien ? (
                      <Link href={lien.href} className="home-space-link">
                        {lien.libelle}<ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    ) : (
                      <p className="home-space-link home-space-link--muted">Bientôt disponible</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="trouver" className="home-find-section">
          <div className="home-find-layout mx-auto max-w-[1200px]">
            <div className="home-find-copy">
              <p className="home-section-label">Sikaloc Find</p>
              <h2 className="home-section-title">
                Une recherche guidée par vos critères.
              </h2>
              <p className="home-section-intro">
                Parcourez les annonces publiées, comparez les informations d’un
                logement et candidatez depuis sa fiche. Le bailleur examine
                ensuite chaque demande.
              </p>
              <Link href="/find" className="btn btn-primary home-find-cta">
                Explorer les annonces <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <p className="home-find-note">Une candidature ne crée pas automatiquement un bail.</p>
            </div>

            <div className="home-find-preview" role="group" aria-label="Critères disponibles dans la recherche Find">
              <div className="home-find-preview-head">
                <span className="home-find-preview-mark"><Search size={18} aria-hidden="true" /></span>
                <div><strong>Affinez votre recherche</strong><small>Les filtres disponibles dans Find</small></div>
              </div>
              <div className="home-find-fields">
                <div className="home-find-field home-find-field--wide"><span>Localisation</span><strong>Ville et quartier</strong><MapPin size={17} aria-hidden="true" /></div>
                <div className="home-find-field"><span>Type de bien</span><strong>Choisir un type</strong><Home size={17} aria-hidden="true" /></div>
                <div className="home-find-field"><span>Loyer mensuel</span><strong>Définir une fourchette</strong><span className="home-find-currency">FCFA</span></div>
                <div className="home-find-field"><span>Chambres</span><strong>Selon vos besoins</strong><SlidersHorizontal size={17} aria-hidden="true" /></div>
              </div>
              <div className="home-find-preview-foot"><span className="home-find-live-dot" /> Les résultats proviennent des annonces publiées</div>
            </div>
          </div>
        </section>

        {/* ── Le parcours ──────────────────────────────────────────────── */}
        <section id="parcours" className="home-journey-section">
          <div className="mx-auto max-w-[1200px]">
            <div className="home-journey-heading">
              <p className="home-section-label">Comment ça marche</p>
              <h2 className="home-section-title">Du logement publié aux documents du locataire.</h2>
              <p className="home-section-intro">
                Chaque espace intervient à une étape précise. L’accès de Me se
                fait sur invitation du bailleur.
              </p>
            </div>
            <ol className="home-journey-list">
              {PARCOURS.map(({ numero, espace, titre, texte }) => (
                <li key={numero} className="home-journey-step">
                  <span className="home-journey-number" aria-hidden="true">{numero.padStart(2, '0')}</span>
                  <div className="home-journey-copy">
                    <p className="home-journey-space">{espace}</p>
                    <h3>{titre}</h3>
                    <p>{texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Pour les bailleurs ───────────────────────────────────────── */}
        <section className="home-audiences-section">
          <div className="home-audiences-grid mx-auto max-w-[1200px]">
            <article className="home-audience home-audience--pro">
              <div className="home-audience-topline"><Building2 size={19} aria-hidden="true" /> Pour les bailleurs</div>
              <h2>Une gestion qui reste lisible, période après période.</h2>
              <ul role="list">
                {POUR_BAILLEURS.map((point) => (
                  <li key={point}><FileCheck size={17} aria-hidden="true" />{point}</li>
                ))}
              </ul>
              <Link href="/pro?presentation=1" className="home-audience-link">
                Voir Sikaloc Pro <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </article>

            <article className="home-audience home-audience--me">
              <div className="home-audience-topline"><Home size={19} aria-hidden="true" /> Pour les locataires</div>
              <h2>Les informations de votre location, dans votre espace.</h2>
              <ul role="list">
                {POUR_LOCATAIRES.map((point) => (
                  <li key={point}><ScrollText size={17} aria-hidden="true" />{point}</li>
                ))}
              </ul>
              <Link href="/me/rejoindre" className="home-audience-link">
                Comprendre l’accès à Me <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>

        {/* ── Ce qui se vérifie ────────────────────────────────────────── */}
        <section className="home-trust-section">
          <div className="mx-auto max-w-[1200px]">
            <div className="home-trust-heading">
              <p className="home-section-label">Une promesse mesurée</p>
              <h2 className="home-section-title">Pas de témoignages : des faits contrôlables.</h2>
              <p className="home-section-intro">
                Pas de chiffres d’usage inventés ni de promesse d’attribution.
                Voici ce que les espaces Sikaloc font réellement.
              </p>
            </div>

            <div className="home-trust-grid">
              {VERIFIABLE.map(({ Icone, titre, texte }) => (
                <article className="home-trust-item" key={titre}>
                  <span className="home-trust-icon"><Icone size={21} strokeWidth={1.8} aria-hidden="true" /></span>
                  <h3>{titre}</h3>
                  <p>{texte}</p>
                </article>
              ))}
            </div>

            <div className="home-trust-links">
              <Link
                href="/exemple-quittance"
                className="lien-anime text-body-sm font-medium text-ink"
              >
                Voir un exemple de quittance
              </Link>
              <Link
                href="/legal/confidentialite"
                className="lien-anime text-body-sm font-medium text-ink"
              >
                Lire la politique de confidentialité
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" className="home-faq-section">
          <div className="home-faq-layout mx-auto max-w-[1200px]">
            <div className="home-faq-heading">
              <p className="home-section-label">Questions fréquentes</p>
              <h2 className="home-section-title">Avant de choisir votre espace.</h2>
            </div>
            <div className="home-faq-list">
              <details>
                <summary>Qui peut créer un compte bailleur ?</summary>
                <p>Un propriétaire ou gestionnaire peut commencer depuis Sikaloc Pro. La confirmation de son adresse email reste nécessaire.</p>
              </details>
              <details>
                <summary>Comment un locataire accède-t-il à Sikaloc Me ?</summary>
                <p>Il reçoit une invitation de son bailleur. L’accès à Me ne nécessite pas de souscrire un abonnement.</p>
              </details>
              <details>
                <summary>Les annonces Find sont-elles garanties disponibles ?</summary>
                <p>Find présente les annonces publiées par les bailleurs. Une candidature ne vaut pas attribution d’un logement : le bailleur l’examine et décide de la suite.</p>
              </details>
            </div>
          </div>
        </section>

        {/* ── Appel final ──────────────────────────────────────────────── */}
        <section className="home-final-section">
          <div className="home-final-cta mx-auto max-w-[1200px]">
            <div className="home-final-copy">
              <p className="home-final-kicker">La location, avec un fil plus clair</p>
              <h2 className="text-display-md font-extrabold tracking-tight text-on-dark">
              {utilisateur
                ? 'Reprenez où vous en étiez'
                : 'Commencez par le bout qui vous concerne'}
              </h2>
              <p className="home-final-description">
                La création de compte concerne les bailleurs. Le locataire rejoint
                Me sur invitation et n’a pas à souscrire d’abonnement.
              </p>
            </div>

            <div className="home-final-actions">
              {utilisateur ? (
                // Le compte existe : `/entrer` aiguille selon les rôles, et ne
                // pose la question qu'à qui porte les deux.
                <Link href="/entrer" className="btn btn-primary">
                  Accéder à mon espace
                </Link>
              ) : (
                <>
                  <Link href="/inscription" className="btn btn-primary">
                    Créer un compte bailleur
                  </Link>
                  <Link href="/me/rejoindre" className="btn btn-secondary">
                    Je suis locataire
                  </Link>
                </>
              )}
            </div>

          </div>
        </section>
      </main>

      <PiedDePage />
      <WidgetWhatsApp />
    </div>
  )
}
