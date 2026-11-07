'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import styles from './onboarding.module.css'

import { CaptureSignature } from '@/components/app/capture-signature'
import { Alerte } from '@/components/ui/retours'
import { ignorerOnboarding, terminerOnboarding } from '@/lib/actions/onboarding'
import { televerserSignatureOnboarding } from '@/lib/actions/parametres'
import type { EtatFormulaire } from '@/lib/validation'
import { formaterTelephone } from '@/lib/telephone'

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
  signatureExistante,
}: {
  nomBailleur: string
  telephoneBailleur: string
  emailBailleur: string
  signatureExistante: boolean
}) {
  const [etape, setEtape] = useState<Etape>(1)
  const [etatIgnorer, actionIgnorer] = useActionState(ignorerOnboarding, ETAT_INITIAL)
  const titre = useRef<HTMLHeadingElement>(null)
  const premiereEtape = useRef(true)
  useEffect(() => {
    if (premiereEtape.current) { premiereEtape.current = false; return }
    titre.current?.focus()
  }, [etape])

  return (
    <div className="mx-auto max-w-[40rem]">
      <header className={styles.intro}>
        <p className={styles.step}>
          Étape {etape} sur 2
        </p>
        <h1 ref={titre} tabIndex={-1} className={styles.title}>
          {TITRES[etape].titre}
        </h1>
        <p className={styles.description}>{TITRES[etape].aide}</p>

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
        <div >
          <dl className={styles.facts}>
            <Ligne terme="Nom" definition={nomBailleur} />
            <Ligne terme="Téléphone" definition={formaterTelephone(telephoneBailleur)} />
            <Ligne terme="Email" definition={emailBailleur} />
          </dl>

          <div className={styles.actions}>
            <button type="button" onClick={() => setEtape(2)} className="btn btn-primary">
              Continuer
            </button>
            <form action={actionIgnorer}>
              <button type="submit" className="btn btn-secondary">
                Aller directement au tableau de bord
              </button>
            </form>
          </div>
          {etatIgnorer.erreur ? <Alerte ton="erreur">{etatIgnorer.erreur}</Alerte> : null}
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
  const [etat, action] = useActionState(televerserSignatureOnboarding, ETAT_INITIAL)
  const [etatFinalisation, actionFinalisation] = useActionState(terminerOnboarding, ETAT_INITIAL)

  // Une signature déjà persistée permet de reprendre la finalisation si le
  // réseau s'est interrompu entre sa sauvegarde et la mise à jour du profil.
  const enregistree = dejaEnregistree || Boolean(etat.succes)

  return (
    <div className="space-y-lg">
      {enregistree ? (
        <Alerte ton="succes">
          Votre signature est enregistrée. Elle apparaîtra sur chaque quittance.
        </Alerte>
      ) : null}

      <form action={action} className={`${styles.signature} space-y-lg`}>
        {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
        <CaptureSignature restaurerApresEchec={etat.erreur ? etat : null} />
      </form>

      <div className={styles.actions}>
        <form action={actionFinalisation}>
          {etatFinalisation.erreur ? <Alerte ton="erreur">{etatFinalisation.erreur}</Alerte> : null}
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
    <div className={styles.fact}>
      <dt className="text-body-sm text-mute">{terme}</dt>
      <dd className="text-body-md font-semibold text-ink">{definition}</dd>
    </div>
  )
}
