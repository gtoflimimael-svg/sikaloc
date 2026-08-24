import {
  BellRing,
  ChartColumn,
  Check,
  Database,
  FileCheck,
  Lock,
  MessageCircle,
  Scale,
  Send,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  X,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { FormulaireGuide } from '@/components/marketing/formulaire-guide'
import { MenuMobile } from '@/components/marketing/menu-mobile'
import { PiedDePage } from '@/components/marketing/pied-de-page'
import { WidgetWhatsApp } from '@/components/marketing/widget-whatsapp'
import { Illustration } from '@/components/ui/illustration'
import { MarqueSikaloc } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'
import { formaterFCFA } from '@/lib/format'
import { LIMITE_LOGEMENTS_GRATUIT, PRIX_STANDARD_FCFA } from '@/lib/plan'
import { obtenirUtilisateur } from '@/lib/supabase/serveur'

/**
 * Arguments de la section « Guide ». Chacun renvoie à une section réelle du
 * document — si le guide change, cette liste doit changer avec lui.
 */
const POINTS_GUIDE = [
  'La différence entre une quittance et un reçu, et pourquoi elle compte',
  'Ce que Sikaloc écrit quand un loyer n’est payé qu’en partie',
  'Le numéro continu, l’horodatage et l’empreinte enregistrée à l’émission',
  'Les cinq minutes de correction, et ce qui se passe ensuite',
]

/**
 * Captures de la section « Aperçu du produit ».
 *
 * Produites par `npm run capturer:demo`, qui photographie l'application réelle
 * sur le jeu de démonstration local. À refaire après toute refonte visuelle de
 * l'espace connecté : une capture périmée promet un produit qui n'existe plus.
 */
const apercus = [
  {
    fichier: 'tableau-de-bord.png',
    alt: 'Tableau de bord Sikaloc : taux d’occupation, taux de recouvrement, impayés et loyers en retard.',
    etiquette: 'Votre tableau de bord',
    titre: 'Qui a payé, qui doit encore',
    texte:
      'Le montant encaissé ce mois-ci, les loyers en retard et depuis combien de jours. Sans ouvrir un cahier.',
  },
  {
    fichier: 'saisie-paiement.png',
    alt: 'Formulaire d’enregistrement d’un paiement : bail, montant, mois concerné, mode de paiement.',
    etiquette: 'Enregistrer un paiement',
    titre: 'Six champs, pas un de plus',
    texte:
      'Mobile Money, espèces ou virement. Un montant inférieur au loyer produit un reçu plutôt qu’une quittance — la distinction est faite pour vous.',
  },
  {
    fichier: 'liste-paiements.png',
    alt: 'Historique des paiements avec statut payé ou partiel, et le lien vers la quittance émise.',
    etiquette: 'Votre historique',
    titre: 'Chaque encaissement, son document',
    texte:
      'La quittance est générée à la confirmation et reste téléchargeable. Vous gardez la trace de tout ce que vous avez encaissé.',
  },
]

/**
 * Trois étapes, à l'impératif, chacune close par un bénéfice de sécurité.
 *
 * Chaque promesse est adossée à un mécanisme réel du produit — la fenêtre de
 * correction de 5 minutes (`src/lib/paiement-utils.ts`) et l'empreinte SHA-256
 * enregistrée à l'émission (`src/lib/quittance.ts`). C'est ce qui permet de
 * tenir un registre « protection » sans écrire une seule promesse invérifiable.
 */
const etapes = [
  {
    numero: '1',
    titre: 'Sécurisez votre bail',
    texte:
      'Logement, locataire, loyer, jour d’échéance. Trois minutes pour tout mettre à plat, une fois pour toutes.',
  },
  {
    numero: '2',
    titre: 'Tracez chaque paiement',
    texte:
      'Montant, période, mode de règlement. Sikaloc calcule et vous montre le récapitulatif avant validation. Cinq minutes pour corriger, puis le paiement est figé — c’est ce qui rend la quittance opposable.',
  },
  {
    numero: '3',
    titre: 'Gardez la preuve',
    texte:
      'Le PDF est généré, numéroté et horodaté, avec son empreinte d’intégrité : si le document reçu est contesté, la moindre modification se voit. Un bouton l’envoie au locataire sur WhatsApp.',
  },
]

/**
 * Fonctionnalités, ordonnées selon la pyramide du positionnement : la preuve
 * d'abord (le levier dominant), puis le contrôle, puis l'efficacité.
 *
 * Règle tenue ici : on décrit ce que le document EST, jamais ce qu'un tribunal
 * en fera. « Fait preuve du paiement » est vérifiable — c'est une décharge
 * signée des deux parties ; « vous protège en justice » ne l'est pas, et
 * contredirait les CGU, qui excluent tout conseil juridique.
 *
 * La seule capacité encore réservée au plan Standard — les relances WhatsApp —
 * le dit dans son propre texte : la landing ne peut pas promettre au visiteur
 * ce que `capacites()` refusera au compte gratuit qu'il vient de créer.
 */
const fonctionnalites = [
  {
    Icone: FileCheck,
    titre: 'Des quittances qui font preuve',
    texte:
      'Identité des parties, adresse, période, montant en lettres et en chiffres, décharge, horodatage et votre signature. Chaque document reçoit un numéro continu, une empreinte d’intégrité et la mention du droit de timbre.',
  },
  {
    Icone: BellRing,
    titre: 'Aucun loyer ne s’échappe',
    texte:
      'Chaque bail a son jour d’échéance et sa tolérance. Passé le délai, le loyer bascule en impayé et remonte en haut de votre tableau de bord. Vous agissez avant que le retard ne s’enlise.',
  },
  {
    Icone: MessageCircle,
    titre: 'Relancez sans confrontation',
    texte:
      'Le message est pré-rédigé avec le nom, la période, le montant et l’échéance. Vous relisez, vous envoyez depuis votre propre WhatsApp — Sikaloc n’écrit jamais à votre place. Les relances se débloquent avec le plan Standard.',
  },
  {
    Icone: ChartColumn,
    titre: 'Votre parc, chiffres à l’appui',
    texte:
      'Taux d’occupation, taux de recouvrement, impayés, chiffre d’affaires du mois. Mis à jour à chaque paiement. Vous savez où vous en êtes, sans surprise.',
  },
  {
    Icone: Send,
    titre: 'Rien à installer pour le locataire',
    texte:
      'Il reçoit sa quittance sur WhatsApp, par un lien de téléchargement sécurisé valable 30 jours. Pas de compte, pas de mot de passe. La preuve est entre ses mains.',
  },
  {
    Icone: Database,
    titre: 'Vos données, cloisonnées',
    texte:
      'Chaque bailleur ne voit que ses propres données, isolées au niveau de la base. Hébergement en Europe, échanges chiffrés.',
  },
]

/**
 * Ligne de preuves du hero — trois faits vrais pour LES DEUX plans.
 *
 * La mention du droit de timbre y figure depuis qu'elle n'est plus réservée au
 * plan payant : le visiteur qui clique sur un CTA gratuit obtiendra bien le
 * document décrit ici.
 */
const preuves = [
  'Mentions attendues au Bénin, droit de timbre compris',
  'Numérotation continue et horodatage',
  'Envoi au locataire sur WhatsApp',
]

/**
 * Barre de confiance — trois raisons de rester, à la place d'une preuve
 * sociale que Sikaloc n'a pas encore.
 *
 * Les trois affirmations sont vérifiables, ce qui n'était pas le cas de celles
 * du rapport. La sous-ligne du premier badge portait jusqu'ici la réserve
 * « au plan Standard » : elle n'a plus lieu d'être, la mention du droit de
 * timbre figurant désormais sur toute quittance, quel que soit le plan.
 *
 * « Développé au Bénin » a été écarté : rien dans le dépôt ne permet de
 * l'établir, et une barre de confiance ne peut pas s'ouvrir sur une
 * affirmation invérifiable. Le Mobile Money et WhatsApp disent la même chose
 * — c'est un produit local — et se prouvent en ouvrant l'application.
 */
const confiance = [
  {
    Icone: ShieldCheck,
    titre: 'Calibré pour le droit béninois',
    detail: 'Mention du droit de timbre incluse',
  },
  {
    Icone: Lock,
    titre: 'Données sécurisées',
    detail: 'Hébergement en Europe, chiffré',
  },
  {
    Icone: Smartphone,
    titre: 'Mobile Money et WhatsApp',
    detail: 'Sans carte bancaire ni installation',
  },
]

/**
 * Section douleur — nommer la situation, jamais reprocher la pratique.
 *
 * Les quatre situations du rapport ont été refondues sur deux points.
 *
 * D'abord un retournement : sa première situation affirmait qu'une quittance
 * sans mention du droit de timbre « peut être rejetée » — c'était alors le
 * document que produisait le plan Gratuit, et la page aurait disqualifié sa
 * propre offre d'entrée. La douleur est ramenée à ce qui est vrai dans tous
 * les cas : l'absence de trace.
 *
 * Ensuite le registre : « Vous perdez des heures », « Vous hésitez à relancer »
 * reprochent au bailleur sa façon de faire. Le rapport pose pourtant lui-même
 * la règle (§5.1) : « on n'agite pas la douleur pour faire du chantage ». Les
 * situations décrivent donc ce qui arrive, pas ce qu'il aurait fallu faire.
 *
 * Aucune ne conclut sur le sort d'un procès : « impossible de prouver devant
 * un juge » est un pronostic juridique, que les CGU excluent.
 */
const douleurs = [
  {
    situation: 'Votre locataire affirme avoir payé le mois dernier.',
    consequence:
      'Sans écrit daté et numéroté, la discussion devient parole contre parole.',
  },
  {
    situation: 'Vous ne savez plus avec certitude qui a réglé quel mois.',
    consequence: 'Le retard se découvre tard, quand il s’est déjà accumulé.',
  },
  {
    situation: 'La relance attend le bon moment, et le bon moment ne vient pas.',
    consequence: 'Plus le silence dure, plus la conversation devient difficile.',
  },
  {
    situation: 'Chaque quittance est réécrite à la main, une par une.',
    consequence: 'Une mention oubliée, et le document perd de sa valeur.',
  },
]

/**
 * Preuve de sérieux — ce qui remplace les témoignages tant qu'il n'y a pas
 * d'utilisateurs à citer.
 *
 * Deux blocs seulement, et non les trois du rapport : le troisième demandait
 * une photo du fondateur et une citation signée de son nom, que le rapport
 * lui-même laisse « à fournir par le fondateur ». Inventer une phrase et la
 * signer du nom de quelqu'un serait un faux ; le bloc attend donc son texte.
 *
 * Le bloc juridique ne reprend pas « une preuve datée irréfutable » (§9.3) :
 * le PDF imprime lui-même que sa signature est simple et non qualifiée. Il
 * décrit ce que le document contient et ce qui le rend vérifiable — l'empreinte
 * SHA-256 — puis renvoie à l'exemple réel, qui vaut mieux que l'adjectif.
 */
const preuvesSerieux = [
  {
    Icone: Scale,
    titre: 'Une quittance que l’on peut vérifier',
    points: [
      'Identité des parties, adresse, période, montant en lettres et en chiffres, décharge, horodatage et signature.',
      'Un numéro continu et une empreinte SHA-256 par document : toute modification du fichier devient détectable.',
      'La mention du droit de timbre figure sur toute quittance, quel que soit votre plan.',
    ],
    lien: { href: '/exemple-quittance', libelle: 'Voir un exemple de quittance' },
  },
  {
    Icone: Lock,
    titre: 'Vos données restent cloisonnées',
    points: [
      'Chaque bailleur ne voit que ses propres données, isolées au niveau de la base.',
      'Hébergement en Europe (Francfort), échanges chiffrés en HTTPS.',
      'Vos données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires.',
      'Les quittances vivent dans un stockage privé, partagées par liens signés à durée limitée.',
    ],
    lien: { href: '/legal/confidentialite', libelle: 'Lire la politique de confidentialité' },
  },
]

const questions = [
  {
    q: 'Mes quittances sont-elles valables au Bénin ?',
    r: 'Le modèle reprend les mentions attendues : identité des parties, adresse du logement, période, montant en lettres et en chiffres, décharge, mention du droit de timbre à la charge du locataire, horodatage et signature du bailleur. Sikaloc ne fournit pas de conseil juridique : faites valider le modèle par votre conseil avant un usage contentieux.',
  },
  {
    q: 'Le locataire doit-il créer un compte ?',
    r: 'Non. Il reçoit sa quittance par WhatsApp, via un lien de téléchargement sécurisé valable 30 jours.',
  },
  {
    /*
     * La réponse du rapport annonçait « quittances PDF standards » et
     * « export historique ». La première formule entre en collision avec le nom
     * du plan payant ; la seconde vend une fonctionnalité absente du code. La
     * réponse ci-dessous ne cite que les trois différences que `capacites()`
     * applique réellement.
     */
    q: 'Quelle est la différence entre le plan Gratuit et le plan Standard ?',
    r: `Deux choses, et rien d’autre. Le plan Gratuit s’arrête à ${LIMITE_LOGEMENTS_GRATUIT} logements, et les relances WhatsApp n’y sont pas disponibles. Tout le reste est identique — y compris les quittances elles-mêmes : mêmes mentions, même numérotation, même horodatage, même mention du droit de timbre.`,
  },
  {
    q: 'Comment je paie mon abonnement ?',
    r: `Par Mobile Money, ${formaterFCFA(PRIX_STANDARD_FCFA)} par mois, sans engagement. Le plan Gratuit reste disponible jusqu’à ${LIMITE_LOGEMENTS_GRATUIT} logements.`,
  },
  {
    q: 'Et si je me trompe en saisissant un paiement ?',
    r: 'Vous avez 5 minutes après validation pour corriger. Passé ce délai, le paiement est figé — c’est ce qui rend la quittance opposable.',
  },
  {
    // Prolonge la première question au lieu de la contredire : elle renvoie au
    // conseil du bailleur, cette réponse ne peut donc pas promettre qu'il n'a
    // « plus à vérifier lui-même », comme le proposait le rapport d'origine.
    q: 'Pourquoi Sikaloc insiste-t-il autant sur les quittances ?',
    r: 'Parce qu’une quittance mal rédigée se retourne contre le bailleur. Sikaloc pose les mentions attendues à chaque paiement, sans que vous ayez à les ressaisir, quel que soit votre plan. Cela ne remplace pas l’avis de votre conseil, mais vous n’avez plus à reconstituer une preuve après coup.',
  },
]

export default async function PageAccueil() {
  const utilisateur = await obtenirUtilisateur()

  return (
    <div className="min-h-screen bg-canvas-soft">
      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-sm px-lg xl:px-xl">
          {/*
            Le wordmark fait 178 px de large en taille `md` — à lui seul, plus
            de la moitié d'un écran de 360 px. La barre passe donc à la taille
            `sm` sous `lg`, comme le fait déjà l'en-tête de l'application
            (`EnTeteMobile`). Deux rendus plutôt qu'une classe responsive :
            la taille pilote la largeur du SVG, pas seulement sa police.

            Le basculement se fait à `lg` et non à `md` : à exactement 768 px,
            le wordmark en taille `md`, les trois ancres, le sélecteur de thème
            et les deux boutons réclamaient ensemble 854 px pour 768 px
            disponibles — l'en-tête débordait. Le tiroir couvre donc aussi la
            tranche 768–1023 px, celle des tablettes en portrait.
          */}
          <span className="lg:hidden">
            <MarqueSikaloc taille="sm" />
          </span>
          <span className="hidden lg:block">
            <MarqueSikaloc />
          </span>

          {/*
            L'écart entre les ancres et les marges internes ne passent à leur
            valeur confortable qu'à partir de `xl`. À exactement 1024 px, la
            largeur du point de bascule, la barre consommait 949 px pour 960 px
            disponibles : 11 px de marge, de quoi déborder au premier libellé
            rallongé ou à la première ancre ajoutée. Les deux réglages rendent
            32 px sans que rien ne se voie, et la respiration d'origine revient
            dès 1280 px, où la place ne manque plus.
          */}
          <div className="hidden items-center gap-lg lg:flex xl:gap-xl">
            <Link href="#fonctionnalites" className="text-nav-link text-body hover:text-ink">
              Fonctionnalités
            </Link>
            <Link href="#etapes" className="text-nav-link text-body hover:text-ink">
              Comment ça marche
            </Link>
            <Link href="#tarifs" className="text-nav-link text-body hover:text-ink">
              Tarifs
            </Link>
          </div>

          {/*
            Sous `md`, la barre ne garde qu'une seule action plus le tiroir :
            « Se connecter » et « Commencer » côte à côte poussaient l'en-tête
            à 447 px de large pour un écran de 360 px, et la page débordait
            horizontalement. « Commencer » reste dehors — un CTA rangé dans un
            menu n'est plus un CTA — et le reste passe dans le tiroir.
          */}
          <div className="flex items-center gap-sm">
            <div className="hidden sm:block">
              <SelecteurTheme compact />
            </div>
            {utilisateur ? (
              <Link href="/app" className="btn btn-primary btn-sm">
                Mon tableau de bord
              </Link>
            ) : (
              <>
                <Link href="/connexion" className="btn btn-secondary btn-sm max-lg:hidden">
                  Se connecter
                </Link>
                <Link href="/inscription" className="btn btn-primary btn-sm">
                  Commencer
                </Link>
              </>
            )}

            <MenuMobile connecte={Boolean(utilisateur)} />
          </div>
        </nav>
      </header>

      {/*
        Repère `main` : la page n'en avait aucun. Les lecteurs d'écran s'en
        servent pour sauter la navigation et atteindre le contenu directement —
        sans lui, il faut retraverser l'en-tête à chaque arrivée sur la page.
        Les écrans d'authentification (`CarteAuth`) en portaient déjà un.
      */}
      <main id="contenu">

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-xl py-5xl">
        {/* Formes décoratives — purement atmosphériques, jamais interactives. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-pill bg-primary-pale opacity-60 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-20 size-80 rounded-pill bg-accent-sand opacity-20 blur-3xl"
        />

        <div className="relative mx-auto max-w-[1200px]">
          <div className="grid items-center gap-4xl lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="badge badge-neutral mb-lg">
                Conçu pour les bailleurs au Bénin
              </span>

              {/*
                Pas d'`anim-monte` sur le H1 : il est l'élément LCP de la page,
                et l'animation le maintient à `opacity: 0` pendant 460 ms — le
                navigateur ne compte comme « peint » que ce qui est visible.
                L'entrée animée est déplacée sur le sous-titre, qui ne l'est pas.
                Pas de <br /> non plus : la coupure manuelle était calibrée pour
                l'ancien titre de 27 caractères, sur quatre tailles différentes.
                `text-balance` répartit les lignes proprement à toutes tailles.
              */}
              {/*
                Plafonné à `display-xxl`, sans le palier `xl:display-mega` de
                l'ancien titre : celui-ci tenait en 27 caractères, celui-là en
                fait 55. À 80 px, il occupait cinq lignes et 420 px de haut, ce
                qui repoussait le bouton principal sous la ligne de flottaison
                sur un écran de 900 px. Mesuré, pas supposé.
              */}
              <h1 className="text-balance text-display-lg font-extrabold tracking-tight text-ink sm:text-display-xl lg:text-display-xxl">
                Vos quittances de loyer tiendront-elles devant un juge ?
              </h1>

              <p className="anim-monte mt-xl max-w-[36rem] text-body-lg text-body">
                Sikaloc génère vos quittances : numérotées, horodatées, montant
                en lettres, décharge et signature. Vos locataires les reçoivent
                sur WhatsApp, et vous gardez la preuve de chaque loyer encaissé.
              </p>

              {/* Empilée sous 640 px : en une seule ligne à séparateurs « · »,
                  les trois preuves passaient à la ligne n'importe où. */}
              <ul
                role="list"
                className="mt-lg flex flex-col gap-xs sm:flex-row sm:flex-wrap sm:gap-lg"
              >
                {preuves.map((preuve) => (
                  <li key={preuve} className="flex items-start gap-xs text-body-sm text-body">
                    <Check
                      size={17}
                      strokeWidth={2.5}
                      aria-hidden="true"
                      className="mt-xxs shrink-0 text-primary"
                    />
                    <span>{preuve}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-2xl flex flex-wrap items-center gap-md">
                {/*
                  Libellé court à dessein : `.btn` est en `white-space: nowrap`
                  et à hauteur fixe, il ne peut donc ni revenir à la ligne ni
                  s'élargir. « Protéger mes revenus — Gratuit jusqu'à 2
                  logements » réclamait 416 px pour 296 px disponibles à 360 px
                  de large : la page débordait horizontalement. L'argument de
                  gratuité vit sur la ligne de réassurance, juste en dessous,
                  qui interpole déjà la constante.
                */}
                <Link href="/inscription" className="btn btn-primary">
                  Protéger mes revenus
                </Link>
                <Link
                  href="/exemple-quittance"
                  className="lien-anime text-body-sm font-medium text-ink"
                >
                  Voir un exemple de quittance
                </Link>
              </div>

              <p className="mt-lg text-body-sm text-mute">
                Gratuit jusqu&apos;à {LIMITE_LOGEMENTS_GRATUIT} logements · Sans carte
                bancaire · Mobile Money accepté
              </p>
            </div>

            {/*
              Illustration plutôt que maquette d'interface : un faux tableau de
              bord promet un écran, une illustration promet un état d'esprit —
              et c'est ce que vend la page (« sans effort »).
            */}
            <div className="relative flex justify-center lg:justify-end">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 m-auto size-[26rem] rounded-pill bg-primary-pale opacity-70 blur-3xl"
              />
              <Illustration
                nom="fauteuil"
                taille={460}
                className="relative w-full max-w-[28rem] text-ink"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Barre de confiance ─────────────────────────────────────────── */}
      {/* Posée juste sous le hero : le visiteur vient de lire une question
          inquiétante, il lui faut une raison de continuer avant la suite.
          Bande basse et filets plutôt qu'une vraie section — elle se traverse,
          elle ne se lit pas. */}
      <section
        aria-label="Ce sur quoi vous pouvez compter"
        className="border-y border-hairline bg-canvas px-xl py-xl"
      >
        <ul
          role="list"
          className="mx-auto flex max-w-[62rem] flex-col gap-lg sm:flex-row sm:justify-between sm:gap-xl"
        >
          {confiance.map(({ Icone, titre, detail }) => (
            <li key={titre} className="flex items-start gap-sm">
              <Icone
                size={22}
                strokeWidth={1.9}
                aria-hidden="true"
                className="mt-xxs shrink-0 text-primary"
              />
              <div className="min-w-0">
                <p className="text-body-sm font-semibold text-ink">{titre}</p>
                <p className="text-caption text-mute">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Douleur ────────────────────────────────────────────────────── */}
      {/* Entre la confiance et la solution : le visiteur doit se reconnaître
          avant qu'on lui montre quoi que ce soit. */}
      <section id="situations" className="px-xl py-5xl">
        <div className="mx-auto max-w-[48rem]">
          <p className="text-caption-uppercase uppercase text-primary">
            Ce que vivent les bailleurs
          </p>
          <h2 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">
            Vous reconnaissez-vous dans l&apos;une de ces situations ?
          </h2>

          <ul role="list" className="anim-cascade mt-2xl space-y-md">
            {douleurs.map(({ situation, consequence }) => (
              <li
                key={situation}
                className="flex items-start gap-md rounded-lg border border-hairline border-l-2 border-l-warning-deep bg-surface-soft px-lg py-md"
              >
                <TriangleAlert
                  size={18}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="mt-xxs shrink-0 text-warning-deep"
                />
                <div className="min-w-0">
                  <p className="text-body-md font-semibold text-ink">{situation}</p>
                  <p className="mt-xxs text-body-sm text-mute">{consequence}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-2xl border-t border-hairline pt-xl">
            {/* Pas de pronostic judiciaire ici : ce qui manque dans les quatre
                cas est factuel — une trace écrite —, et c'est exactement ce que
                Sikaloc produit. La promesse reste donc tenable. */}
            <p className="text-body-lg font-semibold text-ink">
              Dans les quatre cas, il manque la même chose : un écrit daté,
              numéroté, que personne ne peut réécrire après coup.
            </p>
            <Link href="/inscription" className="btn btn-primary mt-lg">
              Protéger mes revenus
            </Link>
          </div>
        </div>
      </section>

      {/* ── Étapes ─────────────────────────────────────────────────────── */}
      <section id="etapes" className="bg-canvas px-xl py-5xl">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-caption-uppercase uppercase text-primary">
            Comment ça marche
          </p>
          {/* Le chiffre reste : c'est la promesse la plus crédible du site,
              et la seule mesurable. Seul le mot d'arrivée change — « preuve »
              plutôt que « quittance » — pour rejoindre le registre du hero. */}
          <h2 className="mt-sm max-w-[42rem] text-display-md font-extrabold tracking-tight text-ink">
            Trois clics entre le paiement reçu et la preuve envoyée
          </h2>
          <p className="mt-md max-w-[42rem] text-body-lg text-mute">
            C&apos;est la promesse de Sikaloc, et c&apos;est mesurable : moins de deux
            minutes entre l&apos;inscription et votre première quittance.
          </p>

          {/* Étapes posées sur un filet plutôt que dans des cartes : la lecture
              reste horizontale et la page respire. */}
          <ol className="anim-cascade mt-3xl grid gap-xl md:grid-cols-3">
            {etapes.map((etape) => (
              <li key={etape.numero} className="border-t border-hairline-strong pt-lg">
                <p className="text-caption-uppercase uppercase text-primary">
                  Étape {etape.numero}
                </p>
                <h3 className="mt-md text-display-sm font-bold text-ink">{etape.titre}</h3>
                <p className="mt-sm text-body-md text-body">{etape.texte}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Démo visuelle ──────────────────────────────────────────────── */}
      {/*
        Placée juste après les trois étapes : le visiteur vient de comprendre
        que c'est simple, mais il n'a toujours pas vu le produit. Montrer
        l'écran avant de demander un compte enlève la peur de l'inconnu.

        Les captures viennent de la VRAIE application, prises par
        `npm run capturer:demo` sur le jeu de démonstration local. Les personnes
        et les montants sont inventés — c'est dit sous la grille, parce qu'une
        capture qu'on laisse passer pour de vrais chiffres est un mensonge par
        omission.
      */}
      <section id="demo" className="px-xl py-5xl">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-caption-uppercase uppercase text-primary">Aperçu du produit</p>
          <h2 className="mt-sm max-w-[42rem] text-display-md font-extrabold tracking-tight text-ink">
            Voyez ce que vous allez utiliser
          </h2>
          <p className="mt-md max-w-[42rem] text-body-lg text-mute">
            Pas de surprise au moment de créer votre compte : voici les trois
            écrans où vous passerez l&apos;essentiel de votre temps.
          </p>

          <ul className="anim-cascade mt-3xl grid gap-xl md:grid-cols-3">
            {apercus.map((apercu, rang) => (
              <li key={apercu.fichier}>
                <div className="overflow-hidden rounded-lg border border-hairline bg-canvas">
                  <Image
                    src={`/demo/${apercu.fichier}`}
                    alt={apercu.alt}
                    width={2560}
                    height={1720}
                    // Les deux premières sont susceptibles d'entrer dans le
                    // premier écran sur un grand moniteur.
                    priority={rang === 0}
                    className="block h-auto w-full"
                    sizes="(min-width: 768px) 33vw, 100vw"
                  />
                </div>
                <p className="mt-lg text-caption-uppercase uppercase text-primary">
                  {apercu.etiquette}
                </p>
                <h3 className="mt-xs text-display-sm font-bold text-ink">{apercu.titre}</h3>
                <p className="mt-sm text-body-md text-body">{apercu.texte}</p>
              </li>
            ))}
          </ul>

          <p className="mt-2xl text-body-sm text-mute">
            Captures de l&apos;application réelle. Les locataires, montants et
            adresses sont fictifs.{' '}
            <Link href="/exemple-quittance" className="font-semibold text-ink underline">
              Voir une vraie quittance
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── Fonctionnalités ────────────────────────────────────────────── */}
      <section id="fonctionnalites" className="px-xl py-5xl">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-caption-uppercase uppercase text-primary">
            Fonctionnalités
          </p>
          <h2 className="mt-sm max-w-[42rem] text-display-md font-extrabold tracking-tight text-ink">
            Tout ce qu&apos;un bailleur fait vraiment, et rien de plus
          </h2>

          <div className="anim-cascade mt-3xl grid gap-lg md:grid-cols-2 lg:grid-cols-3">
            {/* Icônes lucide, pas les emojis du rapport : le projet n'en
                utilise aucun dans son copy, et leur rendu change d'un Android
                à l'autre sur un marché où c'est le parc dominant. */}
            {fonctionnalites.map(({ Icone, titre, texte }) => (
              <article key={titre} className="card card-lg">
                <Icone
                  size={24}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className="text-primary"
                />
                <h3 className="mt-md text-title-lg font-bold text-ink">{titre}</h3>
                <p className="mt-sm text-body-md text-body">{texte}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preuve de sérieux ──────────────────────────────────────────── */}
      {/* Entre les fonctionnalités et le prix : le visiteur sait ce que fait le
          produit, il lui reste à savoir s'il peut le croire. Sans clients à
          citer, on donne ce qui se vérifie — et un lien pour le vérifier. */}
      {/*
        Fond hérité et simple filet en haut, plutôt qu'un `bg-canvas` de plus :
        les sections alternent canvas / canvas-soft d'un bout à l'autre de la
        page, et une section supplémentaire cassait la parité — « confiance »
        et « tarifs » se retrouvaient sur le même fond, collés. Le filet
        sépare de « fonctionnalités » sans consommer d'alternance.
      */}
      <section id="confiance" className="border-t border-hairline px-xl py-5xl">
        <div className="mx-auto max-w-[56rem]">
          <p className="text-caption-uppercase uppercase text-primary">
            Pourquoi nous croire
          </p>
          <h2 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">
            Ce que vous pouvez vérifier vous-même
          </h2>
          <p className="mt-md max-w-[42rem] text-body-lg text-mute">
            Sikaloc n&apos;a pas encore d&apos;avis clients à afficher. À la
            place, voici ce qui est contrôlable avant même de créer un compte.
          </p>

          <div className="anim-cascade mt-3xl grid gap-lg md:grid-cols-2 [&>*]:min-w-0">
            {preuvesSerieux.map(({ Icone, titre, points, lien }) => (
              <article key={titre} className="card card-lg">
                <Icone
                  size={26}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className="text-primary"
                />
                <h3 className="mt-md text-title-lg font-bold text-ink">{titre}</h3>

                <ul role="list" className="mt-md space-y-sm">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-sm text-body-sm text-body">
                      <Check
                        size={17}
                        strokeWidth={2.5}
                        aria-hidden="true"
                        className="mt-xxs shrink-0 text-primary"
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={lien.href}
                  className="lien-anime mt-lg inline-block text-body-sm font-semibold text-ink"
                >
                  {lien.libelle}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarifs ─────────────────────────────────────────────────────── */}
      <section id="tarifs" className="bg-canvas px-xl py-5xl">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-[42rem] text-center">
            <p className="text-caption-uppercase uppercase text-primary">Tarifs</p>
            <h2 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">Un tarif, sans surprise</h2>
            <p className="mt-md text-body-lg text-mute">
              Commencez gratuitement. Passez au plan Standard quand votre parc
              grandit — par Mobile Money, sans engagement.
            </p>
          </div>

          {/*
            `[&>*]:min-w-0` : un élément de grille a `min-width: auto`, donc une
            largeur minimale égale à celle de son contenu. Les cartes réclamaient
            ainsi 300 px dans une colonne de 256 px et débordaient de la page
            sous 360 px de large. Les autoriser à passer sous leur minimum de
            contenu laisse le texte se replier normalement.
          */}
          <div className="mx-auto mt-3xl grid max-w-[56rem] gap-xl [&>*]:min-w-0 md:grid-cols-2 md:items-start">
            <div className="card card-lg">
              <p className="text-title-lg font-bold text-ink">Gratuit</p>
              <p className="mt-sm text-display-md font-extrabold tabular tracking-tight text-ink">0 FCFA</p>
              <p className="mt-xs text-body-sm text-mute">Pour démarrer</p>

              {/*
                La seule exclusion listée est la seule que le code applique
                réellement : `capacites()` ne verrouille plus que le nombre de
                logements et les relances WhatsApp. Le rapport voulait y ajouter « Export historique » et
                « Support par email » — ni l'un ni l'autre n'est appliqué par le
                code, et l'export n'existe nulle part. Les afficher comme
                avantages payants aurait rendu plus visible une promesse que le
                produit ne tient pas.

                Ni « basiques » (qui dévalorise) ni « standards » (qui entrerait
                en collision avec le nom du plan payant) : on décrit ce que le
                document contient, puis ce qui lui manque.
              */}
              <ul className="mt-xl space-y-md text-body-md text-body">
                <Puce>Jusqu&apos;à {LIMITE_LOGEMENTS_GRATUIT} logements</Puce>
                <Puce>Baux, locataires et paiements illimités</Puce>
                <Puce>Tableau de bord, suivi des impayés et historique</Puce>
                <Puce>Quittances PDF numérotées et horodatées</Puce>
                <Puce>Mention du droit de timbre</Puce>
                <Puce exclu>Relances WhatsApp des impayés</Puce>
              </ul>

              {/* Un seul exemple désormais : les deux plans produisent le même
                  document. */}
              <Link
                href="/exemple-quittance"
                className="lien-anime mt-lg inline-block text-body-sm font-medium text-ink"
              >
                Voir un exemple de quittance
              </Link>

              {/*
                `.btn` est en `white-space: nowrap` et à hauteur fixe : le
                libellé imposait donc une largeur minimale de 236 px à la
                carte, qui débordait de sa colonne de 256 px sous 360 px de
                large. On autorise le retour à la ligne et on laisse la
                hauteur s'adapter, plutôt que de raccourcir le libellé.
              */}
              <Link
                href="/inscription"
                className="btn btn-secondary mt-xl h-auto min-h-10 w-full whitespace-normal py-sm leading-snug"
              >
                Commencer gratuitement
              </Link>
            </div>

            {/* Le plan payant est le moment produit dense : surface sombre. */}
            {/* `max-md:order-first` : sur mobile, les deux cartes s'empilent et
                le plan recommandé passe devant. Sur un écran étroit, la première
                carte est souvent la seule vue avant de reprendre le défilement. */}
            <div className="rounded-lg border-t-2 border-t-primary bg-surface-dark p-xl text-on-dark max-md:order-first md:-mt-md md:pb-2xl">
              <div className="flex items-center justify-between gap-md">
                <p className="text-title-lg font-bold text-on-dark">Standard</p>
                <span className="badge bg-surface-card text-ink">Recommandé</span>
              </div>
              <p className="mt-sm text-display-md font-extrabold tabular tracking-tight text-on-dark">
                {formaterFCFA(PRIX_STANDARD_FCFA)}
              </p>
              <p className="mt-xs text-body-sm text-on-dark-mute">par mois, sans engagement</p>

              <ul className="mt-xl space-y-md text-body-md text-on-dark">
              {/*
                Les quatre premières lignes sont communes aux deux plans, et
                répétées à dessein : c'est ce qui rend le basculement ✗ → ✓ des
                deux dernières lisible en diagonale d'une carte à l'autre.

                Deux lignes ont disparu, toutes deux fausses.
                « Historique complet et export » l'était doublement :
                `/app/paiements` n'appelle jamais `capacites()`, l'historique est
                donc déjà servi aux comptes gratuits — le tableau de bord leur
                affiche même le lien « Historique complet » — et l'export
                n'existe nulle part dans le code.
                « Support par email » vendait une adresse publique : elle est
                dans le pied de page de cette même landing, et c'est le canal
                d'exercice des droits RGPD, dû à tout le monde.
              */}
                <Puce surSombre>Logements illimités</Puce>
                <Puce surSombre>Baux, locataires et paiements illimités</Puce>
                <Puce surSombre>Tableau de bord, suivi des impayés et historique</Puce>
                <Puce surSombre>Quittances PDF numérotées et horodatées</Puce>
                <Puce surSombre>Mention du droit de timbre (art. 423 du CGI)</Puce>
                <Puce surSombre>Relances WhatsApp des impayés</Puce>
              </ul>

              <Link
                href="/inscription"
                className="btn btn-primary mt-xl h-auto min-h-10 w-full whitespace-normal py-sm leading-snug"
              >
                Passer au plan Standard
              </Link>
            </div>
          </div>

          {/*
            Remplace le bloc « Garantie » proposé par le rapport Axe 1 : le mot
            « garantie » crée un engagement contractuel que les CGU excluent
            explicitement (§7, limitation de responsabilité). Une différence de
            plan énoncée en clair vaut mieux qu'une promesse qu'on ne tiendra pas.
          */}
          <p className="mx-auto mt-xl max-w-[44rem] text-center text-body-sm text-mute">
            Toutes les quittances portent la mention du droit de timbre, à la
            charge du locataire (art. 423 du CGI, modifié par la LF 2025), quel
            que soit votre plan. Sikaloc ne calcule pas ce montant et ne fournit
            pas de conseil juridique.
          </p>

          <p className="mt-lg text-center text-body-sm text-mute">
            Parrainez un bailleur : vous recevez chacun 1 mois offert dès sa
            première souscription payante.
          </p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="px-xl py-5xl">
        <div className="mx-auto max-w-[48rem]">
          <p className="text-caption-uppercase uppercase text-primary">
            Bon à savoir
          </p>
          <h2 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">Questions fréquentes</h2>

          {/* Filets plutôt que cartes : une FAQ se parcourt, elle ne se collectionne pas. */}
          <div className="mt-2xl border-t border-hairline">
            {/* La première question est ouverte d'emblée : c'est celle qui
                décide, et une FAQ entièrement repliée oblige à deviner laquelle
                mérite un clic. Les suivantes restent fermées pour ne pas
                allonger la page de six réponses sur mobile. */}
            {questions.map((item, rang) => (
              <details
                key={item.q}
                open={rang === 0}
                className="group border-b border-hairline py-lg"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-lg text-body-lg font-medium text-ink">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="mt-xxs shrink-0 text-display-xs text-primary transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-md max-w-[40rem] text-body-md text-body">{item.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guide ──────────────────────────────────────────────────────── */}
      {/*
        Placée après la FAQ, avant l'appel final : elle s'adresse au visiteur
        qui a lu jusqu'ici sans cliquer « Commencer ». Pas plus tôt — un
        formulaire d'email posé avant les tarifs entrerait en concurrence avec
        l'inscription, qui est gratuite et prend deux minutes.

        Le guide décrit ce que Sikaloc écrit sur ses documents, sans dire ce que
        la loi exige : les CGU excluent le conseil juridique, et le titre le
        reflète.
      */}
      <section id="guide" className="bg-canvas px-xl py-5xl">
        <div className="mx-auto max-w-[56rem]">
          <div className="grid gap-2xl md:grid-cols-[1.15fr_1fr] md:items-start">
            <div>
              <p className="text-caption-uppercase uppercase text-primary">
                Guide gratuit
              </p>
              <h2 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">
                Ce que contient une quittance Sikaloc
              </h2>
              <p className="mt-md text-body-lg text-mute">
                Dix points, décrits un par un : ce que le document nomme, ce
                qu&apos;il calcule, et ce qui le rend difficile à contester.
              </p>

              <ul role="list" className="mt-lg space-y-sm">
                {POINTS_GUIDE.map((point) => (
                  <li key={point} className="flex items-start gap-sm text-body-sm text-body">
                    <Check
                      size={17}
                      strokeWidth={2.5}
                      aria-hidden="true"
                      className="mt-xxs shrink-0 text-primary"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-lg text-body-sm text-mute">
                Le guide décrit un outil. Il ne remplace pas l&apos;avis d&apos;un
                professionnel du droit.
              </p>
            </div>

            <div className="card card-lg">
              <FormulaireGuide />
            </div>
          </div>
        </div>
      </section>

      {/* ── Appel final ────────────────────────────────────────────────── */}
      {/* Surface sombre avant le pied de page sombre : la clôture prescrite par
          le design system pour les moments de conversion. */}
      <section className="px-xl pb-5xl">
        <div className="mx-auto max-w-[1200px]">
          <div className="rounded-xl bg-surface-dark px-xl py-5xl text-center">
            <h2 className="mx-auto max-w-[40rem] text-display-lg font-extrabold tracking-tight text-on-dark">
              Votre prochaine quittance peut être prête dans deux minutes
            </h2>
            <p className="mx-auto mt-lg max-w-[34rem] text-body-lg text-on-dark-mute">
              Ne laissez plus vos quittances au hasard. Enregistrez votre premier
              bail, saisissez un paiement, et gardez la preuve. C&apos;est tout.
            </p>
            <Link href="/inscription" className="btn btn-primary mt-2xl">
              Protéger mes revenus
            </Link>
            <p className="mt-lg text-body-sm text-on-dark-mute">
              Gratuit jusqu&apos;à {LIMITE_LOGEMENTS_GRATUIT} logements · Sans carte
              bancaire · Mobile Money accepté
            </p>
          </div>
        </div>
      </section>

      </main>

      <PiedDePage />

      {/* Ne rend rien tant que NEXT_PUBLIC_WHATSAPP_SUPPORT n'est pas renseignée. */}
      <WidgetWhatsApp />
    </div>
  )
}

/**
 * Ligne de plan tarifaire.
 *
 * `exclu` marque ce que le plan ne fait PAS. Le texte n'est pas barré, à la
 * différence de ce que propose le rapport : un texte barré se lit mal, se
 * copie mal, et passe à travers certains lecteurs d'écran. La croix, la
 * couleur atténuée et le libellé au négatif suffisent à faire la différence —
 * et `<span className="sr-only">` la dit explicitement à qui écoute la page.
 */
function Puce({
  children,
  surSombre = false,
  exclu = false,
}: {
  children: React.ReactNode
  surSombre?: boolean
  exclu?: boolean
}) {
  const Icone = exclu ? X : Check

  return (
    <li className={`flex items-start gap-sm ${exclu ? 'text-mute' : ''}`}>
      <Icone
        size={20}
        strokeWidth={2.5}
        aria-hidden="true"
        className={`mt-xxs shrink-0 ${
          exclu ? 'text-mute' : surSombre ? 'text-primary-on-dark' : 'text-primary'
        }`}
      />
      <span>
        <span className="sr-only">{exclu ? 'Non inclus : ' : 'Inclus : '}</span>
        {children}
      </span>
    </li>
  )
}
