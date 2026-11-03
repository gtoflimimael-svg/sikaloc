import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import styles from './securite.module.css'

import { MarqueSikaloc } from '@/components/ui/logo'

/**
 * Cadre commun aux écrans d'authentification.
 * Formulaire ouvert et centré ; le panneau éditorial reste secondaire.
 *
 * La connexion et l'inscription peuvent afficher une illustration de marque
 * sur grand écran. Les procédures de sécurité gardent un gabarit sobre.
 */
export function CarteAuth({
  titre,
  description,
  children,
  bas,
  ambiance = false,
}: {
  titre: string
  description?: string
  children: ReactNode
  bas?: ReactNode
  ambiance?: boolean
}) {
  return (
    <main id="contenu" className={styles.main}>
      <div
        className={`${styles.frame} ${ambiance ? styles.wide : ''}`}
      >
        {ambiance ? (
          <aside className="hidden min-h-[600px] flex-col justify-between overflow-hidden rounded-xl bg-surface-dark p-2xl text-white lg:flex">
            <div>
              <p className="text-caption font-semibold uppercase tracking-widest text-primary-on-dark">Sikaloc Pro</p>
              <h2 className="mt-xl text-display-md font-extrabold text-white">La gestion locative, au clair.</h2>
              <p className="mt-md max-w-[30rem] text-body-md text-on-dark-mute">Vos logements, vos baux et vos documents dans un espace pensé pour les bailleurs.</p>
            </div>
            <Image src="/illustrations/home-02.webp" alt="" width={1200} height={900} sizes="(min-width: 1024px) 45vw, 0px" className="h-auto w-full rounded-lg" />
          </aside>
        ) : null}

        <div className={styles.content}>
          <div className={styles.brand}>
            <MarqueSikaloc />
          </div>

          <div className={styles.form}>
            <h1 >{titre}</h1>
            {description ? (
              <p className={styles.description}>{description}</p>
            ) : (
              <div className="mb-xl" />
            )}

            {children}
          </div>

          {bas ? <div className={styles.footer}>{bas}</div> : null}

          <p className={styles.back}>
            <Link href="/" className="text-body-sm text-mute hover:text-ink">
              ← Retour à l&apos;accueil
            </Link>
          </p>
        </div>

      </div>
    </main>
  )
}
