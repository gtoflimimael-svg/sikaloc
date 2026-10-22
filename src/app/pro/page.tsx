import {
  ChartColumn,
  Check,
  Database,
  FileCheck,
  X,
} from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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
 * Aperçus statiques de la section « Aperçu du produit ».
 * Ils reprennent les parcours et libellés de Pro, mais sont rendus hors ligne
 * avec des données fictives : ce ne sont pas des captures de comptes réels.
 */
const apercus = [
  {
    fichier: 'pro-tableau-de-bord.png',
    alt: 'Aperçu de démonstration du tableau de bord Sikaloc Pro : occupation, recouvrement, retards confirmés et paiements récents. Données fictives.',
    etiquette: 'Pilotage quotidien',
    titre: 'Votre activité locative en un regard',
    texte:
      'Retrouvez les indicateurs disponibles, les actions rapides et les derniers paiements enregistrés.',
  },
  {
    fichier: 'pro-paiements-quittances.png',
    alt: 'Aperçu de démonstration de l’historique des paiements Sikaloc Pro avec statuts et justificatifs associés. Données fictives.',
    etiquette: 'Paiements et documents',
    titre: 'Du règlement à son justificatif',
    texte:
      'Consultez les versements par période et retrouvez le reçu ou la quittance correspondant au paiement.',
  },
  {
    fichier: 'pro-baux-locataires.png',
    alt: 'Aperçu de démonstration de la liste des baux Sikaloc Pro, reliant locataires, logements, périodes et loyers. Données fictives.',
    etiquette: 'Gestion locative',
    titre: 'Baux, logements et locataires',
    texte:
      'Retrouvez pour chaque bail le locataire, le logement, le loyer mensuel et les principales conditions.',
  },
]

/** Étapes réellement suivies dans le parcours de gestion des paiements. */
const etapes = [
  {
    numero: '01',
    titre: 'Reliez le logement au bail',
    texte:
      'Enregistrez le logement, le locataire et les conditions du bail pour retrouver le contexte de chaque location.',
  },
  {
    numero: '02',
    titre: 'Enregistrez le versement',
    texte:
      'Choisissez le bail, la période, le montant et le mode de règlement. Vérifiez le récapitulatif avant de confirmer.',
  },
  {
    numero: '03',
    titre: 'Retrouvez l’état et le document',
    texte:
      'Après confirmation, consultez l’état de la période. Le document associé distingue un versement partiel d’un loyer entièrement réglé.',
  },
]

const repères = [
  {
    titre: `Jusqu’à ${LIMITE_LOGEMENTS_GRATUIT} logements`,
    detail: 'sans frais pour commencer',
  },
  {
    titre: `${formaterFCFA(PRIX_STANDARD_FCFA)} / mois`,
    detail: 'plan Standard, par Mobile Money',
  },
  {
    titre: 'Accès Me sur invitation',
    detail: 'le bailleur ouvre l’accès au locataire',
  },
]

const difficultes = [
  {
    repere: 'Logements et baux',
    situation: 'À quelle location cette information se rapporte-t-elle ?',
    consequence:
      'Adresse, locataire, loyer et conditions du bail sont plus simples à retrouver lorsqu’ils restent liés.',
  },
  {
    repere: 'Loyers et périodes',
    situation: 'Quel versement couvre quelle période ?',
    consequence:
      'Un historique de paiements aide à distinguer ce qui a été enregistré de ce qui reste à vérifier.',
  },
  {
    repere: 'Reçus et quittances',
    situation: 'Où retrouver le document déjà remis ?',
    consequence:
      'Un accès organisé évite de rechercher la pièce dans plusieurs conversations ou dossiers.',
  },
]

const universPro = [
  {
    Icone: Database,
    numero: '01',
    titre: 'Organisez vos biens',
    texte:
      'Gardez logements, locataires et baux dans un même espace de gestion, avec les informations rattachées à chaque location.',
    points: ['Logements et locataires', 'Baux et conditions', 'Informations de location'],
  },
  {
    Icone: ChartColumn,
    numero: '02',
    titre: 'Suivez vos locations',
    texte:
      'Consultez les échéances définies dans les baux, les paiements enregistrés et les retards confirmés.',
    points: ['Loyers attendus', 'Paiements par période', 'Impayés déterminés'],
  },
  {
    Icone: FileCheck,
    numero: '03',
    titre: 'Retrouvez vos documents',
    texte:
      'Les reçus et quittances disponibles restent rattachés à leur paiement et à la période concernée.',
    points: ['Reçu pour un versement partiel', 'Quittance pour une période soldée', 'Exemple consultable en ligne'],
  },
]

