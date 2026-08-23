import { Check, Lock, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react'
import Link from 'next/link'

import { MenuMobile } from '@/components/marketing/menu-mobile'
import { PiedDePage } from '@/components/marketing/pied-de-page'
import { Illustration } from '@/components/ui/illustration'
import { MarqueSikaloc } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'
import { formaterFCFA } from '@/lib/format'
import { LIMITE_LOGEMENTS_GRATUIT, PRIX_STANDARD_FCFA } from '@/lib/plan'
import { obtenirUtilisateur } from '@/lib/supabase/serveur'

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
 * Les capacités réservées au plan Standard le disent dans leur propre texte :
 * la landing ne peut pas promettre au visiteur ce que `capacites()` refusera
 * au compte gratuit qu'il vient de créer (`src/lib/plan.ts`).
 */
const fonctionnalites = [
  {
    titre: 'Des quittances qui font preuve',
    texte:
      'Identité des parties, adresse, période, montant en lettres et en chiffres, décharge, horodatage et votre signature. Chaque document reçoit un numéro continu et une empreinte d’intégrité. Le plan Standard y ajoute la mention du droit de timbre.',
  },
  {
    titre: 'Aucun loyer ne s’échappe',
    texte:
      'Chaque bail a son jour d’échéance et sa tolérance. Passé le délai, le loyer bascule en impayé et remonte en haut de votre tableau de bord. Vous agissez avant que le retard ne s’enlise.',
  },
  {
    titre: 'Relancez sans confrontation',
    texte:
      'Le message est pré-rédigé avec le nom, la période, le montant et l’échéance. Vous relisez, vous envoyez depuis votre propre WhatsApp — Sikaloc n’écrit jamais à votre place. Les relances se débloquent avec le plan Standard.',
  },
  {
    titre: 'Votre parc, chiffres à l’appui',
    texte:
      'Taux d’occupation, taux de recouvrement, impayés, chiffre d’affaires du mois. Mis à jour à chaque paiement. Vous savez où vous en êtes, sans surprise.',
  },
  {
    titre: 'Rien à installer pour le locataire',
    texte:
      'Il reçoit sa quittance sur WhatsApp, par un lien de téléchargement sécurisé valable 30 jours. Pas de compte, pas de mot de passe. La preuve est entre ses mains.',
  },
  {
    titre: 'Vos données, cloisonnées',
    texte:
      'Chaque bailleur ne voit que ses propres données, isolées au niveau de la base. Hébergement en Europe, échanges chiffrés.',
  },
]

/**
 * Ligne de preuves du hero — trois faits vrais pour LES DEUX plans.
 *
 * La mention du droit de timbre en est délibérément absente : elle n'existe
 * que sur le plan Standard, alors que le CTA situé juste en dessous fait
 * souscrire au plan Gratuit. L'annoncer ici reviendrait à vendre au visiteur
 * l'inverse de ce que son compte produira.
 */
const preuves = [
  'Numérotation continue et horodatage',
  'Montant en lettres et décharge',
  'Envoi au locataire sur WhatsApp',
]

/**
 * Barre de confiance — trois raisons de rester, à la place d'une preuve
 * sociale que Sikaloc n'a pas encore.
 *
 * Les trois affirmations sont vérifiables, ce qui n'était pas le cas de celles
 * du rapport. « Conforme droit béninois · Mentions obligatoires incluses »
 * promettait sans réserve ce que le plan Gratuit ne fait pas : ses quittances
 * sortent sans la mention du droit de timbre (`src/lib/plan.ts`). La réserve
 * est donc portée par la sous-ligne, là où elle se lit.
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
    detail: 'Droit de timbre au plan Standard',
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
 * sans mention du droit de timbre « peut être rejetée » — or c'est exactement
 * le document que produit le plan Gratuit de Sikaloc. La page aurait disqualifié
 * sa propre offre d'entrée, deux sections avant de la vendre. La douleur est
 * donc ramenée à ce qui est vrai dans tous les cas : l'absence de trace.
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
    r: 'Parce qu’une quittance mal rédigée se retourne contre le bailleur. Sikaloc pose les mentions attendues à chaque paiement, sans que vous ayez à les ressaisir — la mention du droit de timbre étant ajoutée avec le plan Standard. Cela ne remplace pas l’avis de votre conseil, mais vous n’avez plus à reconstituer une preuve après coup.',
  },
]

export default async function PageAccueil() {
  const utilisateur = await obtenirUtilisateur()

  return (
    <div className="min-h-screen bg-canvas-soft">
      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-sm px-lg lg:px-xl">
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

          <div className="hidden items-center gap-xl lg:flex">
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
            {fonctionnalites.map((f) => (
              <article key={f.titre} className="card card-lg">
                <h3 className="text-title-lg font-bold text-ink">{f.titre}</h3>
                <p className="mt-sm text-body-md text-body">{f.texte}</p>
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

              <ul className="mt-xl space-y-md text-body-md text-body">
                <Puce>Jusqu&apos;à {LIMITE_LOGEMENTS_GRATUIT} logements</Puce>
                <Puce>Baux, locataires et paiements illimités</Puce>
                {/* Ni « basiques » (qui dévalorise) ni « standards » (qui
                    entrerait en collision avec le nom du plan payant) : on
                    décrit ce que le document contient, et ce qui lui manque. */}
                <Puce>
                  Quittances PDF numérotées et horodatées — sans la mention du
                  droit de timbre
                </Puce>
                <Puce>Tableau de bord et suivi des impayés</Puce>
              </ul>

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
            <div className="rounded-lg border-t-2 border-t-primary bg-surface-dark p-xl text-on-dark md:-mt-md md:pb-2xl">
              <div className="flex items-center justify-between gap-md">
                <p className="text-title-lg font-bold text-on-dark">Standard</p>
                <span className="badge bg-surface-card text-ink">Recommandé</span>
              </div>
              <p className="mt-sm text-display-md font-extrabold tabular tracking-tight text-on-dark">
                {formaterFCFA(PRIX_STANDARD_FCFA)}
              </p>
              <p className="mt-xs text-body-sm text-on-dark-mute">par mois, sans engagement</p>

              <ul className="mt-xl space-y-md text-body-md text-on-dark">
                <Puce surSombre>Logements illimités</Puce>
                <Puce surSombre>Quittances conformes Bénin (droit de timbre)</Puce>
                <Puce surSombre>Relances WhatsApp des impayés</Puce>
                <Puce surSombre>Historique complet et export</Puce>
                <Puce surSombre>Support par email</Puce>
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
            Les quittances du plan Standard portent en plus la mention du droit
            de timbre, à la charge du locataire (art. 423 du CGI, modifié par la
            LF 2025). Sikaloc ne calcule pas ce montant et ne fournit pas de
            conseil juridique.
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
            {questions.map((item) => (
              <details key={item.q} className="group border-b border-hairline py-lg">
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

      <PiedDePage />
    </div>
  )
}

function Puce({
  children,
  surSombre = false,
}: {
  children: React.ReactNode
  surSombre?: boolean
}) {
  return (
    <li className="flex items-start gap-sm">
      <Check
        size={20}
        strokeWidth={2.5}
        aria-hidden="true"
        className={`mt-xxs shrink-0 ${surSombre ? 'text-primary-on-dark' : 'text-primary'}`}
      />
      <span>{children}</span>
    </li>
  )
}
