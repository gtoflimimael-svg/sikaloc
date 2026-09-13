'use client'

import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampMotDePasse } from '@/components/ui/champ-mot-de-passe'
import { ChampTexte } from '@/components/ui/champs'
import { ChampTelephone } from '@/components/ui/champ-telephone'
import { Alerte } from '@/components/ui/retours'
import { rejoindreAvecInvitation, rattacherCompteConnecte } from '@/lib/actions/rejoindre'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Accepter une invitation — avec ou sans compte.
 *
 * ─── Trois cas, et un seul écran ────────────────────────────────────────────
 *
 *   connecté, même adresse   un bouton : le rattachement suffit
 *   connecté, autre adresse  on prévient avant de rattacher, parce que
 *                            l'invitation visait quelqu'un d'autre
 *   pas de compte            création, puis rattachement dans la foulée
 *
 * Le deuxième cas mérite un avertissement plutôt qu'un refus : un locataire
 * peut très bien avoir un compte Sikaloc sous une autre adresse que celle que
 * son bailleur connaît. Ce n'est pas une anomalie, c'est la vie courante.
 *
 * ─── L'adresse n'est pas modifiable ─────────────────────────────────────────
 *
 * Le compte se crée sur l'adresse à laquelle l'invitation a été envoyée, et
 * pas une autre. Laisser en changer permettrait de transférer un lien reçu par
 * erreur vers un compte qu'on contrôle — et d'accéder aux quittances de
 * quelqu'un d'autre.
 */
export function FormulaireAcceptation({
  jeton,
  email,
  nom,
  dejaConnecte,
  memeAdresse,
  emailConnecte,
}: {
  jeton: string
  email: string
  nom: string
  dejaConnecte: boolean
  memeAdresse: boolean
  emailConnecte: string | null
}) {
  const actionRattacher = rattacherCompteConnecte.bind(null, jeton)
  const [etatRattacher, rattacher] = useActionState(actionRattacher, ETAT_INITIAL)

  const actionRejoindre = rejoindreAvecInvitation.bind(null, jeton)
  const [etatRejoindre, rejoindre] = useActionState(actionRejoindre, ETAT_INITIAL)

  // ═══ Déjà connecté ═══════════════════════════════════════════════════════
  if (dejaConnecte) {
    return (
      <form action={rattacher} className="space-y-lg">
        {etatRattacher.erreur ? (
          <Alerte ton="erreur">{etatRattacher.erreur}</Alerte>
        ) : null}

        {!memeAdresse ? (
          <Alerte ton="attention">
            Vous êtes connecté avec <strong>{emailConnecte}</strong>, alors que
            cette invitation a été envoyée à <strong>{email}</strong>. Continuez
            seulement s’il s’agit bien de vous.
          </Alerte>
        ) : null}

        <BoutonSoumettre pleineLargeur libelleEnCours="Rattachement…">
          Accéder à mon espace
        </BoutonSoumettre>
      </form>
    )
  }

  // ═══ Création du compte ══════════════════════════════════════════════════
  return (
    <form action={rejoindre} className="space-y-lg">
      {etatRejoindre.erreur ? <Alerte ton="erreur">{etatRejoindre.erreur}</Alerte> : null}

      <ChampTexte
        nom="nom"
        libelle="Votre nom"
        autoComplete="name"
        valeurDefaut={nom}
        requis
        erreur={etatRejoindre.erreursChamps?.nom}
      />

      {/*
        L'adresse est affichée mais pas modifiable : le compte se crée sur
        celle de l'invitation. Un champ modifiable permettrait de détourner un
        lien reçu par erreur vers un compte qu'on contrôle.

        `readOnly` et non `disabled` : un champ désactivé n'est pas soumis, et
        les gestionnaires de mots de passe ne le lisent pas.
      */}
      <div>
        <label htmlFor="email" className="field-label">
          Adresse email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          readOnly
          className="input mt-sm w-full cursor-not-allowed text-mute"
        />
        <p className="field-hint">
          Celle à laquelle votre bailleur a envoyé l’invitation.
        </p>
      </div>

      <ChampTelephone
        nom="telephone"
        libelle="Votre téléphone"
        aide="Votre bailleur l’utilise déjà pour vous joindre."
        requis
        erreur={etatRejoindre.erreursChamps?.telephone}
      />

      <ChampMotDePasse
        nom="motDePasse"
        libelle="Choisissez un mot de passe"
        autoComplete="new-password"
        jauge
        requis
        contexteDepuis={['nom', 'email', 'telephone']}
        erreur={etatRejoindre.erreursChamps?.motDePasse}
      />

      <BoutonSoumettre pleineLargeur libelleEnCours="Création…">
        Créer mon compte et continuer
      </BoutonSoumettre>

      <p className="text-caption text-mute">
        En créant un compte, vous acceptez les conditions d’utilisation et la
        politique de confidentialité de Sikaloc.
      </p>
    </form>
  )
}
