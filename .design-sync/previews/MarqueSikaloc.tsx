import { MarqueSikaloc } from 'sikaloc-mvp'

export function Tailles() {
  return (
    <div className="flex flex-col items-start gap-lg">
      <MarqueSikaloc href={null} taille="sm" />
      <MarqueSikaloc href={null} taille="md" />
      <MarqueSikaloc href={null} taille="lg" />
    </div>
  )
}

export function SurSombre() {
  return (
    <div className="rounded-xl bg-surface-dark p-xl">
      <MarqueSikaloc href={null} taille="md" surSombre />
    </div>
  )
}
