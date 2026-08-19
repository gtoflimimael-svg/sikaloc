'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampMontant, ChampSelection, ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import { aujourdhuiISO, formaterFCFA, periodesRecentes } from '@/lib/format'
import { MODES_PAIEMENT, TYPES_PAIEMENT, type Paiement } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

export interface OptionBail {
  valeur: string
  libelle: string
  loyerMensuel: number
}

export function FormulairePaiement({
  action,
  baux,
  bailPreselectionne,
  paiement,
  libelleSoumission = 'Continuer vers la confirmation',
}: {
  action: (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>
  baux: OptionBail[]
  bailPreselectionne?: string
  paiement?: Paiement
  libelleSoumission?: string
}) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)

  const [bailChoisi, setBailChoisi] = useState(
    paiement?.bail_id ?? bailPreselectionne ?? baux[0]?.valeur ?? '',
  )

  const bail = baux.find((b) => b.valeur === bailChoisi)
  const periodes = periodesRecentes()

  if (baux.length === 0) {
    return (
      <div className="card card-lg space-y-lg">
        <Alerte ton="attention">
          Aucun bail actif. Créez un bail avant d’enregistrer un paiement.
        </Alerte>
        <Link href="/app/baux/nouveau" className="btn btn-primary">
          Créer un bail
        </Link>
      </div>
    )
  }

  return (
    <form
      action={envoyer}
      className="card card-lg space-y-lg"
      // Les champs restent non contrôlés (leur valeur vit dans le DOM) ; on
      // écoute la délégation d'événement au niveau du formulaire uniquement
      // pour rafraîchir le rappel de loyer quand le bail change.
      onChange={(evenement) => {
        const cible = evenement.target as HTMLInputElement | HTMLSelectElement
        if (cible.name === 'bailId') setBailChoisi(cible.value)
      }}
    >
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <ChampSelection
        nom="bailId"
        libelle="Bail concerné"
        options={baux.map(({ valeur, libelle }) => ({ valeur, libelle }))}
        valeurDefaut={bailChoisi}
        requis
        erreur={etat.erreursChamps?.bailId}
      />

      <ChampMontant
        // Le champ est non contrôlé : changer de bail doit le remonter pour
        // que le nouveau loyer devienne la valeur pré-remplie.
        key={`montant-${bailChoisi}`}
        nom="montant"
        libelle="Montant reçu"
        valeurDefaut={paiement?.montant ?? bail?.loyerMensuel}
        aide={
          bail
            ? `Loyer mensuel de ce bail : ${formaterFCFA(bail.loyerMensuel)}. Un montant inférieur produira un reçu et non une quittance.`
            : undefined
        }
        requis
        erreur={etat.erreursChamps?.montant}
      />

      <div className="grid gap-lg sm:grid-cols-2">
        <ChampSelection
          nom="periodeDebut"
          libelle="Mois de loyer concerné"
          options={periodes.map((p) => ({ valeur: p.valeur, libelle: p.libelle }))}
          valeurDefaut={paiement?.periode_debut ?? periodes[1]?.valeur ?? periodes[0]?.valeur}
          requis
          erreur={etat.erreursChamps?.periodeDebut}
        />
        <ChampTexte
          nom="datePaiement"
          libelle="Date du paiement"
          type="date"
          valeurDefaut={paiement?.date_paiement ?? aujourdhuiISO()}
          requis
          erreur={etat.erreursChamps?.datePaiement}
        />
      </div>

      <div className="grid gap-lg sm:grid-cols-2">
        <ChampSelection
          nom="modePaiement"
          libelle="Mode de paiement"
          options={MODES_PAIEMENT.map((m) => ({ valeur: m, libelle: m }))}
          valeurDefaut={paiement?.mode_paiement ?? 'Mobile Money'}
          requis
          erreur={etat.erreursChamps?.modePaiement}
        />
        <ChampSelection
          nom="typePaiement"
          libelle="Nature du paiement"
          options={TYPES_PAIEMENT.map((t) => ({ valeur: t, libelle: t }))}
          valeurDefaut={paiement?.type_paiement ?? 'Loyer'}
          requis
          erreur={etat.erreursChamps?.typePaiement}
        />
      </div>

      <div className="flex flex-wrap gap-md pt-sm">
        <BoutonSoumettre libelleEnCours="Enregistrement…">{libelleSoumission}</BoutonSoumettre>
        <Link href="/app/paiements" className="btn btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  )
}
