import type { ReactNode } from 'react'

/**
 * Champs de formulaire — spec design « Inputs & Forms ».
 *
 * Hauteur 48px, corps à 16px : le design system l'impose pour la lisibilité et
 * le confort de tap (WCAG AAA).
 */

interface ProprietesCommunes {
  nom: string
  libelle: string
  erreur?: string
  aide?: string
  requis?: boolean
}

function Enveloppe({
  nom,
  libelle,
  erreur,
  aide,
  requis,
  children,
}: ProprietesCommunes & { children: ReactNode }) {
  return (
    <div>
      <label htmlFor={nom} className="field-label">
        {libelle}
        {requis ? <span className="text-negative"> *</span> : null}
      </label>
      {children}
      {aide && !erreur ? <p className="field-hint">{aide}</p> : null}
      {erreur ? (
        <p className="field-error" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  )
}

export function ChampTexte({
  type = 'text',
  valeurDefaut,
  placeholder,
  inputMode,
  autoComplete,
  min,
  max,
  step,
  ...commun
}: ProprietesCommunes & {
  type?: string
  valeurDefaut?: string | number | null
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email'
  autoComplete?: string
  min?: number | string
  max?: number | string
  step?: number | string
}) {
  return (
    <Enveloppe {...commun}>
      <input
        id={commun.nom}
        name={commun.nom}
        type={type}
        defaultValue={valeurDefaut ?? undefined}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        min={min}
        max={max}
        step={step}
        required={commun.requis}
        aria-invalid={commun.erreur ? true : undefined}
        aria-describedby={commun.erreur ? `${commun.nom}-erreur` : undefined}
        className="input"
      />
    </Enveloppe>
  )
}

export function ChampSelection({
  options,
  valeurDefaut,
  placeholder,
  ...commun
}: ProprietesCommunes & {
  options: { valeur: string; libelle: string }[]
  valeurDefaut?: string | null
  placeholder?: string
}) {
  return (
    <Enveloppe {...commun}>
      <select
        id={commun.nom}
        name={commun.nom}
        defaultValue={valeurDefaut ?? ''}
        required={commun.requis}
        aria-invalid={commun.erreur ? true : undefined}
        className="input"
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    </Enveloppe>
  )
}

export function ChampCase({
  nom,
  libelle,
  description,
  erreur,
  parDefaut,
}: {
  nom: string
  libelle: string
  description?: string
  erreur?: string
  parDefaut?: boolean
}) {
  return (
    <div>
      <label
        htmlFor={nom}
        className="flex cursor-pointer items-start gap-md rounded-md border border-hairline bg-canvas p-lg"
      >
        <input
          id={nom}
          name={nom}
          type="checkbox"
          defaultChecked={parDefaut}
          className="mt-xxs size-5 shrink-0 accent-primary"
        />
        <span>
          <span className="block text-body-md font-semibold text-ink">{libelle}</span>
          {description ? (
            <span className="mt-xxs block text-body-sm text-mute">{description}</span>
          ) : null}
        </span>
      </label>
      {erreur ? (
        <p className="field-error" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  )
}

export function ChampMontant({
  valeurDefaut,
  placeholder,
  ...commun
}: ProprietesCommunes & {
  valeurDefaut?: number | string | null
  placeholder?: string
}) {
  return (
    <Enveloppe {...commun}>
      <div className="relative">
        <input
          id={commun.nom}
          name={commun.nom}
          type="number"
          min={0}
          step={1}
          placeholder={placeholder}
          defaultValue={valeurDefaut ?? undefined}
          required={commun.requis}
          inputMode="numeric"
          aria-invalid={commun.erreur ? true : undefined}
          className="input tabular pr-[72px]"
        />
        <span className="pointer-events-none absolute right-lg top-1/2 -translate-y-1/2 text-body-sm font-semibold text-mute">
          FCFA
        </span>
      </div>
    </Enveloppe>
  )
}
