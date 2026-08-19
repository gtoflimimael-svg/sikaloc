import type { ReactNode } from 'react'
import { EnTeteMobile } from 'sikaloc-mvp'

// EnTeteMobile porte `lg:hidden` : il disparaît au-dessus de 1024px, et les
// cartes d'aperçu sont capturées en large. On le présente donc dans un cadre
// téléphone qui force sa visibilité — c'est bien le rendu mobile réel.
const FORCER_VISIBLE = '.cadre-telephone > header { display: flex !important; }'

function CadreTelephone({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline-strong" style={{ width: 390 }}>
      <style>{FORCER_VISIBLE}</style>
      <div className="cadre-telephone bg-canvas-soft" style={{ minHeight: 260 }}>
        {children}
        <div className="p-lg">
          <p className="text-body-sm text-mute">Contenu de la page…</p>
        </div>
      </div>
    </div>
  )
}

export function AvecImpayes() {
  return (
    <CadreTelephone>
      <EnTeteMobile impayes={3} nomBailleur="Comlan Houngbédji" />
    </CadreTelephone>
  )
}

export function SansImpaye() {
  return (
    <CadreTelephone>
      <EnTeteMobile impayes={0} nomBailleur="Adjoa Kponou" />
    </CadreTelephone>
  )
}
