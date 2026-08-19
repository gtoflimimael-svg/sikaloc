import { ActionConfirmee } from 'sikaloc-mvp'

const action = async () => ({})

export function Danger() {
  return (
    <ActionConfirmee
      action={action}
      libelle="Supprimer ce logement"
      titreConfirmation="Supprimer Villa Aïdjèdo — Lot 42 ?"
      messageConfirmation="Le bail en cours et l'historique des paiements seront supprimés. Cette action est irréversible."
      libelleConfirmation="Oui, supprimer"
    />
  )
}

export function Secondaire() {
  return (
    <ActionConfirmee
      action={action}
      libelle="Résilier le bail"
      titreConfirmation="Résilier le bail d'Adjoa Kponou ?"
      messageConfirmation="Le logement redeviendra disponible. Les quittances déjà émises sont conservées."
      libelleConfirmation="Résilier"
      variante="secondary"
      compact={false}
    />
  )
}
