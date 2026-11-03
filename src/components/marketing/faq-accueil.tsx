'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const QUESTIONS = [
  {
    question: 'Qui peut créer un compte Sikaloc Pro ?',
    reponse:
      'Les propriétaires bailleurs et les personnes qui gèrent leurs locations peuvent créer un compte Pro. La création suit le parcours d’inscription et de vérification proposé par Sikaloc.',
  },
  {
    question: 'Comment accéder à Sikaloc Me ?',
    reponse:
      'Le locataire rejoint son espace à partir de l’invitation de son bailleur. Il y consulte uniquement les informations et les documents mis à sa disposition.',
  },
  {
    question: 'Les logements publiés sur Find sont-ils toujours disponibles ?',
    reponse:
      'Find présente les annonces publiées. Leur disponibilité peut évoluer : vérifiez les informations de l’annonce et prenez contact selon le parcours proposé.',
  },
  {
    question: 'Que se passe-t-il après une candidature sur Find ?',
    reponse:
      'La candidature est transmise au bailleur pour examen. Elle ne réserve pas le logement et ne crée pas automatiquement de bail ; le bailleur décide de la suite.',
  },
  {
    question: 'Comment retrouver les paiements et les quittances ?',
    reponse:
      'Dans Pro, le bailleur retrouve les paiements enregistrés et les documents disponibles selon leur état. Un locataire invité peut consulter les éléments partagés dans Me.',
  },
]

export function FAQAccueil() {
  const [ouvert, setOuvert] = useState<number | null>(0)

  return (
    <div className="home-faq-content">
      <div className="home-faq-list">
        {QUESTIONS.map(({ question, reponse }, index) => {
          const estOuvert = ouvert === index
          const panneauId = `accueil-faq-reponse-${index}`
          const boutonId = `accueil-faq-question-${index}`

          return (
            <article className="home-faq-item" key={question}>
              <h3 className="home-faq-question-heading">
                <button
                  id={boutonId}
                  className="home-faq-question"
                  type="button"
                  aria-expanded={estOuvert}
                  aria-controls={panneauId}
                  onClick={() => setOuvert(estOuvert ? null : index)}
                >
                  <span>{question}</span>
                  <span className="home-faq-chevron" aria-hidden="true" />
                </button>
              </h3>
              <div
                id={panneauId}
                className="home-faq-answer-wrap"
                role="region"
                aria-labelledby={boutonId}
                aria-hidden={!estOuvert}
                data-open={estOuvert}
              >
                <div className="home-faq-answer-inner">
                  <p>{reponse}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <aside className="home-faq-contact" aria-labelledby="accueil-faq-contact-title">
        <div>
          <h3 id="accueil-faq-contact-title">Vous n&apos;avez pas trouvé votre réponse ?</h3>
          <p>Posez-nous votre question et choisissez de recevoir notre réponse par e-mail ou WhatsApp.</p>
        </div>
        <Link href="/questions" className="btn btn-primary home-faq-contact-button">
          Poser une question <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </aside>
    </div>
  )
}
