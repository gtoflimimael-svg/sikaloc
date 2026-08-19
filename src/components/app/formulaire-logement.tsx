'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampSelection, ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
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
    <form action={envoyer} className="card card-lg space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

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
        aide="Le MVP couvre le Bénin : les mentions légales des quittances y sont adaptées."
        requis
        erreur={etat.erreursChamps?.pays}
      />

      <div className="flex flex-wrap gap-md pt-sm">
        <BoutonSoumettre libelleEnCours="Enregistrement…">
          {logement ? 'Enregistrer les modifications' : 'Créer le logement'}
        </BoutonSoumettre>
        <Link href="/app/logements" className="btn btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  )
}
