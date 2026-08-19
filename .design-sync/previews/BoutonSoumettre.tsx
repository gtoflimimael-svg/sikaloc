import { BoutonSoumettre } from 'sikaloc-mvp'

// BoutonSoumettre lit useFormStatus() — il doit vivre dans un <form> pour
// connaître l'état de soumission. Hors formulaire il rend son état au repos.
export function Variantes() {
  return (
    <form className="flex flex-wrap items-center gap-md" action={() => {}}>
      <BoutonSoumettre variante="primary">Enregistrer</BoutonSoumettre>
      <BoutonSoumettre variante="secondary">Annuler</BoutonSoumettre>
      <BoutonSoumettre variante="tertiary">Ignorer</BoutonSoumettre>
      <BoutonSoumettre variante="danger">Supprimer</BoutonSoumettre>
    </form>
  )
}

export function Compact() {
  return (
    <form className="flex flex-wrap items-center gap-md" action={() => {}}>
      <BoutonSoumettre variante="primary" compact>Valider</BoutonSoumettre>
      <BoutonSoumettre variante="secondary" compact>Retour</BoutonSoumettre>
    </form>
  )
}

export function PleineLargeur() {
  return (
    <form action={() => {}}>
      <BoutonSoumettre variante="primary" pleineLargeur>
        Créer mon compte
      </BoutonSoumettre>
    </form>
  )
}
