'use client'

import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import { demanderLeGuide } from '@/lib/actions/guide'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Demande du guide, sur la page d'accueil.
 *
 * L'adresse saisie ne reçoit rien d'autre qu'une demande de confirmation. Tant
 * que le lien n'est pas cliqué, le guide ne part pas — sans quoi n'importe qui
 * pourrait faire envoyer du courrier à l'adresse d'un tiers.
 */
export function FormulaireGuide() {
  const [etat, action] = useActionState(demanderLeGuide, ETAT_INITIAL)

  if (etat.succes) {
    return (
      <div className="anim-monte rounded-lg border border-hairline bg-canvas p-lg">
        <p className="text-body-md font-semibold text-ink">Vérifiez votre boîte mail</p>
        <p className="mt-sm text-body-sm text-body">{etat.succes}</p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-md">
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      {/*
        Piège à robots. `hidden` le retire de l'affichage ET du parcours au
        clavier ; `tabIndex={-1}` et `autoComplete="off"` empêchent qu'un
        gestionnaire de mots de passe ne le remplisse à la place de l'humain.
      */}
      <div hidden aria-hidden="true">
        <label htmlFor="guide-site">Ne remplissez pas ce champ</label>
        <input id="guide-site" type="text" name="site" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-sm sm:flex-row">
        <div className="flex-1">
          <label htmlFor="guide-email" className="sr-only">
            Votre adresse email
          </label>
          <input
            id="guide-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="votre@email.com"
            aria-describedby={etat.erreursChamps?.email ? 'guide-email-erreur' : undefined}
            aria-invalid={etat.erreursChamps?.email ? true : undefined}
            className="input w-full"
          />
        </div>

        <BoutonSoumettre libelleEnCours="Envoi…">Recevoir le guide</BoutonSoumettre>
      </div>

      {etat.erreursChamps?.email ? (
        <p id="guide-email-erreur" className="field-error" role="alert">
          {etat.erreursChamps.email}
        </p>
      ) : null}

      <p className="text-caption text-mute">
        Un email de confirmation, puis le guide. Rien d’autre sans votre accord, et
        un lien de désinscription dans chaque message.
      </p>
    </form>
  )
}