const questions = [
  {
    q: 'Quelle différence entre un reçu et une quittance ?',
    r: 'Le reçu correspond à un versement qui ne solde pas encore la période. La quittance correspond au loyer entièrement réglé pour la période indiquée. Le document dépend donc du paiement et du solde de la période.',
  },
  {
    q: 'Le locataire doit-il créer un compte ?',
    r: 'Pour accéder à Sikaloc Me, le bailleur lui envoie une invitation liée à sa location. L’espace donne accès aux informations et documents prévus pour ce compte.',
  },
  {
    q: 'Que puis-je suivre dans Sikaloc Pro ?',
    r: 'Les logements, les locataires, les baux, les paiements enregistrés, les échéances et les documents disponibles. Les informations dépendent des éléments saisis et des périodes suivies dans le compte.',
  },
  {
    q: 'Comment corriger une erreur de paiement ?',
    r: 'Après validation, une correction est possible pendant cinq minutes. Passé ce délai, le paiement est figé ; vérifiez le récapitulatif avant de confirmer.',
  },
  {
    q: 'Quelle est la différence entre le plan Gratuit et le plan Standard ?',
    r: `Le plan Gratuit est limité à ${LIMITE_LOGEMENTS_GRATUIT} logements et n’inclut pas les relances WhatsApp. Les autres fonctions et les documents de quittance sont identiques sur les deux plans.`,
  },
  {
    q: 'Comment payer l’abonnement Standard ?',
    r: `Le plan Standard coûte ${formaterFCFA(PRIX_STANDARD_FCFA)} par mois et se règle par Mobile Money, sans engagement. Le plan Gratuit reste disponible jusqu’à ${LIMITE_LOGEMENTS_GRATUIT} logements.`,
  },
  {
    q: 'La quittance garantit-elle un résultat juridique ?',
    r: 'Non. Sikaloc produit un document avec les informations prévues par le modèle, mais ne donne pas de conseil juridique et ne peut garantir l’issue d’un litige. Pour un usage juridique, demandez conseil à un professionnel.',
  },
]

/**
 * La page de présentation de Sikaloc_Pro.
 *
 * ─── D'où vient ce contenu ──────────────────────────────────────────────────
 *
 * La page est dédiée aux bailleurs. Le contenu reste lié aux fonctionnalités
 * réellement disponibles dans Pro et aux modalités commerciales du produit.
 *
 * ─── Ce que cette page fait selon qui l'ouvre ───────────────────────────────
 *
 *   visiteur anonyme        la présentation
 *   bailleur prêt           renvoyé vers son tableau de bord
 *   bailleur non vérifié    la présentation
 *   locataire connecté      la présentation
 *
 * Les deux derniers cas sont délibérés. Renvoyer un bailleur non vérifié vers
 * `/verification` depuis une page publique le piégerait sur un écran qu'il n'a
 * pas demandé ; renvoyer un locataire vers `/me` lui refuserait de lire ce
 * qu'est Sikaloc_Pro, alors qu'il en est peut-être un futur client.
 *
 * ─── Pourquoi la garde n'est PAS `bailleurCourant()` ────────────────────────
 *
 * Parce que cette fonction REDIRIGE : vers `/connexion` sans session, vers
 * `/verification` sans vérification. C'est exactement ce qu'une page publique
 * ne doit pas faire. On lit donc l'état, et on décide ici.
 */
/*
 * Titre et description en constantes, pour ne les écrire qu'une fois :
 * `title` en a besoin sous la forme `{ absolute }`, `openGraph` et `twitter`
 * sous forme de chaîne brute. Sans ça, corriger le texte de vente demanderait
 * de penser à trois endroits à la fois.
 */
