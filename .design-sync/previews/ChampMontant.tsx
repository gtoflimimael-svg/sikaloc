import { ChampMontant } from 'sikaloc-mvp'

export function Standard() {
  return <ChampMontant nom="loyer" libelle="Loyer mensuel" valeurDefaut={75000} requis />
}

export function AvecAide() {
  return (
    <ChampMontant
      nom="caution"
      libelle="Caution"
      placeholder="0"
      aide="Généralement deux mois de loyer."
    />
  )
}

export function EnErreur() {
  return (
    <ChampMontant
      nom="montant"
      libelle="Montant encaissé"
      requis
      valeurDefaut={0}
      erreur="Le montant doit être supérieur à 0 FCFA."
    />
  )
}
