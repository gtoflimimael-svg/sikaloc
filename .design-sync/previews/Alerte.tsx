import { Alerte } from 'sikaloc-mvp'

export function Erreur() {
  return <Alerte ton="erreur">Le montant doit être supérieur à 0 FCFA.</Alerte>
}

export function Succes() {
  return <Alerte ton="succes">Quittance générée et envoyée à Adjoa Kponou.</Alerte>
}

export function Info() {
  return <Alerte ton="info">Les loyers d'octobre seront relancés automatiquement le 5.</Alerte>
}

export function Attention() {
  return <Alerte ton="attention">Votre essai gratuit se termine dans 3 jours.</Alerte>
}
