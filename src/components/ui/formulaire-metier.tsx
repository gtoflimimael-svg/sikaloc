'use client'

import Link from 'next/link'
import { useEffect, useRef, type ReactNode, type FormEventHandler } from 'react'
import { useFormStatus } from 'react-dom'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import type { EtatFormulaire } from '@/lib/validation'

/** Cadre visuel commun ; les actions et validations restent chez l’appelant. */
export function FormulaireMetier({ action, etat, titre, children, onChange }: {
  action: (donnees: FormData) => void
  etat: EtatFormulaire
  titre: string
  children: ReactNode
  onChange?: FormEventHandler<HTMLFormElement>
}) {
  const formulaire = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (etat.erreur || Object.keys(etat.erreursChamps ?? {}).length) {
      formulaire.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-erreur-formulaire]')?.focus()
    }
  }, [etat])

  return (
    <form ref={formulaire} action={action} aria-label={titre} className="card card-lg"
      onChange={onChange}
      // Ces parcours redirigent à la réussite. Un refus doit conserver la saisie.
      onReset={(evenement) => evenement.preventDefault()}>
      <ContenuFormulaire>
        <p className="text-caption text-mute">Les champs marqués d’un * sont obligatoires.</p>
        {etat.erreur ? <div tabIndex={-1} data-erreur-formulaire><Alerte ton="erreur">{etat.erreur}</Alerte></div> : null}
        {children}
      </ContenuFormulaire>
    </form>
  )
}

function ContenuFormulaire({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus()
  return <fieldset disabled={pending} aria-busy={pending} className="min-w-0 space-y-lg">{children}</fieldset>
}

export function SectionFormulaire({ titre, description, children }: {
  titre: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="form-section min-w-0">
      <legend className="mb-md text-body-md font-semibold text-ink">{titre}</legend>
      {description ? <p className="mb-lg text-body-sm text-mute">{description}</p> : null}
      <div className="space-y-lg">{children}</div>
    </fieldset>
  )
}

export function ActionsFormulaire({ annulerVers, children }: { annulerVers: string; children: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <div className="form-actions">
      <BoutonSoumettre libelleEnCours="Enregistrement…">{children}</BoutonSoumettre>
      <Link href={annulerVers} className="btn btn-secondary" aria-disabled={pending || undefined}
        onClick={(evenement) => { if (pending) evenement.preventDefault() }}>
        Annuler
      </Link>
    </div>
  )
}
