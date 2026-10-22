import {
  ArrowRight,
  Building2,
  FileCheck,
  Home,
  Lock,
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
import { FiltresFind } from '@/components/find/filtres'
import { lireFiltres } from '@/lib/find/recherche'
import { ESPACE_ME, ESPACE_PRO } from '@/lib/roles'
import { creerClientServeur, obtenirUtilisateur } from '@/lib/supabase/serveur'

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
    'Sikaloc relie recherche de logements, gestion locative et accès aux ' +
    'informations de location au Bénin, avec un espace adapté à chaque usage.',
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
      'Organisez vos logements, locataires et baux. Retrouvez les paiements enregistrés et les documents disponibles.',
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
      'Après invitation, consultez les informations de votre bail, les paiements enregistrés et les documents partagés.',
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
      'Explorez les annonces publiées et candidatez depuis la fiche lorsqu’une candidature est ouverte.',
    disponible: true,
    lien: { href: '/find', libelle: 'Voir les logements' },
  },
]

/**
 * Le parcours d'un logement, d'un bout à l'autre de l'écosystème.
 *
 * Ces usages se complètent sans former un parcours automatique : le bailleur
 * publie une annonce s'il le souhaite, et l'accès du locataire à Me dépend
 * d'une invitation.
 */
const PARCOURS = [
  {
    espace: ESPACE_PRO.nom,
    titre: 'Le bailleur enregistre son bien',
    texte:
      'Il renseigne le logement et suit séparément le bail, les loyers et les paiements enregistrés.',
  },
  {
    espace: 'Sikaloc_Find',
    titre: 'Il le publie s’il est vacant',
    texte:
      'S’il souhaite le proposer à la location, le bailleur peut publier une annonce à partir des informations du logement.',
  },
  {
    espace: ESPACE_ME.nom,
    titre: 'Le locataire entre dans son espace',
    texte:
      'Une fois la relation locative établie, le bailleur peut l’inviter à consulter les informations et documents disponibles dans Me.',
  },
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
  const supabase = await creerClientServeur()
  const [utilisateur, { data: lieux }] = await Promise.all([
    obtenirUtilisateur(),
    supabase.rpc('lieux_publies'),
  ])

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
        <section className="public-hero home-hero home-hero--clair relative overflow-hidden">
          <div className="home-hero-inner relative mx-auto max-w-[1320px]">
            <div className="home-hero-layout">
              <div className="home-hero-copy-block">
                <p className="home-kicker">
                  <span aria-hidden="true" className="home-kicker-mark" />
                  La location au Bénin, mieux reliée
                </p>

                <h1 className="home-hero-title text-balance">
                  <span className="home-hero-title-main">Un logement à trouver.</span>
                  <span className="home-hero-title-support">Des loyers à suivre.</span>
                  <span className="home-hero-title-support home-hero-title-mark">Des preuves à garder.</span>
                </h1>

                <p className="public-hero-copy home-hero-description">
                  Sikaloc réunit la recherche de logements, le suivi locatif et les documents de location
                  dans des espaces dédiés aux bailleurs, aux locataires invités et aux candidats.
                </p>

                <div className="home-hero-actions">
                  <Link href="/pro?presentation=1" className="btn btn-primary">
                    Découvrir Sikaloc Pro <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <Link href="/find" className="btn btn-secondary home-hero-secondary">
                    Trouver un logement <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>

                <p className="home-hero-tenant">
                  Vous êtes locataire ?{' '}
                  <Link href="/me/rejoindre">Votre bailleur vous invite sur Me.</Link>
                </p>
              </div>

              <figure className="home-hero-art">
                <Image
                  src="/illustrations/home-01-sculpture.png"
                  alt="Sculpture architecturale de trois maisons en marbre crème et vert, reliées par des passerelles courbes"
                  width={1536}
                  height={1024}
                  priority
                  sizes="(max-width: 639px) 100vw, (max-width: 1199px) 94vw, 1100px"
                  className="home-hero-image"
                />
              </figure>
            </div>
          </div>
        </section>

        {/* ── Le problème ──────────────────────────────────────────────── */}
        <section className="home-problem-section">
          <div className="home-problem-layout mx-auto max-w-[1200px]">
            <div className="home-problem-heading">
              <p className="home-section-label">Une location, deux points de vue</p>
              <h2 className="home-section-title home-problem-title">
                Quand les informations se dispersent, le suivi se complique.
              </h2>
            </div>

            <div className="home-problem-scene">
              <div className="home-problem-fragments">
                <div className="home-problem-fragment home-problem-fragment--lease">
                  <span className="home-problem-paper-edge" aria-hidden="true" />
                  <strong>Bail</strong>
                  <span className="home-problem-fragment-lines" aria-hidden="true"><i /><i /><i /></span>
                </div>
                <div className="home-problem-fragment home-problem-fragment--payments">
                  <span className="home-problem-paper-edge" aria-hidden="true" />
                  <strong>Versements</strong>
                  <span className="home-problem-fragment-lines" aria-hidden="true"><i /><i /><i /></span>
                </div>
                <div className="home-problem-fragment home-problem-fragment--documents">
                  <span className="home-problem-paper-edge" aria-hidden="true" />
                  <strong>Documents</strong>
                  <span className="home-problem-fragment-lines" aria-hidden="true"><i /><i /></span>
                </div>
              </div>
            </div>

            <div className="home-perspectives">
              <article className="home-perspective home-perspective--owner">
                <span className="home-perspective-role">
                  <Building2 size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>Côté bailleur</span>
                </span>
                <p className="home-perspective-question">Quelle période reste à régler&nbsp;?</p>
                <p className="home-perspective-copy">Bail, périodes et règlements à rapprocher.</p>
              </article>
              <article className="home-perspective home-perspective--tenant">
                <span className="home-perspective-role">
                  <ScrollText size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>Côté locataire</span>
                </span>
                <p className="home-perspective-question">Où retrouver mon bail et mes reçus&nbsp;?</p>
                <p className="home-perspective-copy">Les documents que le bailleur rend disponibles dans Me.</p>
              </article>
            </div>
          </div>
        </section>

        {/* ── Les trois espaces ────────────────────────────────────────── */}
        <section id="espaces" className="home-spaces-section">
          <div className="mx-auto max-w-[1200px]">
            <div className="home-spaces-heading">
              <div>
                <p className="home-section-label">Trois espaces, des rôles distincts</p>
                <h2 className="home-section-title">
                  Le bon espace pour votre moment de location.
                </h2>
              </div>
              <p className="home-section-intro">
                Le bailleur gère ses biens, le locataire consulte ce qui lui est
                partagé sur invitation, et Find rassemble les annonces publiées.
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
                    {cle === 'pro' ? (
                      <div className="home-space-glance" role="group" aria-label="Schéma illustratif des rubriques de Sikaloc Pro">
                        <p className="home-space-glance-title">
                          Dans l’espace Pro <span>Schéma illustratif, sans données de compte</span>
                        </p>
                        <ul className="home-space-glance-list" role="list">
                          <li>Logements</li>
                          <li>Locataires et baux</li>
                          <li>Loyers et paiements</li>
                          <li>Reçus et quittances</li>
                        </ul>
                      </div>
                    ) : null}
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

        <section id="trouver" className="home-find-section home-find-section--signature">
          <div className="home-find-layout mx-auto max-w-[1200px]">
            <div className="home-find-copy">
              <p className="home-find-overline">Sikaloc Find</p>
              <h2 className="home-section-title">
                Cherchez avec vos propres repères.
              </h2>
              <p className="home-find-description">
                Choisissez une ville, un type de bien ou une fourchette de loyer.
                Find affiche les annonces publiées qui correspondent à votre recherche.
              </p>
              <Link href="/find" className="home-find-text-link">
                Voir le catalogue complet <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <p className="home-find-note">Une candidature reste une demande ; le bailleur décide de la suite.</p>
            </div>

            <div className="home-find-live" role="group" aria-label="Filtres de recherche de Sikaloc Find">
              <div className="home-find-live-heading">
                <span className="home-find-live-mark"><SlidersHorizontal size={17} aria-hidden="true" /></span>
                <div>
                  <strong>Construisez votre recherche</strong>
                  <span>Les villes proposées correspondent aux annonces publiées.</span>
                </div>
              </div>
              <FiltresFind
                filtres={lireFiltres({})}
                lieux={lieux ?? []}
                nbFiltresActifs={0}
                compacte
              />
            </div>
          </div>
        </section>

        {/* ── Le parcours ──────────────────────────────────────────────── */}
        <section id="parcours" className="home-journey-section">
          <div className="mx-auto max-w-[1200px]">
            <div className="home-journey-heading">
              <p className="home-section-label">Des usages qui se complètent</p>
              <h2 className="home-section-title">Chaque espace intervient à sa juste place.</h2>
              <p className="home-section-intro">
                Chaque espace intervient quand vous en avez besoin. Une annonce
                ne crée pas de bail et l’accès locataire reste sur invitation.
              </p>
            </div>
            <div className="home-journey-list" role="list">
              {PARCOURS.map(({ espace, titre, texte }) => (
                <article key={espace} className="home-journey-step" role="listitem">
                  <div className="home-journey-copy">
                    <p className="home-journey-space">{espace}</p>
                    <h3>{titre}</h3>
                    <p>{texte}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pour les bailleurs ───────────────────────────────────────── */}
        <section className="home-audiences-section">
          <div className="mx-auto max-w-[1200px]">
            <div className="home-audiences-heading">
              <p className="home-section-label">Deux expériences, selon votre rôle</p>
              <h2 className="home-section-title">La gestion côté bailleur. Le suivi côté locataire.</h2>
              <p className="home-section-intro">
                Pro organise le travail du bailleur ; Me rassemble, sur invitation, les informations rendues accessibles au locataire.
              </p>
            </div>
            <div className="home-audiences-grid">
              <article className="home-audience home-audience--pro">
                <div className="home-audience-topline"><Building2 size={19} aria-hidden="true" /> Pour les bailleurs</div>
                <h2>Une gestion qui reste lisible, période après période.</h2>
                <div className="home-audience-scene home-audience-scene--pro" role="group" aria-label="Schéma illustratif des fonctions de Sikaloc Pro">
                  <p className="home-audience-scene-label">Sikaloc Pro <span>Schéma illustratif</span></p>
                  <div className="home-pro-scene-rows">
                    <div><span>Logements</span><strong>Organiser les biens</strong></div>
                    <div><span>Baux</span><strong>Retrouver les conditions</strong></div>
                    <div><span>Paiements</span><strong>Suivre les versements</strong></div>
                    <div><span>Documents</span><strong>Consulter les pièces disponibles</strong></div>
                  </div>
                  <p className="home-audience-scene-note">Illustration des rubriques, sans compte ni données réelles.</p>
                </div>
                <Link href="/pro?presentation=1" className="home-audience-link">
                  Voir Sikaloc Pro <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </article>

              <article className="home-audience home-audience--me">
                <div className="home-audience-topline"><Home size={19} aria-hidden="true" /> Pour les locataires</div>
                <h2>Les informations de votre location, dans votre espace.</h2>
                <div className="home-audience-scene home-audience-scene--me" role="group" aria-label="Schéma illustratif des informations consultables dans Sikaloc Me">
                  <p className="home-audience-scene-label">Sikaloc Me <span>Après invitation</span></p>
                  <div className="home-me-scene-card">
                    <span className="home-me-scene-mark" aria-hidden="true"><ScrollText size={19} /></span>
                    <div><strong>Mon espace locataire</strong><small>Informations selon les accès accordés</small></div>
                  </div>
                  <div className="home-me-scene-items" aria-hidden="true">
                    <span>Bail</span><span>Paiements enregistrés</span><span>Documents disponibles</span>
                  </div>
                  <p className="home-audience-scene-note">Schéma illustratif — aucun dossier réel affiché.</p>
                </div>
                <Link href="/me/rejoindre" className="home-audience-link">
                  Comprendre l’accès à Me <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* ── Ce qui se vérifie ────────────────────────────────────────── */}
        <section className="home-trust-section">
          <div className="mx-auto max-w-[1200px]">
            <div className="home-trust-heading">
              <p className="home-section-label">Une promesse mesurée</p>
              <h2 className="home-section-title">Des repères concrets, à chaque étape.</h2>
              <p className="home-section-intro">
                Découvrez ce que chaque espace permet de faire et comment les
                informations sont mises à disposition.
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
              <p className="home-final-kicker">Choisissez votre prochain pas</p>
              <h2 className="text-display-md font-extrabold tracking-tight text-on-dark">
                Une location. Votre manière d’avancer.
              </h2>
              <p className="home-final-description">
                Gérez avec Pro, retrouvez vos informations dans Me sur invitation,
                ou explorez les annonces publiées avec Find.
              </p>
            </div>

            <nav className="home-final-paths" aria-label="Choisir un espace Sikaloc">
              <Link href={utilisateur ? '/entrer' : '/inscription'} className="home-final-path home-final-path--pro">
                <span className="home-final-path-space">Pro</span>
                <span className="home-final-path-label">{utilisateur ? 'Ouvrir mon espace' : 'Créer un compte bailleur'}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/me/rejoindre" className="home-final-path">
                <span className="home-final-path-space">Me</span>
                <span className="home-final-path-label">Accéder sur invitation</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/find" className="home-final-path">
                <span className="home-final-path-space">Find</span>
                <span className="home-final-path-label">Explorer les annonces</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </nav>

          </div>
        </section>
      </main>

      <PiedDePage />
      <WidgetWhatsApp />
    </div>
  )
}
