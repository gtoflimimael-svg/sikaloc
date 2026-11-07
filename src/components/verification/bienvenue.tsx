'use client'

import { Check } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { MarqueSikaloc } from '@/components/ui/logo'
import styles from './bienvenue.module.css'

export function BienvenueVerification({ destination }: { destination: string | null }) {
  const router = useRouter()

  useEffect(() => {
    if (!destination) return
    const timeout = window.setTimeout(() => router.replace(destination), 1500)
    return () => window.clearTimeout(timeout)
  }, [destination, router])

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <MarqueSikaloc href={null} taille="md" className={styles.logo} />

        {destination ? (
          <>
            <div className={styles.check} aria-hidden="true">
              <Check size={42} strokeWidth={2.6} />
            </div>
            <h1 className={styles.title}>Bienvenue sur Sikaloc&nbsp;!</h1>
            <p className={styles.description}>
              Votre adresse email est confirmée. Votre espace est prêt.
            </p>
            <p className={styles.progression} role="status">
              Ouverture de votre espace…
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Votre session n’est pas disponible</h1>
            <p className={styles.description}>
              Votre code a peut-être été confirmé, mais Sikaloc n’a pas pu vérifier votre session.
              Connectez-vous pour accéder à votre espace.
            </p>
            <div className={styles.recovery}>
              <Link href="/connexion" className="btn btn-primary">Se connecter</Link>
              <Link href="/verification" className="text-body-sm text-mute underline">
                Reprendre la vérification
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
