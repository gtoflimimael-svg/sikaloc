'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampMotDePasse } from '@/components/ui/champ-mot-de-passe'
import { ChampTelephone } from '@/components/ui/champ-telephone'
import { ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import { lienConnexion, lienMotDePasseOublie, type ContexteConnexion } from '@/lib/auth-contexte'
import {
  connecter,
  definirNouveauMotDePasse,
  demanderReinitialisation,
  inscrire,
} from '@/lib/actions/auth'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

export function FormulaireConnexion({
  suite = '/entrer',
  contexte = 'general',
}: {
  suite?: string
  contexte?: ContexteConnexion
}) {
  const [etat, action] = useActionState(connecter, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <input type="hidden" name="suite" value={suite} />

      <ChampTexte
        nom="email"
        libelle="Adresse email"
        type="email"
        autoComplete="username"
        placeholder="vous@exemple.bj"
        requis
        erreur={etat.erreursChamps?.email}
      />

      <div>
        {/* Pas de jauge ici : évaluer la force de ce que l'on tape sur un écran
            de connexion n'apprend rien et annonce à qui regarde par-dessus
            l'épaule combien de caractères il reste à deviner. */}
        <ChampMotDePasse
          nom="motDePasse"
          libelle="Mot de passe"
          autoComplete="current-password"
          requis
          erreur={etat.erreursChamps?.motDePasse}
        />
        <div className="mt-sm text-right">
          <Link href={lienMotDePasseOublie(contexte, suite)} className="text-body-sm text-mute hover:text-ink">
            Mot de passe oublié ?
          </Link>
        </div>
      </div>

      <BoutonSoumettre pleineLargeur libelleEnCours="Connexion…">
        Se connecter
      </BoutonSoumettre>
    </form>
  )
}

/** Inscription simple : les informations nécessaires au compte bailleur. */
export function FormulaireInscription({ codeParrain }: { codeParrain?: string }) {
  const [etat, action, enCours] = useActionState(inscrire, ETAT_INITIAL)
  const formulaire = useRef<HTMLFormElement>(null)
  const [valeurs, setValeurs] = useState<{ nom?: string; email?: string }>({})

  useEffect(() => {
    if (!etat.erreur && !Object.keys(etat.erreursChamps ?? {}).length) return
    const cible = formulaire.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? formulaire.current?.querySelector<HTMLElement>('[role="alert"]')
    if (cible) {
      if (!cible.hasAttribute('aria-invalid')) cible.tabIndex = -1
      cible.focus()
    }
  }, [etat])

  const retenirChamps = (evenement: FormEvent<HTMLFormElement>) => {
    const cible = evenement.target as HTMLInputElement
    const champ = cible.name || cible.id
    if (champ === 'nom' || champ === 'email') {
      setValeurs((precedentes) => ({ ...precedentes, [champ]: cible.value }))
    }
  }

  if (etat.succes) {
    return <Alerte ton="succes">{etat.succes}</Alerte>
  }

  return (
    <form
      ref={formulaire}
      action={action}
      onChange={retenirChamps}
      onReset={(evenement) => evenement.preventDefault()}
      aria-busy={enCours}
      className="signup-registration-form"
    >
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      {codeParrain ? (
        <Alerte ton="info">
          Vous êtes parrainé avec le code <strong>{codeParrain}</strong>. Vous
          recevrez 1 mois offert à votre première souscription.
        </Alerte>
      ) : null}

      <div className="signup-registration-fields">
        <ChampTexte
          nom="nom"
          libelle="Nom complet"
          valeurDefaut={valeurs.nom}
          autoComplete="name"
          placeholder="Ex. Koffi Adjovi"
          requis
          erreur={etat.erreursChamps?.nom}
        />

        <ChampTelephone
          nom="telephone"
          libelle="Téléphone"
          exigerPrefixeActuel
          aide="Ce numéro peut figurer sur vos quittances. Il n'est pas vérifié par SMS."
          requis
          erreur={etat.erreursChamps?.telephone}
        />

        <ChampTexte
          nom="email"
          libelle="Adresse email"
          type="email"
          autoComplete="email"
          inputMode="email"
          valeurDefaut={valeurs.email}
          placeholder="vous@exemple.bj"
          requis
          erreur={etat.erreursChamps?.email}
        />

        {/* `new-password` permet aux gestionnaires de proposer/enregistrer un
            secret. `contexteDepuis` pénalise les mots liés au nom, à l'email ou
            au téléphone ; les règles composées du serveur sont affichées dans
            le champ et vérifiées avant l'appel Auth. */}
        <ChampMotDePasse
          nom="motDePasse"
          libelle="Mot de passe"
          autoComplete="new-password"
          jauge
          requis
          contexteDepuis={['nom', 'email', 'telephone']}
          erreur={etat.erreursChamps?.motDePasse}
        />

        <BoutonSoumettre pleineLargeur libelleEnCours="Création…">
          Créer mon compte bailleur
        </BoutonSoumettre>
      </div>

      <input type="hidden" name="codeParrain" value={codeParrain ?? ''} />

      <p className="signup-terms">
        En créant un compte, vous acceptez les{' '}
        <Link href="/legal/conditions" className="underline">
          conditions d&apos;utilisation
        </Link>{' '}
        et la{' '}
        <Link href="/legal/confidentialite" className="underline">
          politique de confidentialité
        </Link>
        .
      </p>
    </form>
  )
}

export function FormulaireMotDePasseOublie({
  contexte = 'general',
  suite = '/entrer',
}: {
  contexte?: ContexteConnexion
  suite?: string
}) {
  const [etat, action] = useActionState(demanderReinitialisation, ETAT_INITIAL)

  if (etat.succes) {
    return (
      <div className="space-y-lg anim-apparait">
        <Alerte ton="succes">{etat.succes}</Alerte>
        <Link href={lienConnexion(contexte, suite)} className="btn btn-secondary w-full">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <input type="hidden" name="suite" value={suite} />

      <ChampTexte
        nom="email"
        libelle="Adresse email"
        type="email"
        autoComplete="username"
        placeholder="vous@exemple.bj"
        requis
        erreur={etat.erreursChamps?.email}
      />

      <BoutonSoumettre pleineLargeur libelleEnCours="Envoi…">
        Envoyer le lien de réinitialisation
      </BoutonSoumettre>
    </form>
  )
}

export function FormulaireNouveauMotDePasse({
  email,
  suite = '/entrer',
}: {
  email?: string
  suite?: string
}) {
  const [etat, action] = useActionState(definirNouveauMotDePasse, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <input type="hidden" name="suite" value={suite} />

      {/*
        Champ d'identifiant caché, recommandé par les éditeurs de navigateurs sur
        tout formulaire de changement de mot de passe : sans lui, le gestionnaire
        voit un mot de passe neuf sans savoir à quel compte le rattacher, et
        propose d'en créer un second au lieu de mettre à jour l'existant.

        `readOnly` plutôt que `disabled` : un champ désactivé n'est pas soumis et
        n'est pas lu par les gestionnaires.
      */}
      {email ? (
        <input
          type="email"
          name="identifiant"
          autoComplete="username"
          value={email}
          readOnly
          hidden
        />
      ) : null}

      <ChampMotDePasse
        nom="motDePasse"
        libelle="Nouveau mot de passe"
        autoComplete="new-password"
        jauge
        requis
        erreur={etat.erreursChamps?.motDePasse}
      />

      <ChampMotDePasse
        nom="confirmation"
        libelle="Confirmez le mot de passe"
        autoComplete="new-password"
        requis
        erreur={etat.erreursChamps?.confirmation}
      />

      <BoutonSoumettre pleineLargeur libelleEnCours="Enregistrement…">
        Enregistrer le nouveau mot de passe
      </BoutonSoumettre>
    </form>
  )
}
