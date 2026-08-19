'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { SelecteurAvatar } from '@/components/ui/selecteur-avatar'
import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import {
  connecter,
  definirNouveauMotDePasse,
  demanderReinitialisation,
  inscrire,
} from '@/lib/actions/auth'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

export function FormulaireConnexion({ suite }: { suite?: string }) {
  const [etat, action] = useActionState(connecter, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <input type="hidden" name="suite" value={suite ?? '/app'} />

      <ChampTexte
        nom="email"
        libelle="Adresse email"
        type="email"
        autoComplete="email"
        placeholder="vous@exemple.bj"
        requis
        erreur={etat.erreursChamps?.email}
      />

      <div>
        <ChampTexte
          nom="motDePasse"
          libelle="Mot de passe"
          type="password"
          autoComplete="current-password"
          requis
          erreur={etat.erreursChamps?.motDePasse}
        />
        <div className="mt-sm text-right">
          <Link href="/mot-de-passe-oublie" className="text-body-sm text-mute hover:text-ink">
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

export function FormulaireInscription({ codeParrain }: { codeParrain?: string }) {
  const [etat, action] = useActionState(inscrire, ETAT_INITIAL)
  // Amorce stable le temps du formulaire : sans compte, il n'y a pas encore
  // d'identifiant pour dériver un avatar. Figée par useState pour que l'aperçu
  // ne saute pas à chaque rendu.
  const [grainePremierAvatar] = useState(() => Math.random().toString(36).slice(2))

  if (etat.succes) {
    return <Alerte ton="succes">{etat.succes}</Alerte>
  }

  return (
    <form action={action} className="space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      {codeParrain ? (
        <Alerte ton="info">
          Vous êtes parrainé avec le code <strong>{codeParrain}</strong>. Vous
          recevrez 1 mois offert à votre première souscription.
        </Alerte>
      ) : null}

      <div className="rounded-lg border border-hairline bg-surface-soft p-lg">
        <p className="field-label">Votre avatar</p>
        <p className="mb-lg text-caption text-mute">
          Il vous représentera dans l&apos;application. Vous pourrez en changer
          à tout moment depuis vos paramètres.
        </p>
        <SelecteurAvatar nom="avatar" identifiant={grainePremierAvatar} taille={96} />
      </div>

      <ChampTexte
        nom="nom"
        libelle="Votre nom complet"
        autoComplete="name"
        placeholder="Koffi Adjovi"
        requis
        erreur={etat.erreursChamps?.nom}
      />

      <ChampTexte
        nom="telephone"
        libelle="Téléphone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+229 97 00 00 00"
        aide="Utilisé sur vos quittances et pour vous joindre."
        requis
        erreur={etat.erreursChamps?.telephone}
      />

      <ChampTexte
        nom="email"
        libelle="Adresse email"
        type="email"
        autoComplete="email"
        placeholder="vous@exemple.bj"
        requis
        erreur={etat.erreursChamps?.email}
      />

      <ChampTexte
        nom="motDePasse"
        libelle="Mot de passe"
        type="password"
        autoComplete="new-password"
        aide="8 caractères minimum, avec au moins une lettre et un chiffre."
        requis
        erreur={etat.erreursChamps?.motDePasse}
      />

      <ChampTexte
        nom="nbLogements"
        libelle="Combien de logements gérez-vous ?"
        type="number"
        inputMode="numeric"
        min={0}
        max={1000}
        placeholder="5"
        erreur={etat.erreursChamps?.nbLogements}
      />

      <input type="hidden" name="codeParrain" value={codeParrain ?? ''} />

      <BoutonSoumettre pleineLargeur libelleEnCours="Création…">
        Créer mon compte
      </BoutonSoumettre>

      <p className="text-caption text-mute">
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

export function FormulaireMotDePasseOublie() {
  const [etat, action] = useActionState(demanderReinitialisation, ETAT_INITIAL)

  if (etat.succes) {
    return (
      <div className="space-y-lg">
        <Alerte ton="succes">{etat.succes}</Alerte>
        <Link href="/connexion" className="btn btn-secondary w-full">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <ChampTexte
        nom="email"
        libelle="Adresse email"
        type="email"
        autoComplete="email"
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

export function FormulaireNouveauMotDePasse() {
  const [etat, action] = useActionState(definirNouveauMotDePasse, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <ChampTexte
        nom="motDePasse"
        libelle="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        aide="8 caractères minimum, avec au moins une lettre et un chiffre."
        requis
        erreur={etat.erreursChamps?.motDePasse}
      />

      <ChampTexte
        nom="confirmation"
        libelle="Confirmez le mot de passe"
        type="password"
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
