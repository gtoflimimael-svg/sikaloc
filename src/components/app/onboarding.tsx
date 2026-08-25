'use client'

import { useActionState, useState } from 'react'

import { CaptureSignature } from '@/components/app/capture-signature'
import { Alerte } from '@/components/ui/retours'
import { ignorerOnboarding, terminerOnboarding } from '@/lib/actions/onboarding'
import { televerserSignature } from '@/lib/actions/parametres'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

type Etape = 1 | 2

const TITRES: Record<Etape, { titre: string; aide: string }> = {
  1: {
    titre: 'Votre activité',
    aide: 'Voici ce que nous savons de vous. Ces informations apparaîtront sur vos quittances.',
  },
  2: {
    titre: 'Votre signature',
    aide: 'Elle sera apposée sur chaque quittance. Enregistrez-la maintenant, ou plus tard depuis vos paramètres.',
  },
}

/**
 * Assistant d'accueil, en deux étapes.
 *
 * ─── Pourquoi deux et non quatre ────────────────────────────────────────────
 *
 * Les étapes « premier locataire » et « premier bail » étaient obligatoires
 * pour atteindre le tableau de bord. Quelqu'un qui découvre Sikaloc n'a pas
 * forcément un locataire sous la main au moment où il s'inscrit ; l'obliger à
 * en saisir un produisait soit un abandon, soit des données inventées dès la
 * première minute.
 *
 * Le didacticiel du tableau de bord prend le relais : il montre où ajouter un
 * logement, un locataire, un bail, quand le bailleur aura les informations.
 *
 * Les deux étapes restantes sont toutes deux facultatives — chacune porte son
 * bouton pour passer outre.
 */
export function AssistantOnboarding({
  nomBailleur,
  telephoneBailleur,
  emailBailleur,
  nbLogementsDeclare,
  signatureExistante,
}: {
  nomBailleur: string
  telephoneBailleur: string
  emailBailleur: string
  nbLogementsDeclare: number | null
  signatureExistante: boolean
}) {
  const [etape, setEtape] = useState<Etape>(1)

  return (
    <div className="mx-auto max-w-[40rem]">
      <header className="mb-2xl">
        <p className="text-caption-uppercase uppercase text-primary">
          Étape {etape} sur 2
        </p>
        <h1 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">
          {TITRES[etape].titre}
        </h1>
        <p className="mt-md text-body-md text-mute">{TITRES[etape].aide}</p>

        <div className="mt-lg flex gap-xs" aria-hidden="true">
          {([1, 2] as const).map((numero) => (
            <span
              key={numero}
              className={`h-1 flex-1 rounded-pill ${
                numero <= etape ? 'bg-primary' : 'bg-hairline'
              }`}
            />
          ))}
        </div>
      </header>

      {/* ── Étape 1 — récapitulatif ──────────────────────────────────── */}
      {etape === 1 ? (
        <div className="card card-lg anim-apparait">
          <dl className="space-y-lg">
            <Ligne terme="Nom" definition={nomBailleur} />
            <Ligne terme="Téléphone" definition={telephoneBailleur} />
            <Ligne terme="Email" definition={emailBailleur} />
            <Ligne
              terme="Logements gérés"
              definition={
                nbLogementsDeclare !== null ? String(nbLogementsDeclare) : 'Non précisé'
              }
            />
          </dl>

          <div className="mt-2xl flex flex-wrap gap-md">
            <button type="button" onClick={() => setEtape(2)} className="btn btn-primary">
              Continuer
            </button>
            <form action={ignorerOnboarding}>
              <button type="submit" className="btn btn-secondary">
                Aller directement au tableau de bord
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Étape 2 — signature ──────────────────────────────────────── */}
      {etape === 2 ? (
        <EtapeSignature
          dejaEnregistree={signatureExistante}
          onRetour={() => setEtape(1)}
        />
      ) : null}
    </div>
  )
}

function EtapeSignature({
  dejaEnregistree,
  onRetour,
}: {
  dejaEnregistree: boolean
  onRetour: () => void
}) {
  const [etat, action] = useActionState(televerserSignature, ETAT_INITIAL)

  // Déduit plutôt que mémorisé dans un état : une signature est enregistrée si
  // elle l'était déjà, ou si l'action vient de réussir. Un `useState` synchronisé
  // par un effet dirait la même chose avec un rendu de retard.
  //
  // La sortie de l'assistant reste une action distincte : on ne redirige pas de
  // force, le bailleur voit que c'est enregistré puis décide de continuer.
  const enregistree = dejaEnregistree || Boolean(etat.succes)

  return (
    <div className="space-y-lg anim-apparait">
      {enregistree ? (
        <Alerte ton="succes">
          Votre signature est enregistrée. Elle apparaîtra sur chaque quittance.
        </Alerte>
      ) : null}

      <form action={action} className="card card-lg space-y-lg">
        {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
        <CaptureSignature />
      </form>

      <div className="flex flex-wrap gap-md">
        <form action={terminerOnboarding}>
          <button type="submit" className="btn btn-primary">
            {enregistree ? 'Voir mon tableau de bord' : 'Je la mettrai plus tard'}
          </button>
        </form>
        <button type="button" onClick={onRetour} className="btn btn-secondary">
          Retour
        </button>
      </div>
    </div>
  )
}

function Ligne({ terme, definition }: { terme: string; definition: string }) {
  return (
    <div className="flex items-baseline justify-between gap-lg border-b border-hairline-soft pb-md last:border-0 last:pb-0">
      <dt className="text-body-sm text-mute">{terme}</dt>
      <dd className="text-body-md font-semibold text-ink">{definition}</dd>
    </div>
  )
}
