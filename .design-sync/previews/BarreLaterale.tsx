import { BarreLaterale } from 'sikaloc-mvp'

// usePathname() est stubbé sur /app dans les previews : la ligne « Tableau de
// bord » ressort donc en état actif.
export function AvecImpayes() {
  return (
    <div className="h-[560px]">
      <BarreLaterale impayes={2} />
    </div>
  )
}

export function SansImpaye() {
  return (
    <div className="h-[560px]">
      <BarreLaterale impayes={0} />
    </div>
  )
}