const TITRE_PRO = `Logiciel de gestion locative au Bénin — ${ESPACE_PRO.nom}`
const DESCRIPTION_PRO =
  'Organisez vos logements, locataires et baux, suivez les loyers et les paiements, ' +
  `et retrouvez les documents disponibles. Gratuit jusqu'à ${LIMITE_LOGEMENTS_GRATUIT} logements.`

/*
 * ─── Pourquoi cette page a besoin de son propre aperçu de partage ──────────
 *
 * Sans lui, `/pro` hérite de celui de la racine EN ENTIER — la fusion des
 * métadonnées de Next.js remplace un objet imbriqué d'un bloc, elle ne le
 * complète pas champ par champ. Un lien « sikaloc.com/pro » partagé sur
 * WhatsApp affichait donc le titre et la description de la page d'ACCUEIL,
 * sous une URL qui pointe vers la page de vente du bailleur.
 *
 * `url` est explicite plutôt que sous-entendu par `alternates.canonical` :
 * `openGraph.url` et `canonical` répondent à deux lecteurs différents — les
 * robots de partage pour le premier, les moteurs de recherche pour le
 * second — et une page qui déclare son propre `openGraph` doit dire les deux,
 * plutôt que de compter sur un champ que la racine a justement retiré (voir
 * son commentaire) pour éviter l'inverse de cette erreur.
 *
 * Pas d'image : aucune n'existe pour `/pro` dans le projet. En inventer une
 * afficherait un aperçu qui ne correspond à rien de réel.
 */
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
  twitter: {
    card: 'summary_large_image',
    title: TITRE_PRO,
    description: DESCRIPTION_PRO,
  },
}

