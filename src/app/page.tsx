import {
  ArrowRight,
  Building2,
  ScrollText,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

import { EnTetePublic, type LienEnTete } from '@/components/marketing/en-tete-public'
import { ApercuQuittanceDemonstration } from '@/components/marketing/apercu-quittance-demonstration'
import { FAQAccueil } from '@/components/marketing/faq-accueil'
import { PiedDePage } from '@/components/marketing/pied-de-page'
import { WidgetWhatsApp } from '@/components/marketing/widget-whatsapp'
import { URL_EXEMPLE_QUITTANCE } from '@/lib/pdf/exemple-url'
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
        <section id="espaces" className="home-spaces-section" aria-labelledby="home-pro-title">
          <div className="mx-auto max-w-[1200px]">
            <article className="home-product-story home-product-story--pro">
              <div className="home-product-story-copy">
                <p className="home-product-label">Sikaloc Pro</p>
                <h2 id="home-pro-title" className="home-product-title">Vos locations, enfin organisées.</h2>
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
                    src="/images/home/sikaloc-pro-editorial.webp"
                    alt="Scène illustrative : une propriétaire béninoise organise ses locations dans son espace de travail."
                    width={1536}
                    height={1024}
                    sizes="(max-width: 900px) 92vw, (max-width: 1200px) 60vw, 700px"
                  />
                </div>
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
                  Votre location, votre espace.
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
                <div className="home-product-visual-frame">
                  <Image
                    src="/images/home/sikaloc-me-editorial.webp"
                    alt="Scène illustrative : une locataire béninoise consulte son téléphone dans son logement."
                    width={1536}
                    height={1024}
                    sizes="(max-width: 900px) 92vw, (max-width: 1200px) 60vw, 700px"
                  />
                </div>
              </figure>
            </article>
          </div>
        </section>

        <section id="trouver" className="home-find-section" aria-labelledby="home-find-title">
          <div className="home-find-layout mx-auto max-w-[1200px]">
            <div className="home-find-copy">
              <p className="home-product-label">Sikaloc Find</p>
              <h2 id="home-find-title" className="home-product-title">
                Cherchez avec vos propres repères.
              </h2>
              <p className="home-product-description">
                Choisissez une ville, un type de bien et une fourchette de loyer.
                Find affiche les annonces publiées qui correspondent à votre recherche.
              </p>
              <Link href="/find" className="home-product-link">
                Explorer les annonces <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>

            <figure className="home-product-visual home-product-visual--find">
              <div className="home-product-visual-frame">
                <Image
                  src="/images/home/sikaloc-find-editorial.webp"
                  alt="Scène illustrative : un couple béninois découvre un appartement contemporain."
                  width={1536}
                  height={1024}
                  sizes="(max-width: 900px) 92vw, (max-width: 1200px) 60vw, 700px"
                />
              </div>
            </figure>
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

        {/* ── Suivi locatif et documents ───────────────────────────────── */}
        <section className="home-document-section" aria-labelledby="home-document-title">
          <div className="home-document-layout mx-auto max-w-[1200px]">
            <div className="home-document-copy">
              <p className="home-section-label">Suivi locatif &amp; documents</p>
              <h2 id="home-document-title" className="home-document-title">
                <span>Des loyers suivis.</span>
                <span>Des documents à retrouver.</span>
              </h2>
              <p className="home-document-description">
                Retrouvez les paiements enregistrés, les périodes de location et
                les documents mis à disposition, selon votre rôle et vos accès.
              </p>
              <div className="home-document-actions">
                <Link href={URL_EXEMPLE_QUITTANCE} className="home-product-link">
                  Voir un exemple de quittance <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link href="/legal/confidentialite" className="home-document-privacy lien-anime">
                  Lire la politique de confidentialité
                </Link>
              </div>
            </div>

            <ApercuQuittanceDemonstration />
          </div>
        </section>

        <section id="faq" className="home-faq-section" aria-labelledby="home-faq-title">
          <div className="home-faq-layout mx-auto max-w-[1200px]">
            <div className="home-faq-heading">
              <p className="home-section-label">Questions fréquentes</p>
              <h2 id="home-faq-title" className="home-section-title">Des questions avant de commencer&nbsp;?</h2>
            </div>
            <FAQAccueil />
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
