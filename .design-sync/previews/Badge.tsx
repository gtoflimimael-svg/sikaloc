import { Badge } from 'sikaloc-mvp'

export function Statuts() {
  return (
    <div className="flex flex-wrap items-center gap-sm">
      <Badge ton="positive">Payé</Badge>
      <Badge ton="warning">En attente</Badge>
      <Badge ton="negative">Impayé</Badge>
      <Badge ton="neutral">Résilié</Badge>
    </div>
  )
}

export function DansUneListe() {
  return (
    <div className="space-y-sm">
      {[
        { nom: 'Adjoa Kponou', ton: 'positive' as const, statut: 'Payé' },
        { nom: 'Kossi Amoussou', ton: 'warning' as const, statut: 'En attente' },
        { nom: 'Rachidatou Bio', ton: 'negative' as const, statut: 'Impayé' },
      ].map((l) => (
        <div key={l.nom} className="flex items-center justify-between gap-md rounded-md border border-hairline bg-canvas px-lg py-md">
          <span className="text-body-sm font-semibold text-ink">{l.nom}</span>
          <Badge ton={l.ton}>{l.statut}</Badge>
        </div>
      ))}
    </div>
  )
}
