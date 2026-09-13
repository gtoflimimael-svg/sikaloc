'use client'

import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import { definirMesNotifications } from '@/lib/actions/preferences-locataire'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Le réglage des emails, côté locataire.
 *
 * ─── Une case, pas un tableau de canaux ─────────────────────────────────────
 *
 * Sikaloc n'a qu'un canal : l'email. Proposer « SMS » ou « WhatsApp » à côté
 * ferait espérer des envois que rien n'achemine — et un réglage qui ne règle
 * rien est une promesse en trompe-l'œil. Les lignes reviendront le jour où un
 * fournisseur existera.
 */
export function FormulairePreferencesLocataire({ actif }: { actif: boolean }) {
  const [etat, action] = useActionState(definirMesNotifications, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-lg rounded-xl border border-hairline bg-canvas p-xl">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

      <label className="flex cursor-pointer items-start gap-md">
        <input
          type="checkbox"
          name="notifEmail"
          defaultChecked={actif}
          className="mt-xxs size-5 shrink-0 accent-[var(--primary)]"
        />
        <span>
          <span className="block text-body-md font-semibold text-ink">
            Recevoir les emails de Sikaloc
          </span>
          <span className="mt-xxs block text-body-sm text-mute">
            Vos quittances quand elles sont émises, et les rappels de loyer que
            votre bailleur vous adresse. Rien d’autre : Sikaloc ne vous envoie
            aucune publicité.
          </span>
        </span>
      </label>

      <BoutonSoumettre libelleEnCours="Enregistrement…">Enregistrer</BoutonSoumettre>

      {/*
        Dit explicitement, parce que c'est la question que se pose quelqu'un qui
        décoche : « est-ce que je perds l'accès à mes documents ? »
      */}
      <p className="border-t border-hairline pt-md text-body-sm text-mute">
        Vos quittances et vos loyers restent consultables ici quoi qu’il arrive.
        Ce réglage ne change que les emails.
      </p>
    </form>
  )
}
