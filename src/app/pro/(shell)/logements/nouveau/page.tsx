import type { Metadata } from 'next'
import Link from 'next/link'

import { FormulaireLogement } from '@/components/app/formulaire-logement'
import { Alerte, EnTetePage } from '@/components/ui/retours'
import { creerLogement } from '@/lib/actions/logements'
import { capacites, messageLimiteLogements } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import styles from '../logements.module.css'

export const metadata: Metadata = { title: 'Nouveau logement' }

export default async function PageNouveauLogement() {
  const supabase = await creerClientServeur()

  const [bailleur, { count, error: erreurCompteur }] = await Promise.all([
    bailleurOnboarde(),
    supabase.from('logements').select('id', { count: 'exact', head: true }),
  ])

  const limite = capacites(bailleur).maxLogements
  const enregistres = count ?? 0
  const plafondAtteint = limite !== null && enregistres >= limite
  const restants = limite === null ? null : Math.max(0, limite - enregistres)
  const quotaIndisponible = Boolean(erreurCompteur) || count === null

  return (
    <div className={`${styles.formPage} property-form-page`}>
      <EnTetePage
        titre="Nouveau logement"
        description="Décrivez le bien pour le retrouver dans votre parc, puis le rattacher à un bail ou préparer une annonce."
      />

      {quotaIndisponible ? (
        <section className={styles.capacityState} aria-label="Vérification du quota">
          <div className={styles.formError}>
            <Alerte ton="erreur">
              Le nombre de logements ne peut pas être vérifié. Le formulaire reste indisponible ; actualisez la page pour réessayer.
            </Alerte>
          </div>
          <Link href="/pro/logements" className="btn btn-secondary">Retour aux logements</Link>
        </section>
      ) : plafondAtteint ? (
        <section className={styles.capacityState} aria-labelledby="quota-reached-title">
          <h2 id="quota-reached-title">Votre capacité actuelle est atteinte.</h2>
          <p>{messageLimiteLogements(enregistres)}</p>
          <div className={styles.capacityStateActions}>
            <Link href="/pro/parametres/abonnement" className="btn btn-primary">
              Passer au plan Standard
            </Link>
            <Link href="/pro/logements" className="btn btn-secondary">
              Retour aux logements
            </Link>
          </div>
        </section>
      ) : (
        <>
          {limite !== null && restants !== null ? (
            <p className={styles.formCapacity}>
              Votre plan Gratuit comprend {limite} logements. Il vous en reste {restants}.
            </p>
          ) : null}
          <FormulaireLogement action={creerLogement} />
        </>
      )}
    </div>
  )
}
