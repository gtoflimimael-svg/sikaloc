import {
  ArrowRight,
  Building2,
  FileCheck,
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
 * Vers `/me/rejoindre` et non directement vers l'espace privé : le locataire
 * qui a reçu une invitation y trouve les étapes pour rejoindre son espace.
 */
const LIENS_TIROIR_ACCUEIL: LienEnTete[] = [
  { href: '#espaces', libelle: 'Les espaces' },
  { href: '#parcours', libelle: 'Comment ça marche' },
  { href: '/find', libelle: 'Trouver un logement' },
  { href: '/pro', libelle: 'Bailleurs' },
  { href: '/me/rejoindre', libelle: 'Je suis locataire' },
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
                <p className="home-section-label">Les espaces Sikaloc</p>
                <h2 className="home-section-title">
                  Gérer, consulter ou chercher : à chacun son espace.
                </h2>
              </div>
              <p className="home-section-intro">
                Pro accompagne le bailleur, Me le locataire invité, et Find les
                personnes qui parcourent les annonces publiées.
              </p>
            </div>

            <article className="home-product-story home-product-story--pro">
              <div className="home-product-story-copy">
                <p className="home-product-label">Sikaloc Pro</p>
                <h3 className="home-product-title">Vos locations, enfin organisées.</h3>
                <p className="home-product-description">
                  Retrouvez vos logements, vos locataires, vos baux et le suivi
                  des loyers dans un même espace.
                </p>
                <Link href="/pro" className="home-product-link">
                  Découvrir Sikaloc Pro <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <figure className="home-product-visual home-product-visual--pro">
                <div className="home-product-visual-frame">
                  <Image
                    src="/demo/pro-tableau-de-bord.png"
                    alt="Capture de démonstration du tableau de bord Sikaloc Pro avec des données fictives."
                    width={2560}
                    height={1720}
                    sizes="(max-width: 900px) 90vw, (max-width: 1100px) 58vw, 700px"
                  />
                </div>
                <figcaption>Aperçu du logiciel — données fictives</figcaption>
              </figure>
            </article>
          </div>
        </section>

        <section className="home-me-section" aria-labelledby="home-me-title">
          <div className="mx-auto max-w-[1200px]">
            <article className="home-product-story home-product-story--me">
              <div className="home-product-story-copy">
                <p className="home-product-label">Sikaloc Me</p>
                <h2 id="home-me-title" className="home-product-title">
                  Votre location, vos informations, votre espace.
                </h2>
                <p className="home-product-description">
                  Après invitation, consultez les informations de votre bail,
                  les paiements enregistrés et les documents mis à votre disposition.
                </p>
                <Link href="/me/rejoindre" className="home-product-link">
                  Comment accéder à Sikaloc Me <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <figure className="home-product-visual home-product-visual--me">
                <div className="home-me-illustration">
                  <Image
                    src="/illustrations/home-03.webp"
                    alt="Illustration éditoriale Sikaloc Me : une clé stylisée ouvre un passage entre des espaces architecturaux."
                    width={1200}
                    height={900}
                    sizes="(max-width: 900px) 90vw, (max-width: 1100px) 58vw, 700px"
                  />
                </div>
                <figcaption>Illustration de marque — ceci n’est pas une capture d’écran.</figcaption>
              </figure>
            </article>
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
                Explorer les annonces <ArrowRight size={18} aria-hidden="true" />
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
              <p className="home-section-label">Comment les espaces se complètent</p>
              <h2 className="home-section-title">Chaque espace garde son rôle.</h2>
              <p className="home-journey-transition">
                Dans <strong>Pro</strong>, le bailleur organise ses locations et
                peut choisir de publier une annonce sur <strong>Find</strong>.
                Les candidatures restent des demandes à examiner : elles ne
                créent pas de bail. L’accès à <strong>Me</strong> se fait sur
                invitation du bailleur.
              </p>
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
