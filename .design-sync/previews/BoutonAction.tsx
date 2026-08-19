import { BoutonAction } from 'sikaloc-mvp'

const action = async () => ({})

export function Variantes() {
  return (
    <div className="flex flex-wrap items-start gap-md">
      <BoutonAction action={action} libelle="Valider le paiement" variante="primary" />
      <BoutonAction action={action} libelle="Régénérer la quittance" variante="secondary" />
    </div>
  )
}

export function Compact() {
  return <BoutonAction action={action} libelle="Relancer" variante="tertiary" compact />
}

export function PleineLargeur() {
  return (
    <BoutonAction
      action={action}
      libelle="Payer par Mobile Money"
      libelleEnCours="Redirection…"
      variante="primary"
      pleineLargeur
    />
  )
}
