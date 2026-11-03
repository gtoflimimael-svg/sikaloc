'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Mail, MessageCircle } from 'lucide-react'

import {
  schemaQuestionVisiteur,
  SUJETS_QUESTIONS,
  type SujetQuestionVisiteur,
} from '@/lib/questions/validation'

type Canal = 'email' | 'whatsapp'

export function FormulaireQuestion() {
  const [canal, setCanal] = useState<Canal>('email')
  const [chargement, setChargement] = useState(false)
  const [recu, setRecu] = useState(false)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [erreurEnvoi, setErreurEnvoi] = useState('')
  const descriptionsCoordonnees = [
    erreurs.coordonnees ? 'coordonnees-erreur' : null,
    canal === 'whatsapp' ? 'coordonnees-aide' : null,
  ].filter(Boolean).join(' ') || undefined

  function effacerErreur(champ: string) {
    setErreurs((precedentes) => {
      if (!(champ in precedentes)) return precedentes
      const suivantes = { ...precedentes }
      delete suivantes[champ]
      return suivantes
    })
  }

  async function envoyer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (chargement) return

    const formulaire = event.currentTarget
    const donnees = new FormData(formulaire)
    const valeurSujet = String(donnees.get('sujet') ?? '') as SujetQuestionVisiteur
    const resultat = schemaQuestionVisiteur.safeParse({
      nom: donnees.get('nom'),
      sujet: valeurSujet,
      question: donnees.get('question'),
      canal,
      coordonnees: donnees.get('coordonnees'),
      consentement: donnees.get('consentement') === 'on',
    })

    if (!resultat.success) {
      const nouvellesErreurs: Record<string, string> = {}
      for (const issue of resultat.error.issues) {
        const champ = String(issue.path[0] ?? 'formulaire')
        if (!nouvellesErreurs[champ]) nouvellesErreurs[champ] = issue.message
      }
      setErreurs(nouvellesErreurs)
      setErreurEnvoi('')
      document.getElementById(Object.keys(nouvellesErreurs)[0])?.focus()
      return
    }

    setErreurs({})
    setErreurEnvoi('')
    setChargement(true)

    try {
      const reponse = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...resultat.data,
          site_web: donnees.get('site_web'),
        }),
      })
      const corps: unknown = await reponse.json().catch(() => null)

      if (!reponse.ok) {
        const message =
          typeof corps === 'object' && corps !== null && 'erreur' in corps &&
          typeof corps.erreur === 'string'
            ? corps.erreur
            : 'Votre question n’a pas pu être enregistrée. Réessayez dans un moment.'
        setErreurEnvoi(message)
        return
      }

      setRecu(true)
      formulaire.reset()
    } catch {
      setErreurEnvoi('Le service est momentanément indisponible. Votre question n’a pas été enregistrée.')
    } finally {
      setChargement(false)
    }
  }

  if (recu) {
    return (
      <section className="question-confirmation" aria-labelledby="question-confirmation-title" aria-live="polite">
        <span className="question-confirmation-mark" aria-hidden="true"><Check size={23} /></span>
        <p className="question-form-eyebrow">Message enregistré</p>
        <h2 id="question-confirmation-title">Votre question a bien été reçue.</h2>
        <p>Merci de nous avoir contactés. Notre équipe pourra vous répondre par le canal que vous avez choisi.</p>
        <Link href="/" className="question-back-link"><ArrowLeft size={17} aria-hidden="true" /> Retour à l&apos;accueil</Link>
      </section>
    )
  }

  return (
    <form className="question-form" onSubmit={envoyer} noValidate>
      <div className="question-form-grid">
        <div className="question-field">
          <label htmlFor="nom">Comment vous appelez-vous ?</label>
          <input id="nom" name="nom" type="text" autoComplete="name" maxLength={120} required onChange={() => effacerErreur('nom')} aria-invalid={Boolean(erreurs.nom)} aria-describedby={erreurs.nom ? 'nom-erreur' : undefined} />
          {erreurs.nom ? <p className="question-field-error" id="nom-erreur">{erreurs.nom}</p> : null}
        </div>

        <div className="question-field">
          <label htmlFor="sujet">Sujet de votre demande</label>
          <select id="sujet" name="sujet" defaultValue="" required onChange={() => effacerErreur('sujet')} aria-invalid={Boolean(erreurs.sujet)} aria-describedby={erreurs.sujet ? 'sujet-erreur' : undefined}>
            <option value="" disabled>Choisissez un sujet</option>
            {SUJETS_QUESTIONS.map(({ valeur, libelle }) => <option key={valeur} value={valeur}>{libelle}</option>)}
          </select>
          {erreurs.sujet ? <p className="question-field-error" id="sujet-erreur">{erreurs.sujet}</p> : null}
        </div>
      </div>

      <div className="question-field">
        <label htmlFor="question">Quelle est votre question ?</label>
        <textarea id="question" name="question" rows={5} maxLength={3000} placeholder="Décrivez votre question ici…" required onChange={() => effacerErreur('question')} aria-invalid={Boolean(erreurs.question)} aria-describedby={erreurs.question ? 'question-erreur question-compteur' : 'question-compteur'} />
        <div className="question-field-meta">
          {erreurs.question ? <p className="question-field-error" id="question-erreur">{erreurs.question}</p> : <span />}
          <span id="question-compteur">3 000 caractères maximum</span>
        </div>
      </div>

      <fieldset className="question-channel-fieldset">
        <legend>Comment souhaitez-vous recevoir notre réponse ?</legend>
        <div className="question-channel-options">
          <label className={`question-channel-option${canal === 'email' ? ' is-selected' : ''}`}>
            <input type="radio" name="canal" value="email" checked={canal === 'email'} onChange={() => { setCanal('email'); effacerErreur('coordonnees') }} />
            <Mail size={19} aria-hidden="true" />
            <span><strong>E-mail</strong><small>Une réponse dans votre boîte mail</small></span>
          </label>
          <label className={`question-channel-option${canal === 'whatsapp' ? ' is-selected' : ''}`}>
            <input type="radio" name="canal" value="whatsapp" checked={canal === 'whatsapp'} onChange={() => { setCanal('whatsapp'); effacerErreur('coordonnees') }} />
            <MessageCircle size={19} aria-hidden="true" />
            <span><strong>WhatsApp</strong><small>Sur le numéro que vous indiquez</small></span>
          </label>
        </div>
      </fieldset>

      <div className="question-field">
        <label htmlFor="coordonnees">{canal === 'email' ? 'Votre adresse e-mail' : 'Votre numéro WhatsApp'}</label>
        <input
          key={canal}
          id="coordonnees"
          name="coordonnees"
          type={canal === 'email' ? 'email' : 'tel'}
          autoComplete={canal === 'email' ? 'email' : 'tel'}
          placeholder={canal === 'email' ? 'vous@exemple.com' : '+229 01 00 00 00 00'}
          maxLength={254}
          required
          onChange={() => effacerErreur('coordonnees')}
          aria-invalid={Boolean(erreurs.coordonnees)}
          aria-describedby={descriptionsCoordonnees}
        />
        <div className="question-field-meta">
          {erreurs.coordonnees ? <p className="question-field-error" id="coordonnees-erreur">{erreurs.coordonnees}</p> : <span />}
          {canal === 'whatsapp' ? <span id="coordonnees-aide">Indicatif international accepté, par exemple +229 pour le Bénin.</span> : null}
        </div>
      </div>

      <label className="question-consent">
        <input id="consentement" type="checkbox" name="consentement" required onChange={() => effacerErreur('consentement')} aria-invalid={Boolean(erreurs.consentement)} aria-describedby={erreurs.consentement ? 'consentement-erreur' : undefined} />
        <span>J&apos;accepte que Sikaloc utilise les coordonnées fournies pour répondre à ma demande, conformément à sa <Link href="/legal/confidentialite">politique de confidentialité</Link>. Cette demande ne vous inscrit pas à une newsletter.</span>
      </label>
      {erreurs.consentement ? <p className="question-field-error question-consent-error" id="consentement-erreur">{erreurs.consentement}</p> : null}

      <div className="question-form-footer">
        <button className="btn btn-primary question-submit" type="submit" disabled={chargement}>
          {chargement ? 'Envoi en cours…' : 'Envoyer ma question'}
          {!chargement ? <ArrowRight size={17} aria-hidden="true" /> : null}
        </button>
        <p>Nous utiliserons uniquement le canal choisi pour vous répondre.</p>
      </div>

      <div className="question-form-honeypot" aria-hidden="true">
        <label htmlFor="site_web">Ne pas remplir ce champ</label>
        <input id="site_web" name="site_web" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="question-form-feedback" role="alert" aria-live="assertive">{erreurEnvoi}</p>
    </form>
  )
}
