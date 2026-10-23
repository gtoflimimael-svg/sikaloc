import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'

import { MarqueSikaloc } from '@/components/ui/logo'

const manropeMe = localFont({
  src: [
    { path: '../../fonts/Manrope-PDF-Regular.ttf', weight: '400' },
    { path: '../../fonts/Manrope-PDF-Medium.ttf', weight: '500' },
    { path: '../../fonts/Manrope-PDF-SemiBold.ttf', weight: '600' },
    { path: '../../fonts/Manrope-PDF-Bold.ttf', weight: '700' },
    { path: '../../fonts/Manrope-PDF-Extrabold.ttf', weight: '800' },
  ],
  variable: '--font-me-display',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Rejoindre Sikaloc Me',
  description:
    'Retrouvez votre bail, vos paiements et les documents partagés par votre bailleur dans votre espace Sikaloc Me.',
}

const etapes = [
  {
    numero: '01',
    titre: 'Votre bailleur vous invite.',
    texte: 'Il vous envoie un lien personnel depuis votre fiche locataire dans Sikaloc Pro.',
  },
  {
    numero: '02',
    titre: 'Vous acceptez l’invitation.',
    texte: 'Ouvrez le lien reçu pour créer votre accès ou vous connecter avec l’adresse e-mail invitée.',
  },
  {
    numero: '03',
    titre: 'Vous retrouvez votre location.',
    texte: 'Consultez votre bail, les paiements enregistrés et les documents mis à votre disposition.',
  },
]

export default function PageRejoindre() {
  return (
    <main id="contenu-principal" tabIndex={-1} className={`me-join ${manropeMe.variable}`}>
      <a href="#contenu-principal" className="skip-link">
        Aller au contenu
      </a>

      <header className="me-join-header">
        <div className="me-join-wrap me-join-header-inner">
          <MarqueSikaloc taille="sm" />
          <Link href="/" className="me-join-home-link">
            Accueil <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="me-join-hero" aria-labelledby="me-join-title">
        <div className="me-join-wrap me-join-hero-grid">
          <div className="me-join-hero-copy">
            <p className="me-join-eyebrow">Sikaloc Me · Espace locataire</p>
            <h1 id="me-join-title" className="me-join-title">
              <span className="me-join-title-line">Votre location,</span>{' '}
              <span className="me-join-title-line">à portée de main.</span>
            </h1>
            <p className="me-join-lead">
              Retrouvez votre bail, vos paiements et vos quittances dans un espace
              personnel accessible sur invitation de votre bailleur.
            </p>
            <div className="me-join-hero-actions">
              <Link href="/connexion?suite=%2Fme" className="me-join-button me-join-button-primary">
                Se connecter <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a href="#fonctionnement" className="me-join-button me-join-button-secondary">
                Comment ça marche ? <ChevronDown size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <figure className="me-join-photo">
            <Image
              src="/images/me/sikaloc-me-rejoindre-editorial.webp"
              alt="Photographie illustrative d’un jeune homme ouest-africain consultant son téléphone dans un salon lumineux."
              width={1440}
              height={960}
              sizes="(max-width: 900px) 100vw, (max-width: 1200px) 48vw, 600px"
              priority
            />
          </figure>
        </div>
      </section>

      <section id="fonctionnement" className="me-join-steps" aria-labelledby="me-join-steps-title">
        <div className="me-join-wrap">
          <div className="me-join-section-heading">
            <p className="me-join-eyebrow">Un accès personnel, relié à votre bail</p>
            <h2 id="me-join-steps-title">Votre espace locataire, en trois étapes.</h2>
          </div>

          <ol className="me-join-step-list">
            {etapes.map((etape) => (
              <li key={etape.numero} className="me-join-step">
                <span className="me-join-step-number" aria-hidden="true">
                  {etape.numero}
                </span>
                <h3>{etape.titre}</h3>
                <p>{etape.texte}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="me-join-invitation" aria-labelledby="me-join-invitation-title">
        <div className="me-join-wrap">
          <div className="me-join-invitation-panel">
            <p className="me-join-eyebrow">Vous n’avez pas encore reçu d’invitation ?</p>
            <h2 id="me-join-invitation-title">Votre bailleur vous ouvre l’accès.</h2>
            <p>
              Demandez-lui de vous inviter depuis son espace Sikaloc Pro. Cette
              invitation relie votre compte à la bonne location et aux documents
              qu’il partage avec vous.
            </p>
          </div>
        </div>
      </section>

      <section className="me-join-next" aria-label="Autres accès Sikaloc">
        <div className="me-join-wrap">
          <div className="me-join-next-grid">
            <div className="me-join-next-item">
              <p>Vous avez déjà activé votre accès ?</p>
              <Link href="/connexion?suite=%2Fme">
                Se connecter <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="me-join-next-item">
              <p>Vous gérez des logements ?</p>
              <Link href="/pro">
                Découvrir Sikaloc Pro <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="me-join-footer">
            <MarqueSikaloc taille="sm" />
            <Link href="/">Retour à l’accueil Sikaloc</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
