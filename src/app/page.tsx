import {
  ArrowRight,
  Building2,
  Database,
  FileCheck,
  Home,
  Lock,
  Search,
  ScrollText,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { EnTetePublic, type LienEnTete } from '@/components/marketing/en-tete-public'
import { PiedDePage } from '@/components/marketing/pied-de-page'
import { WidgetWhatsApp } from '@/components/marketing/widget-whatsapp'
import { Illustration } from '@/components/ui/illustration'
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
    nom: ESPACE_PRO.nom,
    Icone: Building2,
    pour: 'Propriétaires et bailleurs',
    texte:
      'Vos logements, vos locataires, vos baux. Chaque loyer encaissé produit sa quittance, numérotée et horodatée, et les retards remontent d’eux-mêmes.',
    disponible: true,
    lien: { href: '/pro', libelle: 'Découvrir Sikaloc_Pro' },
  },
  {
    nom: ESPACE_ME.nom,
    Icone: ScrollText,
    pour: 'Locataires',
    texte:
      'Votre bail, vos loyers mois par mois, vos quittances à télécharger. Les mêmes documents que votre bailleur — pas des copies.',
    disponible: true,
    // Pas `/me` : cette adresse exige une session, et un curieux y serait
    // renvoyé vers un formulaire de connexion sans identifiants.
    lien: { href: '/me/rejoindre', libelle: 'Comment y accéder' },
  },
  {
    nom: 'Sikaloc_Find',
    Icone: Search,
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
  'Des quittances conformes aux mentions attendues au Bénin, générées à chaque paiement',
  'Les loyers en retard remontés d’eux-mêmes, avec le nombre de jours',
  'Un tableau de bord : qui a payé, qui doit encore, combien ce mois-ci',
]

/**
 * Ce que Sikaloc_Me apporte au locataire.
 *
 * Le troisième point est le moins spectaculaire et le plus important : c'est la
 * seule ligne de cette page qui protège le locataire contre le produit
 * lui-même.
 */
const POUR_LOCATAIRES = [
  'Vos quittances téléchargeables à tout moment, avec leur numéro et leur empreinte',
  'Vos loyers mois par mois — le même calcul que celui de votre bailleur',
  'Les mois antérieurs à l’arrivée de votre bailleur sur Sikaloc s’affichent « à déterminer », jamais « impayé »',
]

/**
 * Ce qui se vérifie.
 *
 * Aucun témoignage, aucun chiffre d'usage : Sikaloc n'en a pas encore, et en
 * inventer serait un faux. Ces trois affirmations se contrôlent — la première
 * en ouvrant un document, les deux autres en lisant la politique de
 * confidentialité.
 */
