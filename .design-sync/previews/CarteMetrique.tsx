import { CarteMetrique } from 'sikaloc-mvp'

export function Tons() {
  return (
    <div className="space-y-lg">
      <CarteMetrique ton="primary" label="Encaissé en octobre" valeur="425 000 FCFA" detail="+12 % vs septembre" />
      <CarteMetrique label="Logements occupés" valeur="7 / 9" detail="2 disponibles" />
      <CarteMetrique ton="alerte" label="Impayés" valeur="150 000 FCFA" detail="2 locataires en retard" />
    </div>
  )
}

export function RangeeTableauDeBord() {
  return (
    <div className="grid gap-lg sm:grid-cols-3">
      <CarteMetrique ton="primary" label="Encaissé" valeur="425 000" detail="FCFA ce mois-ci" />
      <CarteMetrique label="Quittances émises" valeur="7" detail="sur 9 baux actifs" />
      <CarteMetrique ton="alerte" label="En retard" valeur="2" detail="depuis plus de 5 jours" />
    </div>
  )
}

export function SansDetail() {
  return <CarteMetrique label="Baux actifs" valeur="9" />
}
