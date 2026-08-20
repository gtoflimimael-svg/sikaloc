'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { CaptureSignature } from '@/components/app/capture-signature'
import { BoutonAction } from '@/components/ui/action-confirmee'
import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampMotDePasse } from '@/components/ui/champ-mot-de-passe'
import { ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import { SelecteurAvatar } from '@/components/ui/selecteur-avatar'
import { souscrire } from '@/lib/actions/abonnement'
import {
  changerMotDePasse,
  modifierAvatar,
  modifierPreferences,
  modifierProfil,
  supprimerSignature,
  televerserSignature,
} from '@/lib/actions/parametres'
import type { Bailleur } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Avatar — bloc autonome.
 *
 * Séparé des informations personnelles : ce sont deux gestes différents.
 * On change d'avatar par jeu, on corrige son numéro de téléphone parce qu'il
 * est faux sur les quittances ; les mélanger obligeait à réenregistrer l'un
 * pour toucher à l'autre.
 */
export function FormulaireAvatar({ bailleur }: { bailleur: Bailleur }) {
  const [etat, action] = useActionState(modifierAvatar, ETAT_INITIAL)

  return (
    <form action={action} className="card card-lg space-y-lg">
      <div>
        <h2 className="text-title-lg font-semibold text-ink">Votre avatar</h2>
        <p className="mt-xxs text-body-sm text-mute">
          Il vous représente dans l’application. Il n’apparaît pas sur vos
          quittances.
        </p>
      </div>

      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

      <SelecteurAvatar
        nom="avatar"
        identifiant={bailleur.id}
        valeurInitiale={bailleur.avatar}
        taille={96}
      />

      <BoutonSoumettre libelleEnCours="Enregistrement…">
        Enregistrer mon avatar
      </BoutonSoumettre>
    </form>
  )
}

export function FormulaireProfil({ bailleur }: { bailleur: Bailleur }) {
  const [etat, action] = useActionState(modifierProfil, ETAT_INITIAL)

  return (
    <form action={action} className="card card-lg space-y-lg">
      <div>
        <h2 className="text-title-lg font-semibold text-ink">
          Vos informations personnelles
        </h2>
        <p className="mt-xxs text-body-sm text-mute">
          Elles figurent dans le bloc bailleur de chaque quittance.
        </p>
      </div>

      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

      <ChampTexte
        nom="nom"
        libelle="Nom complet"
        valeurDefaut={bailleur.nom}
        aide="Apparaît sur toutes vos quittances."
        requis
        erreur={etat.erreursChamps?.nom}
      />

      <ChampTexte
        nom="telephone"
        libelle="Téléphone"
        type="tel"
        inputMode="tel"
        valeurDefaut={bailleur.telephone}
        requis
        erreur={etat.erreursChamps?.telephone}
      />

      <ChampTexte
        nom="adresse"
        libelle="Adresse (facultatif)"
        valeurDefaut={bailleur.adresse}
        aide="Si renseignée, elle figure dans le bloc bailleur des quittances."
        erreur={etat.erreursChamps?.adresse}
      />

      <div className="rounded-md bg-canvas-soft px-lg py-md">
        <p className="text-body-sm text-mute">
          Adresse email : <strong className="text-ink">{bailleur.email}</strong>
        </p>
        <p className="mt-xxs text-caption text-mute">
          L&apos;email sert d&apos;identifiant de connexion et ne peut pas être
          modifié depuis cet écran.
        </p>
      </div>

      <BoutonSoumettre libelleEnCours="Enregistrement…">
        Enregistrer mes informations
      </BoutonSoumettre>
    </form>
  )
}

export function FormulaireSignature({ signatureExistante }: { signatureExistante: boolean }) {
  const [etat, action] = useActionState(televerserSignature, ETAT_INITIAL)

  return (
    <div className="space-y-lg">
      <form action={action} className="card card-lg space-y-lg">
        {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
        {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

        <CaptureSignature />
      </form>

      {signatureExistante ? (
        <BoutonAction
          action={supprimerSignature}
          libelle="Supprimer ma signature"
          libelleEnCours="Suppression…"
          variante="secondary"
          compact
        />
      ) : null}
    </div>
  )
}

export function FormulairePreferences({ bailleur }: { bailleur: Bailleur }) {
  const [etat, action] = useActionState(modifierPreferences, ETAT_INITIAL)

  return (
    <form action={action} className="card card-lg space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

      <Bascule
        nom="notifEmail"
        libelle="Recevoir les rappels par email"
        description="Échéances à venir, loyers en retard, expiration de l’abonnement."
        parDefaut={bailleur.notif_email}
      />

      <Bascule
        nom="notifWhatsApp"
        libelle="Proposer les relances WhatsApp"
        description="Affiche le bouton de relance sur chaque impayé. L’envoi reste manuel."
        parDefaut={bailleur.notif_whatsapp}
      />

      <BoutonSoumettre libelleEnCours="Enregistrement…">
        Enregistrer les préférences
      </BoutonSoumettre>
    </form>
  )
}

function Bascule({
  nom,
  libelle,
  description,
  parDefaut,
}: {
  nom: string
  libelle: string
  description: string
  parDefaut: boolean
}) {
  return (
    <label
      htmlFor={nom}
      className="flex cursor-pointer items-start gap-md rounded-md border border-hairline p-lg transition-colors hover:bg-surface-soft"
    >
      <input
        id={nom}
        name={nom}
        type="checkbox"
        defaultChecked={parDefaut}
        className="mt-xxs size-5 shrink-0 accent-primary"
      />
      <span>
        <span className="block text-body-md font-semibold text-ink">{libelle}</span>
        <span className="mt-xxs block text-body-sm text-mute">{description}</span>
      </span>
    </label>
  )
}

/**
 * Changement de mot de passe.
 *
 * Le mot de passe actuel est exigé, et l'oubli renvoie vers l'envoi d'un lien
 * par email : c'est le seul chemin qui ne suppose pas qu'une session ouverte
 * appartient forcément au titulaire du compte.
 */
export function FormulaireMotDePasse() {
  const [etat, action] = useActionState(changerMotDePasse, ETAT_INITIAL)

  return (
    <form action={action} className="card card-lg space-y-lg">
      <div>
        <h2 className="text-title-lg font-semibold text-ink">Mot de passe</h2>
        <p className="mt-xxs text-body-sm text-mute">
          Il protège l’accès à vos baux, vos paiements et vos quittances.
        </p>
      </div>

      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

      <ChampMotDePasse
        nom="motDePasseActuel"
        libelle="Mot de passe actuel"
        autoComplete="current-password"
        requis
        erreur={etat.erreursChamps?.motDePasseActuel}
      />

      <p className="-mt-xs text-caption text-mute">
        Vous ne vous en souvenez plus ?{' '}
        <Link href="/mot-de-passe-oublie" className="font-semibold text-ink underline">
          Recevez un lien par email
        </Link>{' '}
        — c’est la seule façon sûre de reprendre la main sur un compte.
      </p>

      <ChampMotDePasse
        nom="motDePasse"
        libelle="Nouveau mot de passe"
        jauge
        requis
        erreur={etat.erreursChamps?.motDePasse}
      />

      <ChampMotDePasse
        nom="confirmation"
        libelle="Confirmez le nouveau mot de passe"
        requis
        erreur={etat.erreursChamps?.confirmation}
      />

      <BoutonSoumettre libelleEnCours="Mise à jour…">
        Changer le mot de passe
      </BoutonSoumettre>
    </form>
  )
}

export function BoutonSouscription() {
  const [etat, action] = useActionState(souscrire, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-md">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      <BoutonSoumettre libelleEnCours="Ouverture du guichet…">
        Payer par Mobile Money
      </BoutonSoumettre>
    </form>
  )
}

/** Copie du lien de parrainage — `navigator.clipboard` exige le client. */
export function LienParrainageCopiable({ lien }: { lien: string }) {
  const [copie, setCopie] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-sm">
      <code className="min-w-0 flex-1 truncate rounded-md border border-hairline bg-canvas-soft px-lg py-md text-body-sm text-ink">
        {lien}
      </code>
      <button
        type="button"
        className="btn btn-tertiary btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(lien)
            setCopie(true)
            setTimeout(() => setCopie(false), 2000)
          } catch {
            // Presse-papiers refusé (contexte non sécurisé) : le lien reste
            // sélectionnable à la main, on n'a rien de plus à proposer.
          }
        }}
      >
        {copie ? 'Copié' : 'Copier'}
      </button>
    </div>
  )
}
