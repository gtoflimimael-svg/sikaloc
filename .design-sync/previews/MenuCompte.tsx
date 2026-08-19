import { MenuCompte } from 'sikaloc-mvp'

export function Standard() {
  return (
    <div className="flex justify-end p-lg">
      <MenuCompte nom="Comlan Houngbédji" email="comlan@exemple.bj" plan="Mensuel" />
    </div>
  )
}

export function PlanAnnuel() {
  return (
    <div className="flex justify-end p-lg">
      <MenuCompte nom="Adjoa Kponou" email="adjoa@exemple.bj" plan="Annuel" />
    </div>
  )
}
