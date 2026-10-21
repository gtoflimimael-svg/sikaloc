'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampSelection } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Le choix du logement. Seuls ceux qui n'ont pas d'annonce en cours sont
 * proposés ; l'identité du bailleur n'est jamais envoyée — le serveur la tire
 * de la session.
 */
export function FormulaireNouvelleAnnonce({
  action,
  logements,
  selection,
}: {
  action: (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>
  logements: { valeur: string; libelle: string }[]
  selection?: string
}) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL)

  return (
    <form action={envoyer} className="card card-lg space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <ChampSelection
        nom="logementId"
        libelle="Logement"
        options={logements}
        valeurDefaut={selection}
        placeholder="Choisissez un logement"
        aide="L’annonce reprend son type et sa ville. Son adresse exacte n’est jamais publiée."
        requis
        erreur={etat.erreursChamps?.logementId}
      />

      <div className="flex flex-wrap gap-md pt-sm">
        <BoutonSoumettre libelleEnCours="Création…">Créer le brouillon</BoutonSoumettre>
        <Link href="/pro/annonces" className="btn btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  )
}
