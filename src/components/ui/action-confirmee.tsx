'use client'

import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react'

import { Spinner } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import type { EtatFormulaire } from '@/lib/validation'

const ContexteActions = createContext<{
  occupe: boolean
  reserver: () => boolean
  liberer: () => void
} | null>(null)

/** Des commandes alternatives ne doivent pas partir simultanément. */
export function GroupeActions({ children }: { children: ReactNode }) {
  const verrou = useRef(false)
  const [occupe, setOccupe] = useState(false)
  return (
    <ContexteActions.Provider value={{ occupe,
      reserver: () => {
        if (verrou.current) return false
        verrou.current = true
        setOccupe(true)
        return true
      },
      liberer: () => { verrou.current = false; setOccupe(false) },
    }}>
      <div className="flex flex-wrap items-start gap-md" role="group" aria-label="Actions sur le paiement" aria-busy={occupe}>{children}</div>
    </ContexteActions.Provider>
  )
}

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
  const [succes, setSucces] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()
  const verrou = useRef(false)
  const declencheur = useRef<HTMLButtonElement>(null)
  const annulation = useRef<HTMLButtonElement>(null)
  const confirmationAffichee = useRef(false)
  const idConfirmation = useId()

  useEffect(() => {
    if (confirme) {
      confirmationAffichee.current = true
      // Le choix sans effet reçoit le focus avant l’action irréversible.
      annulation.current?.focus()
    } else if (confirmationAffichee.current) {
      confirmationAffichee.current = false
      declencheur.current?.focus()
    }
  }, [confirme])

  function executer() {
    if (verrou.current) return
    verrou.current = true
    setErreur(null)
    setSucces(null)
    demarrer(async () => {
      try {
        const resultat = await action()
        if (resultat?.erreur) setErreur(resultat.erreur)
        else if (resultat?.succes) setSucces(resultat.succes)
        setConfirme(false)
      } finally {
        verrou.current = false
      }
    })
  }

  if (!confirme) {
    return (
      <div className="space-y-md">
        {erreur ? <Alerte ton="erreur">{erreur}</Alerte> : null}
        {succes ? <Alerte ton="succes">{succes}</Alerte> : null}
        <button
          type="button"
          ref={declencheur}
          onClick={() => setConfirme(true)}
          className={`btn btn-${varianteDeclencheur ?? variante} ${compact ? 'btn-sm' : ''}`}
        >
          {libelle}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-hairline-strong bg-canvas p-lg" role="group" aria-labelledby={`${idConfirmation}-titre`} aria-describedby={`${idConfirmation}-message`} aria-busy={enCours}
      onKeyDown={(evenement) => {
        if (evenement.key === 'Escape' && !enCours) {
          evenement.preventDefault()
          evenement.stopPropagation()
          setConfirme(false)
        }
      }}>
      <p id={`${idConfirmation}-titre`} className="text-body-md font-semibold text-ink">{titreConfirmation}</p>
      <p id={`${idConfirmation}-message`} className="mt-xs text-body-sm text-mute">{messageConfirmation}</p>

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
          ref={annulation}
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
  /*
   * La réussite s'affiche aussi, et pas seulement l'échec.
   *
   * Un bouton qui envoie un email à quelqu'un ne peut pas se contenter de ne
   * rien dire quand tout va bien : le bailleur n'a aucun autre moyen de savoir
   * si le message est parti, et il cliquerait une seconde fois.
   */
  const [succes, setSucces] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()
  const groupe = useContext(ContexteActions)

  return (
    <div className={pleineLargeur ? 'w-full space-y-md' : 'space-y-md'}>
      {erreur ? <Alerte ton="erreur">{erreur}</Alerte> : null}
      {succes ? <Alerte ton="succes">{succes}</Alerte> : null}

      <button
        type="button"
        disabled={enCours || groupe?.occupe}
        aria-busy={enCours}
        onClick={() => {
          if (enCours || (groupe && !groupe.reserver())) return
          setErreur(null)
          setSucces(null)
          demarrer(async () => {
            try {
              const resultat = await action()
              if (resultat?.erreur) setErreur(resultat.erreur)
              else if (resultat?.succes) setSucces(resultat.succes)
            } finally {
              groupe?.liberer()
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
