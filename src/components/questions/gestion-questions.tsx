'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Mail, MessageCircle, Trash2 } from 'lucide-react'

import { libelleSujetQuestion } from '@/lib/questions/validation'
import type { QuestionVisiteur } from '@/lib/types/database'

type Filtre = 'toutes' | 'nouvelle' | 'en_cours' | 'repondue'

const LIBELLES_STATUTS: Record<Filtre, string> = {
  toutes: 'Toutes',
  nouvelle: 'Nouvelles',
  en_cours: 'En cours',
  repondue: 'Répondues',
}

const LIBELLES_STATUT_UNITAIRE: Record<QuestionVisiteur['statut'], string> = {
  nouvelle: 'Nouvelle',
  en_cours: 'En cours',
  repondue: 'Répondue',
}

const DATE = new Intl.DateTimeFormat('fr-BJ', { dateStyle: 'medium', timeStyle: 'short' })

function lienReponse(question: QuestionVisiteur): string {
  if (question.canal_reponse === 'email') {
    const adresse = encodeURIComponent(question.coordonnees).replace('%40', '@')
    const sujet = encodeURIComponent('Votre question à Sikaloc')
    const corps = encodeURIComponent(`Bonjour ${question.nom},\n\nNous revenons vers vous au sujet de votre question adressée à Sikaloc.\n\n`)
    return `mailto:${adresse}?subject=${sujet}&body=${corps}`
  }

  const numero = question.coordonnees.replace(/\D/g, '')
  const message = encodeURIComponent(`Bonjour ${question.nom}, nous revenons vers vous au sujet de votre question adressée à Sikaloc.`)
  return `https://wa.me/${numero}?text=${message}`
}

export function GestionQuestions({ questions, filtre }: { questions: QuestionVisiteur[]; filtre: Filtre }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState<string | null>(null)
  const [retour, setRetour] = useState('')
  const [erreur, setErreur] = useState('')

  async function changerStatut(question: QuestionVisiteur) {
    const prochain = question.statut === 'nouvelle'
      ? 'en_cours'
      : question.statut === 'en_cours' ? 'repondue' : 'en_cours'

    setEnCours(question.id)
    setErreur('')
    setRetour('')
    try {
      const reponse = await fetch(`/api/questions/gestion/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: prochain }),
      })
      if (!reponse.ok) throw new Error('update')
      setRetour(`Statut modifié : ${LIBELLES_STATUT_UNITAIRE[prochain]}.`)
      router.refresh()
    } catch {
      setErreur('Le statut n’a pas pu être modifié. Réessayez.')
    } finally {
      setEnCours(null)
    }
  }

  async function supprimer(question: QuestionVisiteur) {
    if (!window.confirm('Supprimer définitivement cette demande ? Cette action est irréversible.')) return
    setEnCours(question.id)
    setErreur('')
    setRetour('')
    try {
      const reponse = await fetch(`/api/questions/gestion/${question.id}`, { method: 'DELETE' })
      if (!reponse.ok) throw new Error('delete')
      setRetour('La demande a été supprimée.')
      router.refresh()
    } catch {
      setErreur('La demande n’a pas pu être supprimée. Réessayez.')
    } finally {
      setEnCours(null)
    }
  }

  return (
    <section className="questions-admin-content" aria-label="Boîte de réception des demandes">
      <nav className="questions-admin-filters" aria-label="Filtrer les demandes">
        {(Object.keys(LIBELLES_STATUTS) as Filtre[]).map((valeur) => (
          <Link
            key={valeur}
            href={valeur === 'toutes' ? '/questions/gestion' : `/questions/gestion?statut=${valeur}`}
            aria-current={filtre === valeur ? 'page' : undefined}
            className={filtre === valeur ? 'is-active' : ''}
          >
            {LIBELLES_STATUTS[valeur]}
          </Link>
        ))}
      </nav>

      <p className="questions-admin-count">{questions.length} demande{questions.length === 1 ? '' : 's'} affichée{questions.length === 1 ? '' : 's'} · maximum 200</p>
      {erreur ? <p className="questions-admin-message is-error" role="alert">{erreur}</p> : null}
      {retour ? <p className="questions-admin-message" role="status" aria-live="polite">{retour}</p> : null}

      {questions.length === 0 ? (
        <div className="questions-admin-empty">Aucune demande dans cette sélection.</div>
      ) : (
        <div className="questions-admin-list">
          {questions.map((question) => (
            <article className="questions-admin-item" key={question.id} aria-busy={enCours === question.id}>
              <header className="questions-admin-item-heading">
                <div>
                  <p className="questions-admin-subject">{libelleSujetQuestion(question.sujet)}</p>
                  <h2>{question.nom}</h2>
                </div>
                <span className={`questions-admin-status status-${question.statut}`}>
                  {LIBELLES_STATUT_UNITAIRE[question.statut]}
                </span>
              </header>
              <p className="questions-admin-date">Reçue le {DATE.format(new Date(question.cree_le))}</p>
              <p className="questions-admin-message-text">{question.question}</p>
              <div className="questions-admin-contact">
                {question.canal_reponse === 'email' ? <Mail size={17} aria-hidden="true" /> : <MessageCircle size={17} aria-hidden="true" />}
                <span>{question.canal_reponse === 'email' ? 'E-mail' : 'WhatsApp'} · <strong>{question.coordonnees}</strong></span>
                <a href={lienReponse(question)} target="_blank" rel="noopener noreferrer">
                  {question.canal_reponse === 'email' ? 'Préparer une réponse' : 'Ouvrir WhatsApp'}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
              <footer className="questions-admin-item-actions">
                <button type="button" disabled={enCours === question.id} onClick={() => void changerStatut(question)}>
                  {question.statut === 'nouvelle' ? 'Prendre en charge' : question.statut === 'en_cours' ? 'Marquer comme répondue' : 'Réouvrir'}
                </button>
                <button type="button" className="questions-admin-delete" disabled={enCours === question.id} onClick={() => void supprimer(question)}>
                  <Trash2 size={15} aria-hidden="true" /> Supprimer
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
