'use client'

import { useActionState, useState } from 'react'

import { SelecteurAvatar } from '@/components/ui/selecteur-avatar'
import { BoutonAction } from '@/components/ui/action-confirmee'
import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import { souscrire } from '@/lib/actions/abonnement'
import {
  changerMotDePasse,
  modifierPreferences,
  modifierProfil,
  supprimerSignature,
  televerserSignature,
} from '@/lib/actions/parametres'
import type { Bailleur } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

export function FormulaireProfil({ bailleur }: { bailleur: Bailleur }) {
  const [etat, action] = useActionState(modifierProfil, ETAT_INITIAL)

  return (
    <form action={action} className="card card-lg space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

      <div className="rounded-lg border border-hairline bg-surface-soft p-lg">
        <p className="field-label">Votre avatar</p>
        <SelecteurAvatar
          nom="avatar"
          identifiant={bailleur.id}
          valeurInitiale={bailleur.avatar}
          taille={96}
        />
      </div>

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
        Enregistrer le profil
      </BoutonSoumettre>
    </form>
  )
}

export function FormulaireSignature({ signatureExistante }: { signatureExistante: boolean }) {
  const [etat, action] = useActionState(televerserSignature, ETAT_INITIAL)
  const [nomFichier, setNomFichier] = useState<string | null>(null)

  return (
    <div className="space-y-lg">
      <form action={action} className="card card-lg space-y-lg">
        {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
        {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

        <div>
          <label htmlFor="signature" className="field-label">
            Image de votre signature
          </label>
          <input
            id="signature"
            name="signature"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            onChange={(e) => setNomFichier(e.target.files?.[0]?.name ?? null)}
            className="block w-full text-body-sm text-body file:mr-lg file:rounded-xl file:border-0 file:bg-canvas-soft file:px-lg file:py-md file:text-body-sm file:font-semibold file:text-ink hover:file:bg-surface-elevated"
          />
          <p className="field-hint">
            PNG, JPEG ou WebP, 2 Mo maximum. Une signature sur fond blanc ou
            transparent donne le meilleur rendu à l&apos;impression.
          </p>
          {nomFichier ? (
            <p className="mt-xs text-body-sm font-semibold text-ink">{nomFichier}</p>
          ) : null}
        </div>

        <BoutonSoumettre libelleEnCours="Téléversement…">
          {signatureExistante ? 'Remplacer la signature' : 'Enregistrer la signature'}
        </BoutonSoumettre>
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
      className="flex cursor-pointer items-start gap-md rounded-md border border-hairline p-lg"
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

export function FormulaireMotDePasse() {
  const [etat, action] = useActionState(changerMotDePasse, ETAT_INITIAL)

  return (
    <form action={action} className="card card-lg space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

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
