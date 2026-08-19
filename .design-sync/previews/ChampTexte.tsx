import { ChampTexte } from 'sikaloc-mvp'

export function Standard() {
  return (
    <div className="space-y-lg">
      <ChampTexte nom="nom" libelle="Nom du locataire" placeholder="Adjoa Kponou" requis />
      <ChampTexte nom="telephone" libelle="Téléphone" type="tel" inputMode="tel" valeurDefaut="+229 97 12 34 56" />
    </div>
  )
}

export function AvecAide() {
  return (
    <ChampTexte
      nom="email"
      libelle="Email"
      type="email"
      aide="Sert à envoyer la quittance au locataire."
      placeholder="adjoa@exemple.bj"
    />
  )
}

export function EnErreur() {
  return (
    <ChampTexte
      nom="telephone"
      libelle="Téléphone"
      requis
      valeurDefaut="97 12"
      erreur="Numéro incomplet — 8 chiffres attendus."
    />
  )
}
