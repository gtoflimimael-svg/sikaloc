'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'

import { SelecteurAvatar } from '@/components/ui/selecteur-avatar'
import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampCase, ChampTexte } from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
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
  // Amorce figée : un locataire pas encore créé n'a pas d'identifiant. Fixe le
  // temps de l'hydratation (`Math.random()` y donnerait une valeur différente
  // au rendu serveur et au premier rendu client — mésappariement d'hydratation,
  // voir le même correctif dans `formulaires.tsx`), puis remplacée par un vrai
  // hasard une fois montée ; la `key` sur <SelecteurAvatar> le fait recalculer
  // l'avatar à partir de cette nouvelle graine.
  const [grainePremierAvatar, setGrainePremierAvatar] = useState('sikaloc')

  // `Math.random()` au rendu donnerait deux valeurs différentes côté serveur
  // et côté client : c'est la correction de la divergence d'hydratation nº 418.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!locataire) setGrainePremierAvatar(Math.random().toString(36).slice(2))
  }, [locataire])

  return (
    <form action={envoyer} className="card card-lg space-y-lg">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <div className="rounded-lg border border-hairline bg-surface-soft p-lg">
        <p className="field-label">Avatar du locataire</p>
        <p className="mb-lg text-caption text-mute">
          Un visage aide à repérer un locataire d&apos;un coup d&apos;œil dans
          vos listes.
        </p>
        <SelecteurAvatar
          key={locataire?.id ?? grainePremierAvatar}
          nom="avatar"
          identifiant={locataire?.id ?? grainePremierAvatar}
          valeurInitiale={locataire?.avatar}
          taille={88}
        />
      </div>

      <ChampTexte
        nom="nom"
        libelle="Nom complet"
        placeholder="Awa Kponou"
        valeurDefaut={locataire?.nom}
        requis
        erreur={etat.erreursChamps?.nom}
      />

      <ChampTexte
        nom="telephone"
        libelle="Téléphone"
        type="tel"
        inputMode="tel"
        placeholder="+229 97 00 00 00"
        aide="Utilisé pour l’envoi des quittances et les relances WhatsApp."
        valeurDefaut={locataire?.telephone}
        requis
        erreur={etat.erreursChamps?.telephone}
      />

      <ChampTexte
        nom="email"
        libelle="Email (facultatif)"
        type="email"
        placeholder="awa@exemple.bj"
        valeurDefaut={locataire?.email}
        erreur={etat.erreursChamps?.email}
      />

      {modification ? (
        <p className="text-body-sm text-mute">
          Consentement à la collecte des données : attesté
          {locataire?.date_consentement ? ` le ${locataire.date_consentement}` : ''}.
        </p>
      ) : (
        <ChampCase
          nom="consentement"
          libelle="J’ai informé ce locataire de la collecte de ses données"
          description="Obligatoire. Le locataire doit savoir que son nom et son numéro sont enregistrés dans Sikaloc, et peut demander leur suppression à tout moment."
          erreur={etat.erreursChamps?.consentement}
        />
      )}

      <div className="flex flex-wrap gap-md pt-sm">
        <BoutonSoumettre libelleEnCours="Enregistrement…">
          {modification ? 'Enregistrer les modifications' : 'Créer le locataire'}
        </BoutonSoumettre>
        <Link href="/app/locataires" className="btn btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  )
}
