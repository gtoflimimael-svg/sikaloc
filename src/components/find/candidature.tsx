'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { ChampTexte } from '@/components/ui/champs'
import { ChampMotDePasse } from '@/components/ui/champ-mot-de-passe'
import { ChampTelephone } from '@/components/ui/champ-telephone'
import { Alerte, Badge } from '@/components/ui/retours'
import type { CanalTelephone } from '@/lib/verification/regles'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

type Action = (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>

function useFocusErreur(etat: EtatFormulaire) {
  const formulaire = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (!etat.erreur && !Object.keys(etat.erreursChamps ?? {}).length) return
    const cible = formulaire.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? formulaire.current?.querySelector<HTMLElement>('[role="alert"]')
    if (cible) { if (!cible.hasAttribute('aria-invalid')) cible.tabIndex = -1; cible.focus() }
  }, [etat])
  return formulaire
}

/**
 * Se souvenir de ce qui a été tapé, malgré la remise à zéro de React.
 *
 * React réinitialise un formulaire dès que son action est revenue. Les champs
 * qui tiennent leur propre état — téléphone, mot de passe — y survivent ; un
 * `<input>` ordinaire, non. Le nom, l'adresse et surtout le message écrit au
 * bailleur disparaissaient donc à chaque refus du serveur, c'est-à-dire
 * précisément au moment où il faut recommencer.
 *
 * On écoute le formulaire entier — les événements remontent — et on renvoie la
 * valeur retenue en `valeurDefaut` : la remise à zéro repose alors sur ce qui a
 * été tapé, et non sur du vide.
 */
function useMemoireChamps<C extends string>(champs: readonly C[]) {
  const [valeurs, setValeurs] = useState<Partial<Record<C, string>>>({})
  const retenir = (evenement: FormEvent<HTMLFormElement>) => {
    const cible = evenement.target as HTMLInputElement | HTMLTextAreaElement
    if ((champs as readonly string[]).includes(cible.name)) {
      setValeurs((precedentes) => ({ ...precedentes, [cible.name]: cible.value }))
    }
  }
  return [valeurs, retenir] as const
}

/**
 * Les trois formulaires du parcours candidat : créer son compte, compléter son
 * profil, écrire au bailleur. Chacun est court parce qu'il n'y a rien d'autre
 * à demander — ni adresse, ni pièce d'identité, ni revenus.
 */

export function FormulaireInscriptionCandidat({
  action,
  connexion,
}: {
  action: Action
  /** Où va quelqu'un qui a déjà un compte, avec le retour vers l'annonce. */
  connexion: string
}) {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL)
  const formulaire = useFocusErreur(etat)
  const [saisi, retenir] = useMemoireChamps(['nom', 'email'] as const)

  return (
    <form ref={formulaire} action={envoyer} onChange={retenir} className="space-y-lg" aria-busy={enCours} onReset={e => e.preventDefault()}>
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <ChampTexte
        nom="nom"
        libelle="Votre nom"
        valeurDefaut={saisi.nom}
        requis
        autoComplete="name"
        erreur={etat.erreursChamps?.nom}
      />
      <ChampTexte
        nom="email"
        valeurDefaut={saisi.email}
        libelle="Votre email"
        type="email"
        inputMode="email"
        autoComplete="email"
        aide="Elle sert à confirmer votre compte. Le bailleur ne la reçoit pas."
        requis
        erreur={etat.erreursChamps?.email}
      />
      <ChampTelephone nom="telephone" libelle="Votre téléphone" requis erreur={etat.erreursChamps?.telephone} />
      <ChampMotDePasse
        nom="motDePasse"
        libelle="Mot de passe"
        jauge
        requis
        erreur={etat.erreursChamps?.motDePasse}
      />

      <BoutonSoumettre libelleEnCours="Création…">Créer mon compte</BoutonSoumettre>

      <p className="text-center text-body-sm text-mute">
        Vous avez déjà un compte ?{' '}
        <Link href={connexion} className="font-semibold text-ink underline">
          Se connecter
        </Link>
      </p>
    </form>
  )
}

export function FormulaireProfilCandidat({
  action,
  nom,
  telephone,
  notifWhatsApp,
  libelleSoumission = 'Enregistrer et continuer',
}: {
  action: Action
  nom?: string
  telephone?: string
  /** Le candidat a-t-il déjà accepté d'être prévenu par WhatsApp ? */
  notifWhatsApp?: boolean
  libelleSoumission?: string
}) {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL)
  const formulaire = useFocusErreur(etat)

  return (
    <form ref={formulaire} action={envoyer} className="space-y-lg" aria-label="Mon profil candidat" aria-busy={enCours} onReset={e => e.preventDefault()}>
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

      <ChampTexte nom="nom" libelle="Votre nom" valeurDefaut={nom} requis autoComplete="name" erreur={etat.erreursChamps?.nom} />
      <ChampTelephone
        nom="telephone"
        libelle="Votre téléphone"
        valeurDefaut={telephone}
        requis
        erreur={etat.erreursChamps?.telephone}
      />

      <p className="text-body-sm text-mute">
        Votre numéro ne sera pas transmis au bailleur. Il sert à vous joindre si Sikaloc en a besoin.
      </p>

      {/*
        Opt-in explicite : coché, il vaut consentement à recevoir un WhatsApp
        quand un bailleur répond. Décoché par défaut — on ne suppose jamais un
        accord qui n'a pas été donné.
      */}
      <label className="flex items-start gap-sm text-body-sm text-body">
        <input
          type="checkbox"
          name="notifWhatsApp"
          defaultChecked={notifWhatsApp ?? false}
          disabled={enCours}
          className="mt-xxs size-5 shrink-0 accent-primary"
        />
        <span>Me prévenir par WhatsApp quand un bailleur répond à ma candidature.</span>
      </label>

      <BoutonSoumettre libelleEnCours="Enregistrement…">{libelleSoumission}</BoutonSoumettre>
    </form>
  )
}

