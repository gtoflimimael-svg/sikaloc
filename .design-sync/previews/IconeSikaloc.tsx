import { IconeSikaloc } from 'sikaloc-mvp'

export function Tailles() {
  return (
    <div className="flex items-end gap-lg">
      <IconeSikaloc taille={24} />
      <IconeSikaloc taille={32} />
      <IconeSikaloc taille={48} />
      <IconeSikaloc taille={64} />
    </div>
  )
}

export function SurFondSombre() {
  return (
    <div className="flex items-center gap-md rounded-xl bg-surface-dark p-xl">
      <IconeSikaloc taille={40} />
      <span className="text-display-xs font-extrabold tracking-tight text-on-dark">Sikaloc</span>
    </div>
  )
}
