import { Spinner } from 'sikaloc-mvp'

export function Tailles() {
  return (
    <div className="flex items-center gap-xl text-ink">
      <Spinner taille={14} />
      <Spinner taille={20} />
      <Spinner taille={28} />
    </div>
  )
}

export function DansUnBouton() {
  return (
    <div className="flex flex-wrap items-center gap-md">
      <button type="button" className="btn btn-primary" disabled>
        <Spinner /> Enregistrement…
      </button>
      <button type="button" className="btn btn-secondary btn-sm" disabled>
        <Spinner /> Chargement
      </button>
    </div>
  )
}

export function SurFondColore() {
  return (
    <div className="flex items-center gap-lg rounded-lg bg-canvas-sage p-lg text-primary">
      <Spinner taille={24} />
      <span className="text-body-sm font-semibold text-ink-deep">Génération de la quittance…</span>
    </div>
  )
}
