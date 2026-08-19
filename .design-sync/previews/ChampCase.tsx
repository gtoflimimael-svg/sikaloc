import { ChampCase } from 'sikaloc-mvp'

export function Standard() {
  return (
    <ChampCase
      nom="quittance"
      libelle="Envoyer la quittance au locataire"
      description="Un SMS avec le lien de téléchargement part dès l'enregistrement du paiement."
      parDefaut
    />
  )
}

export function SansDescription() {
  return <ChampCase nom="rappels" libelle="Activer les rappels automatiques" />
}

export function EnErreur() {
  return (
    <ChampCase
      nom="conditions"
      libelle="J'accepte les conditions d'utilisation"
      erreur="Vous devez accepter les conditions pour continuer."
    />
  )
}
