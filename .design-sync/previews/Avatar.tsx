import { Avatar } from 'sikaloc-mvp'

export function Tailles() {
  return (
    <div className="flex items-center gap-md">
      <Avatar initiales="AK" taille={28} />
      <Avatar initiales="KA" taille={40} />
      <Avatar initiales="RB" taille={56} />
    </div>
  )
}

export function Tons() {
  return (
    <div className="flex items-center gap-md">
      <Avatar initiales="AK" ton="primary" />
      <Avatar initiales="MD" ton="neutre" />
    </div>
  )
}

export function AvecNom() {
  return (
    <div className="flex items-center gap-md">
      <Avatar initiales="AK" taille={44} />
      <span>
        <span className="block text-body-md font-semibold text-ink">Adjoa Kponou</span>
        <span className="block text-body-sm text-mute">Villa Aïdjèdo — Lot 42</span>
      </span>
    </div>
  )
}
