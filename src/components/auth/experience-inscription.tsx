import localFont from 'next/font/local'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { SikalocSpaceBrand, type SuffixeEspace } from '@/components/ui/logo'

const manropeInscription = localFont({
  src: [
    { path: '../../app/fonts/Manrope-PDF-Regular.ttf', weight: '400' },
    { path: '../../app/fonts/Manrope-PDF-Medium.ttf', weight: '500' },
    { path: '../../app/fonts/Manrope-PDF-SemiBold.ttf', weight: '600' },
    { path: '../../app/fonts/Manrope-PDF-Bold.ttf', weight: '700' },
    { path: '../../app/fonts/Manrope-PDF-Extrabold.ttf', weight: '800' },
  ],
  variable: '--font-inscription-display',
  display: 'swap',
  preload: false,
})

export function ExperienceInscription({
  espace,
  label,
  titreEditorial,
  descriptionEditorial,
  image,
  imageAlt,
  titreFormulaire,
  descriptionFormulaire,
  detailFormulaire,
  retour,
  bas,
  children,
}: {
  espace: SuffixeEspace
  label: string
  titreEditorial: string
  descriptionEditorial: string
  image: string
  imageAlt: string
  titreFormulaire: string
  descriptionFormulaire: string
  detailFormulaire?: ReactNode
  retour?: { href: string; libelle: string }
  bas?: ReactNode
  children: ReactNode
}) {
  return (
    <main id="contenu" className={`signup-experience ${manropeInscription.variable}`}>
      <a href="#signup-form-title" className="skip-link">Passer au formulaire</a>
      <div className="signup-experience-grid">
        <section className="signup-editorial" aria-label={`Présentation de Sikaloc ${espace}`}>
          {retour ? (
            <Link className="signup-backlink" href={retour.href}>
              <span aria-hidden="true">←</span> {retour.libelle}
            </Link>
          ) : (
            <Link className="signup-backlink" href="/" aria-label="Retour à l’accueil Sikaloc">
              ← Accueil Sikaloc
            </Link>
          )}

          <div className="signup-editorial-copy">
            <p className="signup-eyebrow">{label}</p>
            <h1>{titreEditorial}</h1>
            <p className="signup-editorial-description">{descriptionEditorial}</p>
          </div>

          <figure className="signup-photo">
            <Image
              src={image}
              alt={imageAlt}
              fill
              priority
              sizes="(max-width: 980px) 100vw, (max-width: 1440px) 50vw, 680px"
            />
          </figure>
        </section>

        <section className="signup-form-side" aria-labelledby="signup-form-title">
          <div className="signup-form-inner">
            {retour ? (
              <Link className="signup-return-mobile" href={retour.href}>
                ← {retour.libelle}
              </Link>
            ) : null}
            <div className="signup-brand">
              <SikalocSpaceBrand href="/" espace={espace} taille="md" />
            </div>
            <header className="signup-form-heading">
              <h1 className="signup-mobile-title">{titreEditorial}</h1>
              <h2 id="signup-form-title">{titreFormulaire}</h2>
              <p>{descriptionFormulaire}</p>
            </header>
            {detailFormulaire ? <div className="signup-form-detail">{detailFormulaire}</div> : null}
            <div className="signup-form-content">{children}</div>
            {bas ? <div className="signup-form-bottom">{bas}</div> : null}
            <Link href="/" className="signup-home-link">
              Retour à l’accueil Sikaloc
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
