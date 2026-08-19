'use client'

import { useState, useTransition } from 'react'

import { Spinner } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import type { EtatFormulaire } from '@/lib/validation'

/**
 * Bouton d'action irréversible, avec confirmation en deux temps.
 *
 * La confirmation est rendue en place plutôt que via `window.confirm` : la
 * boîte native est illisible sur mobile et ne peut pas expliquer les
 * conséquences.
 */
export function ActionConfirmee({
  action,
  libelle,
  titreConfirmation,
  messageConfirmation,
  libelleConfirmation,
  variante = 'danger',
  varianteDeclencheur,
  compact = true,
}: {
  action: () => Promise<EtatFormulaire | void>
  libelle: string
  titreConfirmation: string
  messageConfirmation: string
  libelleConfirmation?: string
  /** Apparence du bouton de CONFIRMATION — celui qui agit vraiment. */
  variante?: 'danger' | 'secondary' | 'tertiary' | 'primary'
  /**
   * Apparence du DÉCLENCHEUR, quand elle doit différer. Dans une liste, un
   * bouton rouge plein par ligne fait de l'action la plus dangereuse la plus
   * voyante : on préfère un déclencheur discret et une confirmation franche.
   * Par défaut, identique à `variante`.
   */
  varianteDeclencheur?: 'danger' | 'secondary' | 'tertiary' | 'primary'
  compact?: boolean
}) {
  const [confirme, setConfirme] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()

  function executer() {
    setErreur(null)
    demarrer(async () => {
      const resultat = await action()
      if (resultat && 'erreur' in resultat && resultat.erreur) {
        setErreur(resultat.erreur)
        setConfirme(false)
      }
    })
  }

  if (!confirme) {
    return (
      <div className="space-y-md">
        {erreur ? <Alerte ton="erreur">{erreur}</Alerte> : null}
        <button
          type="button"
          onClick={() => setConfirme(true)}
          className={`btn btn-${varianteDeclencheur ?? variante} ${compact ? 'btn-sm' : ''}`}
        >
          {libelle}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-hairline-strong bg-canvas p-lg">
      <p className="text-body-md font-semibold text-ink">{titreConfirmation}</p>
      <p className="mt-xs text-body-sm text-mute">{messageConfirmation}</p>

      <div className="mt-lg flex flex-wrap gap-sm">
        <button
          type="button"
          onClick={executer}
          disabled={enCours}
          className={`btn btn-${variante} btn-sm`}
        >
          {enCours ? (
            <>
              <Spinner /> En cours…
            </>
          ) : (
            (libelleConfirmation ?? 'Confirmer')
          )}
        </button>
        <button
          type="button"
          onClick={() => setConfirme(false)}
          disabled={enCours}
          className="btn btn-secondary btn-sm"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

/** Bouton déclenchant une Server Action sans confirmation préalable. */
export function BoutonAction({
  action,
  libelle,
  libelleEnCours = 'En cours…',
  variante = 'primary',
  compact = false,
  pleineLargeur = false,
}: {
  action: () => Promise<EtatFormulaire | void>
  libelle: string
  libelleEnCours?: string
  variante?: 'primary' | 'secondary' | 'tertiary' | 'danger'
  compact?: boolean
  pleineLargeur?: boolean
}) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()

  return (
    <div className={pleineLargeur ? 'w-full space-y-md' : 'space-y-md'}>
      {erreur ? <Alerte ton="erreur">{erreur}</Alerte> : null}

      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          setErreur(null)
          demarrer(async () => {
            const resultat = await action()
            if (resultat && 'erreur' in resultat && resultat.erreur) {
              setErreur(resultat.erreur)
            }
          })
        }}
        className={[
          'btn',
          `btn-${variante}`,
          compact ? 'btn-sm' : '',
          pleineLargeur ? 'w-full' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {enCours ? (
          <>
            <Spinner /> {libelleEnCours}
          </>
        ) : (
          libelle
        )}
      </button>
    </div>
  )
}
