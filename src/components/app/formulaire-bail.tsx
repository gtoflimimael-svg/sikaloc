'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampMontant, ChampSelection, ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import { aujourdhuiISO } from '@/lib/format'
import type { Bail } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

export interface OptionEntite {
  valeur: string
  libelle: string
}

export function FormulaireBail({
  action,
  bail,
  logements,
  locataires,
}: {
  action: (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>
  bail?: Bail
  logements: OptionEntite[]
  locataires: OptionEntite[]
}) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)

  // Garde-fou : les pages appelantes diagnostiquent le manque en amont (voir
  // `bail-impossible.tsx`) et n'affichent pas ce formulaire dans ce cas. Ce
  // repli n'existe donc que pour ne jamais rendre un <select> vide.
  if (logements.length === 0 || locataires.length === 0) {
    return (
      <div className="card card-lg space-y-lg anim-monte">
        <Alerte ton="attention">
          Un bail relie un logement à un locataire, et aucun couple disponible
          n’a pu être constitué pour le moment.
        </Alerte>

        <div className="flex flex-wrap gap-md">
          <Link href="/app/logements" className="btn btn-secondary">
            Voir mes logements
          </Link>
          <Link href="/app/locataires" className="btn btn-secondary">
            Voir mes locataires
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form action={envoyer} className="card card-lg space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <ChampSelection
        nom="logementId"
        libelle="Logement"
        placeholder="Sélectionnez un logement"
        options={logements}
        valeurDefaut={bail?.logement_id}
        requis
        erreur={etat.erreursChamps?.logementId}
      />

      <ChampSelection
        nom="locataireId"
        libelle="Locataire"
        placeholder="Sélectionnez un locataire"
        options={locataires}
        valeurDefaut={bail?.locataire_id}
        requis
        erreur={etat.erreursChamps?.locataireId}
      />

      <ChampMontant
        nom="loyerMensuel"
        libelle="Loyer mensuel"
        placeholder="60000"
        valeurDefaut={bail?.loyer_mensuel}
        requis
        erreur={etat.erreursChamps?.loyerMensuel}
      />

      <div className="grid gap-lg sm:grid-cols-2">
        <ChampTexte
          nom="dateDebut"
          libelle="Date de début"
          type="date"
          valeurDefaut={bail?.date_debut ?? aujourdhuiISO()}
          requis
          erreur={etat.erreursChamps?.dateDebut}
        />
        <ChampTexte
          nom="dateFin"
          libelle="Date de fin (facultatif)"
          type="date"
          aide="Laissez vide si le bail est à durée indéterminée."
          valeurDefaut={bail?.date_fin}
          erreur={etat.erreursChamps?.dateFin}
        />
      </div>

      <div className="grid gap-lg sm:grid-cols-2">
        <ChampTexte
          nom="jourEcheance"
          libelle="Jour d'échéance"
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          valeurDefaut={bail?.jour_echeance ?? 5}
          aide="Jour du mois où le loyer est dû."
          requis
          erreur={etat.erreursChamps?.jourEcheance}
        />
        <ChampTexte
          nom="toleranceJours"
          libelle="Tolérance (jours)"
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          valeurDefaut={bail?.tolerance_jours ?? 5}
          aide="Délai de grâce avant qu’un loyer ne soit déclaré impayé."
          requis
          erreur={etat.erreursChamps?.toleranceJours}
        />
      </div>

      <ChampMontant
        nom="depotGarantie"
        libelle="Dépôt de garantie (facultatif)"
        valeurDefaut={bail?.depot_garantie}
        erreur={etat.erreursChamps?.depotGarantie}
      />

      <div className="flex flex-wrap gap-md pt-sm">
        <BoutonSoumettre libelleEnCours="Enregistrement…">
          {bail ? 'Enregistrer les modifications' : 'Créer le bail'}
        </BoutonSoumettre>
        <Link href="/app/baux" className="btn btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  )
}
