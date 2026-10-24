import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { FormulaireConnexion } from '@/components/auth/formulaires'
import { MarqueSikaloc, SikalocSpaceBrand } from '@/components/ui/logo'
import { Alerte } from '@/components/ui/retours'
import {
  contexteDepuisSuite,
  destinationParDefautConnexion,
  normaliserContexteConnexion,
  normaliserSuiteConnexion,
  suitePourContexteConnexion,
  type ContexteConnexion,
} from '@/lib/auth-contexte'

const manropeConnexion = localFont({
  src: [
    { path: '../fonts/Manrope-PDF-Regular.ttf', weight: '400' },
    { path: '../fonts/Manrope-PDF-SemiBold.ttf', weight: '600' },
    { path: '../fonts/Manrope-PDF-Bold.ttf', weight: '700' },
    { path: '../fonts/Manrope-PDF-Extrabold.ttf', weight: '800' },
  ],
  variable: '--font-connexion-display',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = { title: 'Connexion', robots: { index: false, follow: false } }

const MESSAGES_ERREUR: Record<string, string> = {
  lien_invalide: 'Ce lien est invalide. Demandez-en un nouveau.',
  lien_expire: 'Ce lien a expiré. Demandez une nouvelle réinitialisation.',
}

const CONTENUS: Record<ContexteConnexion, {
  label: string
  titre: string
  description: string
  image: string
  alt: string
  titreFormulaire: string
  aideFormulaire: string
}> = {
  pro: {
    label: 'Sikaloc Pro',
    titre: 'Retrouvez la gestion de vos locations.',
    description: 'Vos logements, vos loyers et vos documents vous attendent dans votre espace de gestion.',
    image: '/images/pro/sikaloc-pro-login-owner-keys.webp',
    alt: 'Image illustrative : une propriétaire ouest-africaine observe sa résidence contemporaine, un trousseau de clés à la main.',
    titreFormulaire: 'Bon retour',
    aideFormulaire: 'Connectez-vous avec les identifiants de votre compte bailleur.',
  },
  me: {
    label: 'Sikaloc Me · Espace locataire',
    titre: 'Retrouvez votre espace locataire.',
    description: 'Connectez-vous pour consulter votre bail, vos paiements et les documents partagés par votre bailleur.',
    image: '/images/me/sikaloc-me-connexion-everyday-home.webp',
    alt: 'Image illustrative : un locataire ouest-africain prépare une table dans son appartement.',
    titreFormulaire: 'Bon retour',
    aideFormulaire: 'Utilisez le compte associé à votre invitation déjà acceptée.',
  },
  find: {
    label: 'Sikaloc Find',
    titre: 'Votre prochain logement commence ici.',
    description: 'Connectez-vous ou créez un compte pour envoyer votre candidature.',
    image: '/images/find/sikaloc-find-login-kitchen-visit.webp',
    alt: 'Image illustrative : une candidate examine les rangements d’une cuisine pendant la visite d’un appartement.',
    titreFormulaire: 'Continuez votre candidature',
    aideFormulaire: 'Connectez-vous pour reprendre le parcours du logement choisi.',
  },
  general: {
    label: 'Sikaloc',
    titre: 'Bienvenue sur Sikaloc.',
    description: 'Retrouvez votre espace personnel et poursuivez votre parcours sur Sikaloc.',
    image: '/images/general/sikaloc-general-login-courtyard.webp',
    alt: 'Image illustrative d’une cour intérieure calme dans une résidence contemporaine.',
    titreFormulaire: 'Connectez-vous à Sikaloc',
    aideFormulaire: 'Saisissez les identifiants associés à votre compte.',
  },
}

function LiensSecondaires({ contexte, suite }: { contexte: ContexteConnexion; suite: string }) {
  if (contexte === 'pro') {
    return (
      <p>
        Pas encore de compte bailleur ?{' '}
        <Link href="/inscription">Créer un compte Pro</Link>
      </p>
    )
  }

  if (contexte === 'me') {
    return (
      <p>
        <span>Vous n’avez pas encore reçu d’invitation ?</span>
        <Link href="/me/rejoindre">Comment accéder à Sikaloc Me ?</Link>
      </p>
    )
  }

  if (contexte === 'find') {
    const annonceCandidature = /^\/find\/[0-9a-hjkmnp-tv-z]{10}\/candidater(?:\?|$)/.test(suite)
    return annonceCandidature ? (
      <p>
        Pas encore de compte candidat ?{' '}
        <Link href={suite}>Créer un compte pour cette candidature</Link>
      </p>
    ) : (
      <p>
        La création d’un compte candidat se fait au moment d’une candidature.{' '}
        <Link href="/find">Explorer les annonces</Link>
      </p>
    )
  }

  return (
    <p>
      Première visite ? <Link href="/#espaces">Découvrir les espaces Sikaloc</Link>
    </p>
  )
}

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string; context?: string }>
}) {
  const { suite: suiteBrute, erreur, context: contexteBrut } = await searchParams
  const suiteValidee = normaliserSuiteConnexion(suiteBrute)
  const contexte =
    contexteDepuisSuite(suiteValidee) ??
    normaliserContexteConnexion(contexteBrut) ??
    'general'
  const suite = suitePourContexteConnexion(
    suiteValidee ?? destinationParDefautConnexion(contexte),
    contexte,
  )
  const contenu = CONTENUS[contexte]
  const espaceMarque = contexte === 'pro' ? 'Pro' : contexte === 'me' ? 'Me' : contexte === 'find' ? 'Find' : null

  return (
    <main id="contenu-principal" tabIndex={-1} className={`connexion-page ${manropeConnexion.variable}`}>
      <a href="#contenu-principal" className="skip-link">Aller au contenu</a>

      <div className="connexion-layout">
        <aside className="connexion-editorial" aria-labelledby="connexion-context-title">
          <div className="connexion-editorial-copy">
            <p className="connexion-eyebrow">{contenu.label}</p>
            <h1 id="connexion-context-title">{contenu.titre}</h1>
            <p className="connexion-editorial-description">{contenu.description}</p>
          </div>

          <figure className="connexion-photo" data-context={contexte}>
            <Image
              src={contenu.image}
              alt={contenu.alt}
              fill
              priority
              sizes="(max-width: 900px) 100vw, (max-width: 1280px) 48vw, 620px"
            />
          </figure>
        </aside>

        <section className="connexion-form-side" aria-labelledby="connexion-form-title">
          <div className="connexion-form-inner">
            <div className="connexion-brand">
              {espaceMarque ? (
                <SikalocSpaceBrand espace={espaceMarque} taille="md" />
              ) : (
                <MarqueSikaloc taille="md" />
              )}
            </div>

            <div className="connexion-mobile-context">
              <p className="connexion-eyebrow">{contenu.label}</p>
              <p>{contenu.description}</p>
            </div>

            <header className="connexion-form-heading">
              <h2 id="connexion-form-title">{contenu.titreFormulaire}</h2>
              <p>{contenu.aideFormulaire}</p>
            </header>

            {erreur && MESSAGES_ERREUR[erreur] ? (
              <div className="connexion-error">
                <Alerte ton="attention">{MESSAGES_ERREUR[erreur]}</Alerte>
              </div>
            ) : null}

            <FormulaireConnexion suite={suite} contexte={contexte} />

            <div className="connexion-secondary-links" data-context={contexte}>
              <LiensSecondaires contexte={contexte} suite={suite} />
            </div>

            <Link href="/" className="connexion-home-link">
              Retour à l’accueil <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
