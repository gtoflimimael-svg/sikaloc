'use client'

import { useActionState } from 'react'

import { ActionsFormulaire, FormulaireMetier, SectionFormulaire } from '@/components/ui/formulaire-metier'
import { ChampSelection, ChampTexte } from '@/components/ui/champs'
import { TYPES_LOGEMENT, type Logement } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

export function FormulaireLogement({
  action,
  logement,
}: {
  action: (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>
  logement?: Logement
}) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)

  return (
    <FormulaireMetier action={envoyer} etat={etat} titre="Informations du logement">
      <SectionFormulaire titre="Adresse et type de bien">
        <ChampTexte
          nom="adresse"
          libelle="Adresse complète"
          placeholder="Lot 42, Quartier Fidjrossè"
          aide="Elle apparaîtra telle quelle sur les quittances."
          valeurDefaut={logement?.adresse}
          requis
          erreur={etat.erreursChamps?.adresse}
        />

        <div className="grid gap-lg sm:grid-cols-2">
          <ChampTexte
            nom="ville"
            libelle="Ville"
            placeholder="Cotonou"
            valeurDefaut={logement?.ville}
            requis
            erreur={etat.erreursChamps?.ville}
          />
          <ChampSelection
            nom="type"
            libelle="Type de bien"
            valeurDefaut={logement?.type ?? 'Appartement'}
            options={TYPES_LOGEMENT.map((t) => ({ valeur: t, libelle: t }))}
            requis
            erreur={etat.erreursChamps?.type}
          />
        </div>

        <ChampTexte
          nom="pays"
          libelle="Pays"
          valeurDefaut={logement?.pays ?? 'Bénin'}
          aide="Le pays est utilisé dans les mentions de vos quittances."
          requis
          erreur={etat.erreursChamps?.pays}
        />

      </SectionFormulaire>
      <ActionsFormulaire annulerVers="/pro/logements">
        {logement ? 'Enregistrer les modifications' : 'Créer le logement'}
      </ActionsFormulaire>
    </FormulaireMetier>
  )
}