const VERIFIABLE = [
  {
    Icone: FileCheck,
    titre: 'Des documents vérifiables',
    texte:
      'Chaque quittance porte un numéro continu et une empreinte SHA-256 : la moindre modification du fichier devient détectable.',
  },
  {
    Icone: Database,
    titre: 'Des données cloisonnées',
    texte:
      'Chaque bailleur ne voit que les siennes, isolées au niveau de la base. Un locataire ne voit que son propre bail.',
  },
  {
    Icone: Lock,
    titre: 'Hébergées en Europe',
    texte:
      'Échanges chiffrés, stockage privé. Vos données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires.',
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
        <section className="relative overflow-hidden px-xl py-5xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-pill bg-primary-pale opacity-60 blur-3xl"
          />

          <div className="relative mx-auto max-w-[1200px]">
            <div className="grid items-center gap-4xl lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <span className="badge badge-neutral mb-lg">Bénin</span>

                <h1 className="text-balance text-display-lg font-extrabold tracking-tight text-ink sm:text-display-xl lg:text-display-xxl">
                  La location, écrite noir sur blanc
                </h1>

                <p className="anim-monte mt-xl max-w-[38rem] text-body-lg text-body">
                  Au Bénin, un loyer se règle souvent de la main à la main, et la
                  relation tient sur la parole. Sikaloc en garde la trace — pour
                  le bailleur qui encaisse comme pour le locataire qui paie.
                </p>

                <div className="mt-2xl flex flex-wrap items-center gap-md">
                  <Link href="/pro" className="btn btn-primary">
                    Je suis bailleur
                  </Link>
                  <Link
                    href="/me/rejoindre"
                    className="lien-anime text-body-sm font-medium text-ink"
                  >
                    Je suis locataire
                  </Link>
                </div>

                <p className="mt-lg text-body-sm text-mute">
                  Trois espaces, un seul compte. Les documents ne sont pas
                  recopiés d’un espace à l’autre : ce sont les mêmes.
                </p>
              </div>

              <div className="relative flex justify-center lg:justify-end">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 m-auto size-[26rem] rounded-pill bg-primary-pale opacity-70 blur-3xl"
                />
                <Illustration
                  nom="lecture"
                  taille={440}
                  className="relative w-full max-w-[26rem] text-ink"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Le problème ──────────────────────────────────────────────── */}
        <section className="bg-canvas px-xl py-5xl">
          <div className="mx-auto max-w-[48rem]">
            <p className="text-caption-uppercase uppercase text-primary">
              Ce que Sikaloc cherche à réparer
            </p>
            <h2 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">
              Sans écrit, tout repose sur la mémoire des deux parties
            </h2>

            <div className="mt-2xl grid gap-xl sm:grid-cols-2">
              <div>
                <p className="text-body-md font-semibold text-ink">
                  Le bailleur ne peut rien opposer
                </p>
                <p className="mt-sm text-body-md text-mute">
                  Un locataire affirme avoir payé le mois dernier. Sans écrit daté
                  et numéroté, la discussion devient parole contre parole — et le
                  retard se découvre tard, quand il s’est accumulé.
                </p>
              </div>
              <div>
                <p className="text-body-md font-semibold text-ink">
                  Le locataire ne peut rien prouver
                </p>
                <p className="mt-sm text-body-md text-mute">
                  Il a réglé, parfois pendant des années, sans jamais recevoir de
                  quittance. Le jour où on lui en demande une, il n’a rien à
                  produire.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Les trois espaces ────────────────────────────────────────── */}
        <section id="espaces" className="px-xl py-5xl">
          <div className="mx-auto max-w-[1100px]">
            <p className="text-caption-uppercase uppercase text-primary">
              L’écosystème
            </p>
            <h2 className="mt-sm max-w-[44rem] text-display-md font-extrabold tracking-tight text-ink">
              Trois espaces, un seul jeu de documents
            </h2>
            <p className="mt-lg max-w-[42rem] text-body-lg text-body">
              Ce ne sont pas trois produits qui se parlent. C’est un seul produit
              vu depuis trois places : un bail lu par son bailleur et par son
              locataire est le même bail, pas une copie synchronisée.
            </p>

            <div className="mt-2xl grid gap-lg md:grid-cols-3">
              {ESPACES_PRESENTES.map(({ nom, Icone, pour, texte, disponible, lien }) => (
                <div
                  key={nom}
                  className={`flex flex-col rounded-xl border p-xl ${
                    disponible
                      ? 'border-hairline bg-canvas'
                      : // La carte de l'espace à venir est visuellement en
                        // retrait : rien ne doit laisser croire qu'on peut y
                        // entrer aujourd'hui.
                        'border-dashed border-hairline bg-transparent'
                  }`}
                >
                  <Icone
                    size={24}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className={disponible ? 'text-primary' : 'text-mute-soft'}
                  />

                  <p className="mt-md text-body-lg font-semibold text-ink">{nom}</p>
                  <p className="text-caption uppercase tracking-wide text-mute">{pour}</p>

                  <p className="mt-md flex-1 text-body-sm text-body">{texte}</p>

                  {disponible && lien ? (
                    <Link
                      href={lien.href}
                      className="mt-lg inline-flex items-center gap-xs text-body-sm font-semibold text-ink hover:underline"
                    >
                      {lien.libelle}
                      <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
                    </Link>
                  ) : (
                    <p className="mt-lg text-body-sm font-semibold text-mute">
                      N’existe pas encore
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Le parcours ──────────────────────────────────────────────── */}
        <section id="parcours" className="bg-canvas px-xl py-5xl">
          <div className="mx-auto max-w-[56rem]">
            <p className="text-caption-uppercase uppercase text-primary">
              Comment ça marche
            </p>
            <h2 className="mt-sm max-w-[42rem] text-display-md font-extrabold tracking-tight text-ink">
              Le même logement, d’un espace à l’autre
            </h2>

            <ol className="mt-2xl space-y-lg">
              {PARCOURS.map(({ numero, espace, titre, texte, avenir }) => (
                <li
                  key={numero}
                  className="flex gap-lg rounded-xl border border-hairline bg-canvas-soft p-lg"
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-9 shrink-0 items-center justify-center rounded-pill text-body-sm font-bold ${
                      avenir ? 'bg-canvas text-mute' : 'bg-primary text-on-primary'
                    }`}
                  >
                    {numero}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-sm">
                      <span className="text-body-md font-semibold text-ink">{titre}</span>
                      {/*
                        `text-mute` et non `text-mute-soft` : cette teinte
                        plafonne à 3,13:1 en clair, sous le seuil WCAG de
                        4,5:1 — elle est faite pour du décoratif, or ce
                        texte porte le nom de l'espace. Trouvé par
                        `banc:contraste`, pas à l'œil.
                      */}
                      <span className="text-caption text-mute">{espace}</span>
                      {avenir ? (
                        <span className="badge badge-neutral text-caption">À venir</span>
                      ) : null}
                    </p>
                    <p className="mt-xs text-body-sm text-mute">{texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Pour les bailleurs ───────────────────────────────────────── */}
        <section className="px-xl py-5xl">
          <div className="mx-auto grid max-w-[1100px] gap-4xl lg:grid-cols-2">
            <div>
              <p className="text-caption-uppercase uppercase text-primary">
                Pour les bailleurs
              </p>
              <h2 className="mt-sm text-display-sm font-extrabold tracking-tight text-ink">
                Vous encaissez, Sikaloc écrit
              </h2>
              <ul role="list" className="mt-lg space-y-md">
                {POUR_BAILLEURS.map((point) => (
                  <li key={point} className="flex items-start gap-sm text-body-md text-body">
                    <Building2
                      size={17}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="mt-xxs shrink-0 text-primary"
                    />
                    {point}
                  </li>
                ))}
              </ul>
              <Link href="/pro" className="btn btn-primary mt-xl">
                Voir {ESPACE_PRO.nom} en détail
              </Link>
            </div>

            <div>
              <p className="text-caption-uppercase uppercase text-primary">
                Pour les locataires
              </p>
              <h2 className="mt-sm text-display-sm font-extrabold tracking-tight text-ink">
                Vous payez, vous gardez la preuve
              </h2>
              <ul role="list" className="mt-lg space-y-md">
                {POUR_LOCATAIRES.map((point) => (
                  <li key={point} className="flex items-start gap-sm text-body-md text-body">
                    <Home
                      size={17}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="mt-xxs shrink-0 text-primary"
                    />
                    {point}
                  </li>
                ))}
              </ul>
              {/*
                Pas de bouton principal ici : le locataire n'a rien à acheter, et
                il n'entre pas de lui-même. Le lien explique comment son bailleur
                lui ouvre l'accès — c'est la seule chose vraie à lui proposer.
              */}
              <Link href="/me/rejoindre" className="btn btn-secondary mt-xl">
                Comment accéder à {ESPACE_ME.nom}
              </Link>
            </div>
          </div>
        </section>

        {/* ── Ce qui se vérifie ────────────────────────────────────────── */}
        <section className="border-t border-hairline px-xl py-5xl">
          <div className="mx-auto max-w-[56rem]">
            <p className="text-caption-uppercase uppercase text-primary">
              Ce que vous pouvez vérifier
            </p>
            <h2 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">
              Pas de témoignages : des faits contrôlables
            </h2>

            <div className="mt-2xl grid gap-xl sm:grid-cols-3">
              {VERIFIABLE.map(({ Icone, titre, texte }) => (
                <div key={titre}>
                  <Icone size={22} strokeWidth={1.9} aria-hidden="true" className="text-primary" />
                  <p className="mt-md text-body-md font-semibold text-ink">{titre}</p>
                  <p className="mt-xs text-body-sm text-mute">{texte}</p>
                </div>
              ))}
            </div>

            <div className="mt-xl flex flex-wrap gap-lg">
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

        {/* ── Appel final ──────────────────────────────────────────────── */}
        <section className="px-xl pb-5xl">
          <div className="mx-auto max-w-[1100px] rounded-xl bg-surface-dark px-xl py-4xl text-center">
            <h2 className="mx-auto max-w-[36rem] text-display-md font-extrabold tracking-tight text-on-dark">
              {utilisateur
                ? 'Reprenez où vous en étiez'
                : 'Commencez par le bout qui vous concerne'}
            </h2>

            <div className="mt-2xl flex flex-wrap items-center justify-center gap-md">
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

            <p className="mx-auto mt-lg max-w-[34rem] text-body-sm text-on-dark-mute">
              La création de compte concerne les bailleurs. Un locataire reçoit
              son accès de son bailleur, et ne paie rien.
            </p>
          </div>
        </section>
      </main>

      <PiedDePage />
      <WidgetWhatsApp />
    </div>
  )
}
