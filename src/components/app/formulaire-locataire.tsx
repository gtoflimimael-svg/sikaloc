'use client'

import { useActionState } from 'react'

import { ActionsFormulaire, FormulaireMetier, SectionFormulaire } from '@/components/ui/formulaire-metier'
import { ChampTelephone } from '@/components/ui/champ-telephone'
import { ChampCase, ChampTexte } from '@/components/ui/champs'
import type { EtatFormulaire } from '@/lib/validation'
import type { Locataire } from '@/lib/types/database'

const ETAT_INITIAL: EtatFormulaire = {}

export function FormulaireLocataire({
  action,
  locataire,
}: {
  action: (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>
  locataire?: Locataire
}) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)
  const modification = Boolean(locataire)

  return (
    <FormulaireMetier action={envoyer} etat={etat} titre="Informations du locataire">

      <SectionFormulaire titre="Coordonnées du locataire">
        <ChampTexte
          nom="nom"
          libelle="Nom complet"
          placeholder="Awa Kponou"
          valeurDefaut={locataire?.nom}
          requis
          erreur={etat.erreursChamps?.nom}
        />

        <ChampTelephone
          nom="telephone"
          libelle="Téléphone"
          aide="Numéro béninois : saisissez les dix chiffres, sans répéter +229."
          valeurDefaut={locataire?.telephone}
          requis
          erreur={etat.erreursChamps?.telephone}
        />

        <ChampTexte
          nom="email"
          libelle="Email (facultatif)"
          aide="Nécessaire pour inviter le locataire sur Sikaloc_Me."
          type="email"
          placeholder="awa@exemple.bj"
          valeurDefaut={locataire?.email}
          erreur={etat.erreursChamps?.email}
        />

      </SectionFormulaire>
      {modification && locataire?.consentement_donnees ? (
        <div>
          <input type="hidden" name="consentement" value="true" />
          <p className="text-body-sm text-mute">
          Consentement à la collecte des données : attesté
          {locataire?.date_consentement ? ` le ${locataire.date_consentement}` : ''}.
          </p>
          {etat.erreursChamps?.consentement ? <p className="field-error" role="alert">{etat.erreursChamps.consentement}</p> : null}
        </div>
      ) : (
        <div className="tenant-consent">
        <ChampCase
          nom="consentement"
          libelle="J’ai informé ce locataire de la collecte de ses données"
          description="Obligatoire. Le locataire doit savoir que son nom et son numéro sont enregistrés dans Sikaloc, et peut demander leur suppression à tout moment."
          erreur={etat.erreursChamps?.consentement}
          apparence="separateur"
        />
        </div>
      )}

      <ActionsFormulaire annulerVers="/pro/locataires">
        {modification ? 'Enregistrer les modifications' : 'Créer le locataire'}
      </ActionsFormulaire>
    </FormulaireMetier>
  )
}
