'use client'

import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampMontant, ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import { LIBELLES_EQUIPEMENT } from '@/lib/annonces/libelles'
import { EQUIPEMENTS_ANNONCE, type Annonce } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Les informations d'une annonce.
 *
 * Rien n'y est marqué obligatoire au sens du navigateur : un brouillon
 * s'enregistre incomplet. Les champs qu'exige la publication le disent dans
 * leur aide, et c'est la base qui tranche au moment de publier.
 *
 * Le type de bien n'est pas modifiable ici : il vient du logement, recopié à la
 * création de l'annonce.
 */
export function FormulaireAnnonce({
  action,
  annonce,
}: {
  action: (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>
  annonce: Annonce
}) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)
  const exigeAPublication = 'Obligatoire pour publier.'

  return (
    <form action={envoyer} className="card card-lg space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

      <div className="grid gap-lg sm:grid-cols-2">
        <ChampTexte
          nom="ville"
          libelle="Ville"
          valeurDefaut={annonce.ville}
          requis
          erreur={etat.erreursChamps?.ville}
        />
        <ChampTexte
          nom="quartier"
          libelle="Quartier"
          placeholder="Fidjrossè"
          valeurDefaut={annonce.quartier}
          aide={`${exigeAPublication} L’adresse exacte n’est jamais publiée.`}
          erreur={etat.erreursChamps?.quartier}
        />
      </div>

      <div className="grid gap-lg sm:grid-cols-3">
        <ChampTexte
          nom="chambres"
          libelle="Chambres"
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          step={1}
          valeurDefaut={annonce.chambres}
          aide={`0 pour un entrer-coucher. ${exigeAPublication}`}
          erreur={etat.erreursChamps?.chambres}
        />
        <ChampTexte
          nom="surfaceM2"
          libelle="Surface (m²)"
          type="number"
          inputMode="numeric"
          min={5}
          max={2000}
          step={1}
          valeurDefaut={annonce.surface_m2}
          aide="Facultative."
          erreur={etat.erreursChamps?.surfaceM2}
        />
        <ChampTexte
          nom="disponibleLe"
          libelle="Disponible le"
          type="date"
          valeurDefaut={annonce.disponible_le}
          aide="Vide : disponible dès maintenant."
          erreur={etat.erreursChamps?.disponibleLe}
        />
      </div>

      <div className="grid gap-lg sm:grid-cols-2">
        <ChampMontant
          nom="loyer"
          libelle="Loyer mensuel"
          valeurDefaut={annonce.loyer}
          aide={exigeAPublication}
          erreur={etat.erreursChamps?.loyer}
        />
        <ChampMontant
          nom="charges"
          libelle="Charges mensuelles"
          valeurDefaut={annonce.charges}
          aide="Vide : non précisées. 0 : aucune."
          erreur={etat.erreursChamps?.charges}
        />
        <ChampMontant
          nom="depotGarantie"
          libelle="Caution"
          valeurDefaut={annonce.depot_garantie}
          aide="Le dépôt de garantie, en FCFA."
          erreur={etat.erreursChamps?.depotGarantie}
        />
        <ChampTexte
          nom="avanceMois"
          libelle="Avance (en mois de loyer)"
          type="number"
          inputMode="numeric"
          min={0}
          max={24}
          step={1}
          valeurDefaut={annonce.avance_mois}
          erreur={etat.erreursChamps?.avanceMois}
        />
      </div>

      <fieldset>
        <legend className="field-label">Équipements</legend>
        <div className="grid gap-sm sm:grid-cols-2">
          {EQUIPEMENTS_ANNONCE.map((equipement) => (
            <label
              key={equipement}
              className="flex cursor-pointer items-center gap-md rounded-md border border-hairline bg-canvas px-lg py-md"
            >
              <input
                type="checkbox"
                name="equipements"
                value={equipement}
                defaultChecked={annonce.equipements.includes(equipement)}
                className="size-5 shrink-0 accent-primary"
              />
              <span className="text-body-md text-ink">{LIBELLES_EQUIPEMENT[equipement]}</span>
            </label>
          ))}
        </div>
        {etat.erreursChamps?.equipements ? (
          <p className="field-error" role="alert">
            {etat.erreursChamps.equipements}
          </p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor="description" className="field-label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          minLength={20}
          maxLength={3000}
          defaultValue={annonce.description ?? ''}
          aria-invalid={etat.erreursChamps?.description ? true : undefined}
          placeholder="L’état du logement, ce qui l’entoure, ce qui est compris dans le loyer."
          className="input h-auto min-h-[160px]"
        />
        {etat.erreursChamps?.description ? (
          <p className="field-error" role="alert">
            {etat.erreursChamps.description}
          </p>
        ) : (
          <p className="field-hint">De 20 à 3 000 caractères. {exigeAPublication}</p>
        )}
      </div>

      <div className="pt-sm">
        <BoutonSoumettre libelleEnCours="Enregistrement…">Enregistrer</BoutonSoumettre>
      </div>
    </form>
  )
}