export default async function PagePresentationPro({
  searchParams,
}: {
  searchParams: Promise<{ presentation?: string }>
}) {
  const utilisateur = await obtenirUtilisateur()
  const { presentation } = await searchParams

  /*
   * Un bailleur qui peut entrer n'a rien à faire sur une page de vente.
   *
   * Trois lectures, et l'ordre compte : sans session, on s'arrête tout de
   * suite ; sans ligne dans `bailleurs`, c'est un locataire ou un compte sans
   * espace Pro, et la présentation est la bonne réponse ; sans vérification
   * complète, le tableau de bord le renverrait aussitôt vers `/verification`,
   * ce qu'on refuse de déclencher depuis ici.
   *
   * La lecture passe par la session : les politiques de `bailleurs` ne rendent
   * que sa propre ligne, et aucune clé d'administration n'est nécessaire.
   *
   * ─── Sauf s'il a demandé la présentation ────────────────────────────────
   *
   * Le pied de page mène aux sections de cette page (`#faq`, `#tarifs`,
   * `#fonctionnalites`). Le fragment n'atteint jamais le serveur : sans autre
   * signe, « Questions fréquentes » cliqué par un bailleur vérifié depuis le
   * blog le déposait sur son tableau de bord. Ces liens portent donc
   * `?presentation=1`, et lui seul suspend la redirection. `/pro` nu garde son
   * comportement ; la balise canonique reste `/pro`, le paramètre ne crée pas
   * de seconde page pour les moteurs.
   */
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
    <div className="min-h-screen bg-canvas text-ink">
      {/*
        `espace="Pro"` accole « Pro » au wordmark, et le logo mène à `/pro` :
        on est chez le bailleur, la marque le dit. Les ancres sont celles de
        cette page — elles n'ont de sens que sur elle.
      */}
      <EnTetePublic
        connecte={Boolean(utilisateur)}
        espace="Pro"
        marqueHref="/pro"
        liens={LIENS_PRO}
        liensTiroir={LIENS_TIROIR_PRO}
      />

      {/*
        Repère `main` : la page n'en avait aucun. Les lecteurs d'écran s'en
        servent pour sauter la navigation et atteindre le contenu directement —
        sans lui, il faut retraverser l'en-tête à chaque arrivée sur la page.
        Les écrans d'authentification (`CarteAuth`) en portaient déjà un.
      */}
      <main id="contenu">

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-xl pb-0 pt-4xl sm:pt-5xl">
        <div className="mx-auto grid max-w-[1280px] items-center gap-xl lg:grid-cols-[0.92fr_1.08fr] lg:gap-2xl">
          <div className="relative z-10 py-xl">
            <span className="badge badge-neutral">Sikaloc Pro · Gestion locative</span>
            <h1 className="mt-lg max-w-[13ch] text-balance text-display-xl font-extrabold leading-[0.98] tracking-tight text-ink sm:text-display-xxl">
              Vos logements.<br />Vos loyers.<br /><span className="text-ink-deep">Vos documents.</span>
            </h1>
            <p className="mt-xl max-w-[34rem] text-body-lg leading-relaxed text-body sm:text-title-md">
              Organisez vos locations, suivez les paiements et retrouvez les
              documents associés, dans un même espace pensé pour les bailleurs.
            </p>
            <div className="mt-2xl flex flex-col items-start gap-md sm:flex-row sm:items-center">
              <Link href="/inscription" className="btn btn-primary">
                Commencer gratuitement
              </Link>
              <Link href="#demo" className="lien-anime inline-flex items-center gap-xs text-body-md font-semibold text-ink">
                Découvrir le logiciel <span aria-hidden="true">↓</span>
              </Link>
            </div>
            <p className="mt-lg text-body-sm text-mute">
              Gratuit jusqu&apos;à {LIMITE_LOGEMENTS_GRATUIT} logements. Sans carte bancaire.
            </p>
            <Link href="#locataire" className="mt-xl inline-flex text-body-sm font-medium text-mute underline decoration-hairline-strong underline-offset-4 hover:text-ink">
              Vous êtes locataire ? Voir l&apos;accès Sikaloc Me
            </Link>
          </div>

          <div className="relative mx-auto w-full max-w-[760px] lg:-mr-2xl lg:max-w-none">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[14%] bottom-[12%] top-[18%] rounded-full bg-surface-soft blur-3xl" />
            <Image
              src="/illustrations/home-01-sculpture.png"
              alt="Sculpture architecturale reliant trois maisons stylisées, illustration de l’univers Sikaloc Pro"
              width={1536}
              height={1024}
              priority
              sizes="(max-width: 1023px) 100vw, 56vw"
              className="relative block h-auto w-full object-contain"
            />
          </div>
        </div>
      </section>

      {/* ── Repères tarifaires et d'accès ──────────────────────────────── */}
      <section id="confiance" aria-label="Repères Sikaloc Pro" className="border-y border-hairline bg-surface-soft px-xl py-xl">
        <ul role="list" className="mx-auto grid max-w-[1100px] gap-lg sm:grid-cols-3 sm:gap-xl">
          {repères.map(({ titre, detail }) => (
            <li key={titre} className="border-l-2 border-primary pl-lg">
              <p className="text-title-sm font-bold text-ink">{titre}</p>
              <p className="mt-xxs text-body-sm text-mute">{detail}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Les difficultés concrètes ─────────────────────────────────── */}
      <section id="situations" className="bg-surface-dark px-xl py-5xl text-on-dark">
        <div className="mx-auto grid max-w-[1200px] gap-3xl lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-caption-uppercase uppercase text-primary-on-dark">Le quotidien d&apos;un bailleur</p>
            <h2 className="mt-md max-w-[13ch] text-balance text-display-lg font-extrabold leading-tight tracking-tight text-on-dark sm:text-display-xl">
              Une location, beaucoup d&apos;informations à garder en tête.
            </h2>
            <p className="mt-lg max-w-[34rem] text-body-lg text-on-dark-mute">
              Quand logements, périodes, paiements et pièces sont suivis à des
              endroits différents, retrouver le bon contexte prend du temps.
            </p>
          </div>
          <ol className="divide-y divide-white/15 border-y border-white/15">
            {difficultes.map((item, index) => (
              <li key={item.repere} className="grid gap-sm py-lg sm:grid-cols-[5rem_1fr] sm:gap-lg">
                <span className="text-caption-uppercase text-primary-on-dark">0{index + 1} / {item.repere}</span>
                <div>
                  <h3 className="text-title-md font-semibold text-on-dark">{item.situation}</h3>
                  <p className="mt-xs max-w-[40rem] text-body-md text-on-dark-mute">{item.consequence}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Démonstration du produit ───────────────────────────────────── */}
      <section id="demo" className="bg-primary px-xl py-5xl text-ink">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid gap-xl lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-caption-uppercase uppercase text-ink/70">Découvrez Sikaloc Pro</p>
              <h2 className="mt-md max-w-[12ch] text-balance text-display-lg font-extrabold leading-tight tracking-tight text-ink sm:text-display-xl">
                La gestion locative, à portée de regard.
              </h2>
            </div>
            <p className="max-w-[38rem] text-body-lg text-ink/80">
              Du tableau de bord aux baux et aux paiements, voici trois aperçus
              des écrans qui structurent le suivi d&apos;une location.
            </p>
          </div>

          <div className="mt-3xl grid gap-xl lg:grid-cols-[1.45fr_0.85fr]">
            <article className="min-w-0 overflow-hidden rounded-xl bg-canvas p-sm shadow-xl">
              <Image
                src={`/demo/${apercus[0].fichier}`}
                alt={apercus[0].alt}
                width={2560}
                height={1720}
                sizes="(max-width: 1023px) 100vw, 62vw"
                className="block h-auto w-full rounded-lg"
              />
              <div className="grid gap-xs px-md pb-md pt-lg sm:grid-cols-[0.75fr_1.25fr] sm:gap-lg">
                <p className="text-caption-uppercase uppercase text-ink-deep">{apercus[0].etiquette}</p>
                <div>
                  <h3 className="text-title-lg font-bold text-ink">{apercus[0].titre}</h3>
                  <p className="mt-xs text-body-sm text-body">{apercus[0].texte}</p>
                </div>
              </div>
            </article>

            <div className="grid min-w-0 gap-xl sm:grid-cols-2 lg:grid-cols-1">
              {apercus.slice(1).map((apercu) => (
                <article key={apercu.fichier} className="min-w-0 overflow-hidden rounded-xl bg-canvas p-sm shadow-lg">
                  <Image
                    src={`/demo/${apercu.fichier}`}
                    alt={apercu.alt}
                    width={2560}
                    height={1720}
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 35vw"
                    className="block h-auto w-full rounded-lg"
                  />
                  <div className="px-md pb-md pt-md">
                    <p className="text-caption-uppercase uppercase text-ink-deep">{apercu.etiquette}</p>
                    <h3 className="mt-xs text-title-md font-bold text-ink">{apercu.titre}</h3>
                    <p className="mt-xs text-body-sm text-body">{apercu.texte}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <p className="mt-xl text-body-sm text-ink/75">
            Aperçus de démonstration, non issus d&apos;une session réelle : identités,
            lieux, dates et montants sont fictifs.{' '}
            <Link href="/exemple-quittance" className="font-semibold underline underline-offset-4">
              Consulter un exemple de quittance
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── Trois univers de gestion ──────────────────────────────────── */}
      <section id="fonctionnalites" className="px-xl py-5xl">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-[46rem]">
            <p className="text-caption-uppercase uppercase text-ink-deep">Un espace pour chaque tâche</p>
            <h2 className="mt-md text-balance text-display-lg font-extrabold leading-tight tracking-tight text-ink sm:text-display-xl">
              De vos biens aux documents qui s&apos;y rapportent.
            </h2>
          </div>

          <div className="mt-3xl grid gap-lg lg:grid-cols-12">
            {universPro.map(({ Icone, numero, titre, texte, points }, index) => (
              <article
                key={numero}
                className={`relative flex min-w-0 flex-col overflow-hidden rounded-xl p-xl sm:p-2xl ${
                  index === 0
                    ? 'bg-surface-soft lg:col-span-5'
                    : index === 1
                      ? 'bg-surface-dark text-on-dark lg:col-span-7'
                      : 'border border-hairline bg-canvas lg:col-span-12 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-2xl'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-md">
                    <Icone size={26} strokeWidth={1.8} aria-hidden="true" className={index === 1 ? 'text-primary-on-dark' : 'text-ink-deep'} />
                    <span className={`text-caption-uppercase ${index === 1 ? 'text-on-dark-mute' : 'text-mute'}`}>{numero}</span>
                  </div>
                  <h3 className={`mt-xl max-w-[15ch] text-display-sm font-bold leading-tight tracking-tight ${index === 1 ? 'text-on-dark' : 'text-ink'}`}>
                    {titre}
                  </h3>
                  <p className={`mt-md max-w-[38rem] text-body-md ${index === 1 ? 'text-on-dark-mute' : 'text-body'}`}>{texte}</p>
                </div>
                <ul role="list" className={`mt-xl grid gap-sm ${index === 2 ? 'sm:grid-cols-3 lg:mt-0' : ''}`}>
                  {points.map((point) => (
                    <li key={point} className={`flex items-start gap-sm border-t pt-sm text-body-sm ${index === 1 ? 'border-white/15 text-on-dark' : 'border-hairline text-body'}`}>
                      <Check size={16} strokeWidth={2.5} aria-hidden="true" className={`mt-xxs shrink-0 ${index === 1 ? 'text-primary-on-dark' : 'text-ink-deep'}`} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Parcours du paiement au document ───────────────────────────── */}
      <section id="etapes" className="bg-surface-soft px-xl py-5xl">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-xl lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-caption-uppercase uppercase text-ink-deep">Le parcours</p>
              <h2 className="mt-md max-w-[13ch] text-balance text-display-lg font-extrabold leading-tight tracking-tight text-ink">
                Du versement au document correspondant.
              </h2>
              <p className="mt-lg max-w-[34rem] text-body-lg text-body">
                Le suivi dépend des informations du bail et de l&apos;état du paiement.
                Sikaloc distingue un versement partiel d&apos;une période soldée.
              </p>
            </div>
            <ol className="border-y border-hairline-strong">
              {etapes.map((etape) => (
                <li key={etape.numero} className="grid gap-sm border-b border-hairline py-xl last:border-0 sm:grid-cols-[4rem_1fr] sm:gap-lg">
                  <span className="text-display-sm font-bold text-ink-deep">{etape.numero}</span>
                  <div>
                    <h3 className="text-title-lg font-bold text-ink">{etape.titre}</h3>
                    <p className="mt-xs max-w-[42rem] text-body-md text-body">{etape.texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Documents et guide ────────────────────────────────────────── */}
      <section id="documents" className="px-xl py-5xl">
        <div className="mx-auto grid max-w-[1200px] gap-3xl lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-caption-uppercase uppercase text-ink-deep">Documents locatifs</p>
            <h2 className="mt-md max-w-[12ch] text-balance text-display-lg font-extrabold leading-tight tracking-tight text-ink">
              Un document lisible, rattaché au bon règlement.
            </h2>
            <p className="mt-lg max-w-[40rem] text-body-lg text-body">
              Retrouvez les reçus et quittances disponibles avec leur période et
              les informations de paiement associées. Un reçu concerne un versement
              partiel ; une quittance, une période entièrement réglée.
            </p>
            <div className="mt-xl flex flex-col items-start gap-md">
              <Link href="/exemple-quittance" className="btn btn-secondary">Ouvrir l&apos;exemple de quittance</Link>
              <Link href="/exemple-recu" className="lien-anime text-body-sm font-semibold text-ink underline underline-offset-4">Comparer avec un exemple de reçu</Link>
              <Link href="/legal/confidentialite" className="lien-anime text-body-sm font-medium text-mute underline underline-offset-4">Consulter la politique de confidentialité</Link>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-hairline bg-surface-soft p-sm sm:p-md">
            <div className="flex flex-wrap items-center justify-between gap-sm px-sm py-sm">
              <p className="text-caption-uppercase font-semibold text-ink-deep">Exemple de quittance Sikaloc</p>
              <span className="badge badge-neutral">Données fictives · Filigrane aperçu</span>
            </div>
            <iframe
              src="/exemple-quittance#toolbar=0&navpanes=0"
              title="Exemple public de quittance Sikaloc avec données fictives et filigrane aperçu"
              loading="lazy"
              className="h-[460px] w-full rounded-lg border border-hairline bg-canvas sm:h-[600px]"
            />
            <p className="px-sm pb-sm pt-md text-body-sm text-mute">
              Ce document est généré par le modèle Sikaloc à partir d&apos;identités fictives. Il s&apos;agit d&apos;un exemple, pas d&apos;un justificatif réel ni d&apos;un conseil juridique.
            </p>
          </div>
        </div>

        <div id="guide" className="mx-auto mt-3xl grid max-w-[1200px] gap-xl rounded-xl bg-surface-soft p-xl sm:p-2xl lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-caption-uppercase uppercase text-ink-deep">Guide gratuit</p>
            <h3 className="mt-sm text-title-xl font-bold text-ink">Comprendre les documents de loyer</h3>
            <p className="mt-sm max-w-[42rem] text-body-md text-body">
              Le guide présente les mentions, la différence entre reçu et quittance, et le processus de correction des paiements. Il ne remplace pas l&apos;avis d&apos;un professionnel du droit.
            </p>
            <ul role="list" className="mt-lg grid gap-sm sm:grid-cols-2">
              {POINTS_GUIDE.map((point) => (
                <li key={point} className="flex items-start gap-sm text-body-sm text-body">
                  <Check size={17} strokeWidth={2.5} aria-hidden="true" className="mt-xxs shrink-0 text-ink-deep" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg bg-canvas p-lg sm:p-xl">
            <FormulaireGuide />
          </div>
        </div>
      </section>

      {/* ── Tarifs ─────────────────────────────────────────────────────── */}
      <section id="tarifs" className="bg-canvas px-xl py-5xl">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-[42rem] text-center">
            <p className="text-caption-uppercase uppercase text-primary">Tarifs</p>
            <h2 className="mt-sm text-balance text-display-lg font-extrabold tracking-tight text-ink">Commencez simplement. Évoluez à votre rythme.</h2>
            <p className="mt-md text-body-lg text-mute">
              Le plan Gratuit permet de découvrir l&apos;outil. Le plan Standard
              ajoute les logements illimités et les relances WhatsApp.
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
                `/pro/paiements` n'appelle jamais `capacites()`, l'historique est
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
      <section id="faq" className="bg-surface-soft px-xl py-5xl">
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

      {/* ── Passerelle locataire ──────────────────────────────────────── */}
      <section id="locataire" className="px-xl py-3xl">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-lg rounded-xl border border-hairline bg-canvas p-xl sm:flex-row sm:items-center sm:justify-between sm:p-2xl">
          <div className="max-w-[42rem]">
            <p className="text-caption-uppercase uppercase text-primary">Vous êtes locataire ?</p>
            <h2 className="mt-sm text-title-xl font-bold text-ink">Votre bailleur peut vous inviter sur Sikaloc Me.</h2>
            <p className="mt-sm text-body-md text-body">
              L&apos;invitation relie votre compte aux informations et documents que le bailleur partage avec vous.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-md">
            <Link href="/me/rejoindre" className="btn btn-secondary">Comment rejoindre</Link>
            <Link href="/entrer" className="lien-anime text-body-sm font-semibold text-ink underline underline-offset-4">J&apos;ai déjà un compte</Link>
          </div>
        </div>
      </section>

      {/* ── Conclusion ─────────────────────────────────────────────────── */}
      <section className="px-xl pb-5xl pt-2xl">
        <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-xl bg-surface-dark px-xl py-4xl text-on-dark sm:px-3xl sm:py-5xl">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full border border-primary/25 sm:size-[28rem]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 top-1/2 hidden size-56 -translate-y-1/2 rounded-full border border-primary/15 lg:block" />
          <div className="relative max-w-[54rem]">
            <p className="text-caption-uppercase uppercase text-primary-on-dark">Sikaloc Pro</p>
            <h2 className="mt-md max-w-[15ch] text-balance text-display-lg font-extrabold leading-tight tracking-tight text-on-dark sm:text-display-xl">
              Vos locations méritent un suivi plus clair.
            </h2>
            <p className="mt-lg max-w-[38rem] text-body-lg text-on-dark-mute">
              Rassemblez les informations de vos biens, suivez les règlements
              enregistrés et retrouvez les documents disponibles.
            </p>
            <div className="mt-2xl flex flex-col items-start gap-md sm:flex-row sm:items-center">
              <Link href="/inscription" className="btn btn-primary">Commencer gratuitement</Link>
              <Link href="#tarifs" className="lien-anime text-body-sm font-semibold text-on-dark underline decoration-primary/60 underline-offset-4">Voir les tarifs</Link>
            </div>
            <p className="mt-lg text-body-sm text-on-dark-mute">
              Gratuit jusqu&apos;à {LIMITE_LOGEMENTS_GRATUIT} logements · Sans carte bancaire
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