export function FormulaireMessageCandidature({ action }: { action: Action }) {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL)
  const formulaire = useFocusErreur(etat)
  const [saisi, retenir] = useMemoireChamps(['message'] as const)

  return (
    <form ref={formulaire} action={envoyer} onChange={retenir} className="space-y-lg" aria-busy={enCours} onReset={e => e.preventDefault()}>
      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}

      <div>
        <label htmlFor="message" className="field-label">
          Votre message au bailleur (facultatif)
        </label>
        <textarea
          id="message"
          name="message"
          disabled={enCours}
          aria-describedby={etat.erreursChamps?.message ? 'message-erreur' : 'message-aide'}
          rows={5}
          maxLength={1000}
          defaultValue={saisi.message}
          placeholder="Qui vous êtes, quand vous souhaitez emménager, ce que vous voulez savoir."
          aria-invalid={etat.erreursChamps?.message ? true : undefined}
          className="input h-auto min-h-[140px]"
        />
        {etat.erreursChamps?.message ? (
          <p id="message-erreur" className="field-error" role="alert">
            {etat.erreursChamps.message}
          </p>
        ) : (
          <p id="message-aide" className="field-hint">1 000 caractères au plus.</p>
        )}
      </div>

      <BoutonSoumettre libelleEnCours="Envoi…">Envoyer ma candidature</BoutonSoumettre>
    </form>
  )
}

/**
 * La vérification du téléphone du candidat (S8-G).
 *
 * Le candidat voit son numéro, s'il est vérifié, et pourquoi cela compte : sans
 * vérification, aucune notification WhatsApp ne lui parviendra. Deux gestes :
 * demander un code (par SMS ou WhatsApp), puis le saisir.
 *
 * Le compte à rebours et le choix du canal ne sont qu'une politesse d'écran —
 * le serveur applique seul les limites (dix minutes, cinq essais, cinq
 * demandes par heure). Tant qu'aucun canal n'est configuré, la demande répond
 * franchement « indisponible », comme pour le bailleur.
 */
export function VerificationTelephoneCandidat({
  telephone,
  verifie,
  demander,
  verifier,
  canaux,
}: {
  telephone: string
  verifie: boolean
  demander: Action
  verifier: Action
  canaux: CanalTelephone[]
}) {
  const [etatDemande, envoyerDemande, enCoursDemande] = useActionState(demander, ETAT_INITIAL)
  const [etatCode, envoyerCode] = useActionState(verifier, ETAT_INITIAL)

  if (verifie) {
    return (
      <div className="flex flex-wrap items-center gap-md">
        <span className="text-body-md text-ink">{telephone}</span>
        <Badge ton="positive">Numéro vérifié</Badge>
      </div>
    )
  }

  if (canaux.length === 0) {
    return <Alerte ton="attention">La vérification par SMS et WhatsApp est indisponible pour le moment. Vous pouvez consulter vos candidatures ici ; aucune notification WhatsApp n’est promise.</Alerte>
  }

  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap items-center gap-md">
        <span className="text-body-md text-ink">{telephone}</span>
        <Badge ton="neutral">Non vérifié</Badge>
      </div>

      <p className="text-body-sm text-mute">
        Vérifiez votre numéro pour pouvoir être prévenu par WhatsApp quand un bailleur répond à
        votre candidature.
      </p>

      {etatDemande.erreur ? <Alerte ton="erreur">{etatDemande.erreur}</Alerte> : null}
      {etatDemande.succes ? <Alerte ton="succes">{etatDemande.succes}</Alerte> : null}

      {/*
        Deux boutons, un par canal : chacun soumet le même formulaire avec sa
        valeur. Le serveur décide si le canal est disponible.
      */}
      <form action={envoyerDemande} className="flex flex-wrap gap-sm" aria-busy={enCoursDemande}>
        {canaux.includes('SMS') ? <button type="submit" disabled={enCoursDemande} name="canal" value="SMS" className="btn btn-secondary btn-sm">
          Recevoir un code par SMS
        </button> : null}
        {canaux.includes('WHATSAPP') ? <button type="submit" disabled={enCoursDemande} name="canal" value="WHATSAPP" className="btn btn-secondary btn-sm">
          Recevoir un code par WhatsApp
        </button> : null}
      </form>

      <form action={envoyerCode} className="space-y-md">
        <div>
          <label htmlFor="code-candidat" className="field-label">
            Code reçu à six chiffres
          </label>
          <input
            id="code-candidat"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-invalid={etatCode.erreursChamps?.code ? true : undefined}
            aria-describedby={etatCode.erreursChamps?.code ? 'code-candidat-erreur' : 'code-candidat-aide'}
            className="input tracking-[0.4em]"
          />
          {etatCode.erreursChamps?.code ? (
            <p id="code-candidat-erreur" className="field-error" role="alert">
              {etatCode.erreursChamps.code}
            </p>
          ) : (
            <p id="code-candidat-aide" className="field-hint">Le code expire dix minutes après son envoi.</p>
          )}
        </div>
        {etatCode.succes ? <Alerte ton="succes">{etatCode.succes}</Alerte> : null}
        {etatCode.erreur ? <Alerte ton="erreur">{etatCode.erreur}</Alerte> : null}
        <BoutonSoumettre libelleEnCours="Vérification…">Vérifier mon numéro</BoutonSoumettre>
      </form>
    </div>
  )
}
