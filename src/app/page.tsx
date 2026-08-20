import { Check } from 'lucide-react'
import Link from 'next/link'

import { PiedDePage } from '@/components/marketing/pied-de-page'
import { Illustration } from '@/components/ui/illustration'
import { MarqueSikaloc } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'
import { formaterFCFA } from '@/lib/format'
import { LIMITE_LOGEMENTS_GRATUIT, PRIX_STANDARD_FCFA } from '@/lib/plan'
import { obtenirUtilisateur } from '@/lib/supabase/serveur'

const etapes = [
  {
    numero: '1',
    titre: 'Enregistrez vos baux',
    texte:
      'Logement, locataire, loyer, jour d’échéance. Trois minutes pour tout mettre à plat, une fois pour toutes.',
  },
  {
    numero: '2',
    titre: 'Saisissez le paiement',
    texte:
      'Montant, mois concerné, mode de règlement. Sikaloc calcule la période et vous montre un récapitulatif avant de valider.',
  },
  {
    numero: '3',
    titre: 'Envoyez la quittance',
    texte:
      'Le PDF conforme est généré, numéroté et horodaté. Un bouton l’envoie au locataire sur WhatsApp.',
  },
]

const fonctionnalites = [
  {
    titre: 'Quittances conformes Bénin',
    texte:
      'Montant en lettres, mention du droit de timbre, décharge, horodatage et votre signature incrustée. Numérotation infalsifiable.',
  },
  {
    titre: 'Impayés détectés tout seuls',
    texte:
      'Chaque bail a son jour d’échéance et sa tolérance. Passé le délai, le loyer bascule en impayé et remonte en haut du tableau de bord.',
  },
  {
    titre: 'Relance WhatsApp en un clic',
    texte:
      'Le message est déjà rédigé avec le nom, la période, le montant et la date d’échéance. Vous relisez, vous envoyez.',
  },
  {
    titre: 'Vos chiffres en un coup d’œil',
    texte:
      'Taux d’occupation, taux de recouvrement, impayés, chiffre d’affaires du mois. Mis à jour à chaque paiement.',
  },
  {
    titre: 'Le locataire n’a rien à installer',
    texte:
      'Il reçoit un lien de téléchargement sécurisé, valable 30 jours. Pas de compte, pas de mot de passe.',
  },
  {
    titre: 'Vos données restent les vôtres',
    texte:
      'Chaque bailleur ne voit que ses propres données, isolées au niveau de la base. Hébergement en Europe.',
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
]

export default async function PageAccueil() {
  const utilisateur = await obtenirUtilisateur()

  return (
    <div className="min-h-screen bg-canvas-soft">
      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-xl">
          <MarqueSikaloc />

          <div className="hidden items-center gap-xl md:flex">
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
                <Link href="/connexion" className="btn btn-secondary btn-sm">
                  Se connecter
                </Link>
                <Link href="/inscription" className="btn btn-primary btn-sm">
                  Commencer
                </Link>
              </>
            )}
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

              <h1 className="anim-monte text-display-lg font-extrabold tracking-tight text-ink sm:text-display-xl lg:text-display-xxl xl:text-display-mega">
                Gérez vos loyers
                <br />
                sans effort
              </h1>

              <p className="mt-xl max-w-[36rem] text-body-lg text-body">
                Sikaloc remplace le carnet et le tableur. Enregistrez un paiement,
                obtenez une quittance PDF conforme, envoyez-la au locataire sur
                WhatsApp — le tout en moins de trois clics.
              </p>

              <div className="mt-2xl flex flex-wrap items-center gap-md">
                <Link href="/inscription" className="btn btn-primary">
                  Créer mon compte gratuitement
                </Link>
                <Link href="#etapes" className="btn btn-tertiary">
                  Voir comment ça marche
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

      {/* ── Étapes ─────────────────────────────────────────────────────── */}
      <section id="etapes" className="bg-canvas px-xl py-5xl">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-caption-uppercase uppercase text-primary">
            Comment ça marche
          </p>
          <h2 className="mt-sm max-w-[42rem] text-display-md font-extrabold tracking-tight text-ink">
            Trois clics entre le paiement reçu et la quittance envoyée
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

          <div className="mx-auto mt-3xl grid max-w-[56rem] gap-xl md:grid-cols-2 md:items-start">
            <div className="card card-lg">
              <p className="text-title-lg font-bold text-ink">Gratuit</p>
              <p className="mt-sm text-display-md font-extrabold tabular tracking-tight text-ink">0 FCFA</p>
              <p className="mt-xs text-body-sm text-mute">Pour démarrer</p>

              <ul className="mt-xl space-y-md text-body-md text-body">
                <Puce>Jusqu&apos;à {LIMITE_LOGEMENTS_GRATUIT} logements</Puce>
                <Puce>Baux, locataires et paiements illimités</Puce>
                <Puce>Quittances PDF basiques</Puce>
                <Puce>Tableau de bord et suivi des impayés</Puce>
              </ul>

              <Link href="/inscription" className="btn btn-secondary mt-xl w-full">
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

              <Link href="/inscription" className="btn btn-primary mt-xl w-full">
                Passer au plan Standard
              </Link>
            </div>
          </div>

          <p className="mt-xl text-center text-body-sm text-mute">
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
              Créez votre compte, enregistrez votre premier bail, saisissez un
              paiement. C&apos;est tout.
            </p>
            <Link href="/inscription" className="btn btn-primary mt-2xl">
              Créer mon compte
            </Link>
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
