'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampMotDePasse } from '@/components/ui/champ-mot-de-passe'
import { ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import { SelecteurAvatar } from '@/components/ui/selecteur-avatar'
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

/**
 * Inscription en deux temps : d'abord qui vous êtes, ensuite à quoi vous
 * ressemblez.
 *
 * L'ordre compte. Ouvrir sur le choix d'un avatar donne l'impression d'un jeu
 * là où le bailleur vient créer un outil de travail ; et si le formulaire
 * échoue à la validation, il a personnalisé un personnage pour rien.
 *
 * Les deux étapes vivent dans un seul <form> : passer de l'une à l'autre
 * masque des champs sans les démonter, la saisie survit donc au retour arrière.
 */
export function FormulaireInscription({ codeParrain }: { codeParrain?: string }) {
  const [etat, action] = useActionState(inscrire, ETAT_INITIAL)
  const [etape, setEtape] = useState<1 | 2>(1)

  // Amorce stable le temps du formulaire : sans compte, il n'y a pas encore
  // d'identifiant pour dériver un avatar. `Math.random()` dans l'initialiseur
  // de useState y donnait une valeur différente au rendu serveur et au rendu
  // client initial (chacun l'évalue de son côté) : un mésappariement
  // d'hydratation (erreur React #418) qui invalidait tout le sous-arbre — y
  // compris l'étape 2, encore masquée mais déjà montée. La graine de départ
  // est donc fixe (identique des deux côtés), puis un vrai hasard la remplace
  // dans un effet, qui ne s'exécute qu'après l'hydratation ; la `key` posée
  // sur <SelecteurAvatar> force son remontage pour recalculer l'avatar à
  // partir de cette nouvelle graine.
  const [grainePremierAvatar, setGrainePremierAvatar] = useState('sikaloc')

  // `Math.random()` au rendu donnerait deux valeurs différentes côté serveur
  // et côté client : c'est la correction de la divergence d'hydratation nº 418.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrainePremierAvatar(Math.random().toString(36).slice(2))
  }, [])

  // Une erreur renvoyée par le serveur porte toujours sur l'étape 1 : c'est là
  // que vivent tous les champs validés.
  const etapeVisible = etat.erreursChamps ? 1 : etape

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

      <div>
        <p className="text-caption font-semibold text-primary">
          Étape {etapeVisible} sur 2 ·{' '}
          {etapeVisible === 1 ? 'Vos informations' : 'Votre avatar'}
        </p>
        <div className="mt-xs flex gap-xs" aria-hidden="true">
          {[1, 2].map((numero) => (
            <span
              key={numero}
              className={`h-1 flex-1 rounded-pill transition-colors duration-300 ${
                numero <= etapeVisible ? 'bg-primary' : 'bg-hairline'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Étape 1 — informations personnelles ──────────────────────────── */}
      <div className={etapeVisible === 1 ? 'space-y-lg anim-apparait' : 'hidden'}>
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

        <ChampMotDePasse
          nom="motDePasse"
          libelle="Mot de passe"
          jauge
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

        <button
          type="button"
          onClick={() => setEtape(2)}
          className="btn btn-primary w-full"
        >
          Continuer
        </button>
      </div>

      {/* ── Étape 2 — avatar ─────────────────────────────────────────────── */}
      <div className={etapeVisible === 2 ? 'space-y-lg anim-apparait' : 'hidden'}>
        <div>
          <p className="field-label">Choisissez votre avatar</p>
          <p className="mb-lg text-caption text-mute">
            Il vous représentera dans l&apos;application. Vous pourrez en changer
            à tout moment depuis vos paramètres.
          </p>
          <SelecteurAvatar
            key={grainePremierAvatar}
            nom="avatar"
            identifiant={grainePremierAvatar}
            taille={96}
          />
        </div>

        <BoutonSoumettre pleineLargeur libelleEnCours="Création…">
          Créer mon compte
        </BoutonSoumettre>

        <button
          type="button"
          onClick={() => setEtape(1)}
          className="btn btn-secondary w-full"
        >
          Revenir à mes informations
        </button>
      </div>

      <input type="hidden" name="codeParrain" value={codeParrain ?? ''} />

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
      <div className="space-y-lg anim-apparait">
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

      <ChampMotDePasse
        nom="motDePasse"
        libelle="Nouveau mot de passe"
        jauge
        requis
        erreur={etat.erreursChamps?.motDePasse}
      />

      <ChampMotDePasse
        nom="confirmation"
        libelle="Confirmez le mot de passe"
        requis
        erreur={etat.erreursChamps?.confirmation}
      />

      <BoutonSoumettre pleineLargeur libelleEnCours="Enregistrement…">
        Enregistrer le nouveau mot de passe
      </BoutonSoumettre>
    </form>
  )
}
