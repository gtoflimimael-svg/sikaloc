import { CarteAuth, ChampTexte, BoutonSoumettre } from 'sikaloc-mvp'

export function Connexion() {
  return (
    <CarteAuth
      titre="Content de vous revoir"
      description="Connectez-vous pour suivre vos loyers."
      bas={<>Pas encore de compte ? <a href="/inscription" className="font-semibold text-primary">Créer un compte</a></>}
    >
      <form className="space-y-lg" action={() => {}}>
        <ChampTexte nom="email" libelle="Email" type="email" requis placeholder="adjoa@exemple.bj" />
        <ChampTexte nom="motdepasse" libelle="Mot de passe" type="password" requis />
        <BoutonSoumettre pleineLargeur>Se connecter</BoutonSoumettre>
      </form>
    </CarteAuth>
  )
}

export function SansDescription() {
  return (
    <CarteAuth titre="Mot de passe oublié">
      <form className="space-y-lg" action={() => {}}>
        <ChampTexte nom="email" libelle="Email" type="email" requis aide="Nous vous enverrons un lien de réinitialisation." />
        <BoutonSoumettre pleineLargeur>Envoyer le lien</BoutonSoumettre>
      </form>
    </CarteAuth>
  )
}
