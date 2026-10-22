import type { Metadata } from 'next'

import { EnTetePublic } from '@/components/marketing/en-tete-public'
import { PiedDePage } from '@/components/marketing/pied-de-page'
import { FormulaireQuestion } from '@/components/questions/formulaire-question'
import { obtenirUtilisateur } from '@/lib/supabase/serveur'

export const metadata: Metadata = {
  title: 'Poser une question',
  description: 'Contactez Sikaloc et choisissez de recevoir votre réponse par e-mail ou WhatsApp.',
}

const liens = [
  { href: '/#faq', libelle: 'Questions fréquentes' },
  { href: '/find', libelle: 'Trouver un logement' },
  { href: '/pro', libelle: 'Sikaloc Pro' },
]

export default async function PageQuestions() {
  const utilisateur = await obtenirUtilisateur()

  return (
    <div className="min-h-screen bg-canvas-soft">
      <EnTetePublic connecte={Boolean(utilisateur)} liens={liens} />
      <main id="contenu" className="questions-page">
        <div className="questions-layout">
          <header className="questions-intro">
            <p className="question-form-eyebrow">Contact · Sikaloc</p>
            <h1>Une question&nbsp;? Nous sommes à votre écoute.</h1>
            <p>Décrivez votre demande et choisissez comment vous souhaitez recevoir notre réponse.</p>
          </header>
          <FormulaireQuestion />
        </div>
      </main>
      <PiedDePage />
    </div>
  )
}
