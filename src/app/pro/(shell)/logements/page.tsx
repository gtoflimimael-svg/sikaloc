import type { Metadata } from 'next'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'

import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { Alerte, Badge, EnTetePage } from '@/components/ui/retours'
import { supprimerLogement } from '@/lib/actions/logements'
import { formaterFCFA } from '@/lib/format'
import { capacites } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { StatutAnnonce, TypeLogement } from '@/lib/types/database'
import {
  premiereRelation,
  presenterStatutAnnonce,
  presenterActionAnnonce,
  presenterQuotaLogements,
  peutSupprimerLogement,
  trouverAnnonceVivante,
  trouverBailActif,
} from '@/lib/logements-presentation'
import styles from './logements.module.css'

export const metadata: Metadata = { title: 'Logements' }

type BailLogement = {
  id: string
  statut: string
  loyer_mensuel: number
  locataire?: { nom?: string } | { nom?: string }[] | null
}

type AnnonceLogement = { id: string; statut: StatutAnnonce }

type LogementAvecRelations = {
  id: string
  adresse: string
  ville: string
  pays: string
  type: TypeLogement
  baux: BailLogement[] | null
  annonces: AnnonceLogement[] | null
}

export default async function PageLogements() {
  const supabase = await creerClientServeur()

  // Les données visibles restent limitées par les RLS de la session. Le bailleur
  // sert à lire son plafond de plan, jamais à élargir la portée des requêtes.
  const [bailleur, logementsReponse, locatairesReponse] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('logements')
      .select('*, baux(id, statut, loyer_mensuel, locataire:locataires(nom)), annonces(id, statut)')
      .order('created_at', { ascending: false }),
    // Un seul identifiant suffit pour savoir si « Créer un bail » peut être
    // proposé. Aucune donnée personnelle de locataire n'est chargée ici.
    supabase.from('locataires').select('id').limit(1),
  ])

  const { data: logements, error: erreurLogements } = logementsReponse
  const liste = (logements ?? []) as unknown as LogementAvecRelations[]
  const capacitesBailleur = capacites(bailleur)
  const limite = capacitesBailleur.maxLogements
  const plafondAtteint = limite !== null && liste.length >= limite
  const locataireDisponible = !locatairesReponse.error && (locatairesReponse.data?.length ?? 0) > 0
  const actionLocataireIndisponible =
    Boolean(locatairesReponse.error) && liste.some((logement) => !trouverBailActif(logement.baux ?? []))

  return (
    <div className={styles.page}>
      <EnTetePage
        titre="Logements"
        description="Retrouvez et gérez vos biens immobiliers."
        action={!plafondAtteint && liste.length > 0 && !erreurLogements ? (
          <Link href="/pro/logements/nouveau" className="btn btn-primary">
            Ajouter un logement
          </Link>
        ) : undefined}
      />

      {erreurLogements ? (
        <Alerte ton="erreur">
          Vos logements n’ont pas pu être chargés. Actualisez la page pour réessayer.
        </Alerte>
      ) : (
        <>
          {actionLocataireIndisponible ? (
            <div className={styles.dataNotice}>
              <Alerte ton="info">
                La disponibilité des locataires n’a pas pu être vérifiée. La création d’un bail depuis cette liste est momentanément masquée.
              </Alerte>
            </div>
          ) : null}

          <div className={styles.collectionHeading}>
            <h2>Votre parc</h2>
            <p className={styles.capacity}>
              {presenterQuotaLogements(capacitesBailleur.plan, liste.length, limite)}
              {plafondAtteint ? (
                <Link href="/pro/parametres/abonnement">Découvrir le plan Standard</Link>
              ) : null}
            </p>
          </div>

          {liste.length === 0 ? (
            <section className={styles.empty} aria-labelledby="empty-properties-title">
              <div className={styles.emptyCopy}>
                <h3 id="empty-properties-title">Ajoutez votre premier logement.</h3>
                <p>Commencez par enregistrer un bien pour organiser sa location.</p>
              </div>
              <Link href="/pro/logements/nouveau" className="btn btn-primary">
                Ajouter un logement
              </Link>
            </section>
          ) : (
            <ul className={styles.list} aria-label="Logements enregistrés">
              {liste.map((logement) => {
                const baux = logement.baux ?? []
                const bailActif = trouverBailActif(baux)
                const locataire = premiereRelation(bailActif?.locataire)
                const annonce = trouverAnnonceVivante(logement.annonces ?? [])
                const statutAnnonce = annonce ? presenterStatutAnnonce(annonce.statut) : null
                const actionAnnonce = presenterActionAnnonce(annonce?.id, logement.id, Boolean(bailActif))
                const suppressionPossible = peutSupprimerLogement(baux.length, Boolean(annonce))

                return (
                  <li key={logement.id} className={styles.property}>
                    <div className={styles.identity}>
                      <h3>{logement.adresse}</h3>
                      <p>
                        {logement.type} <span aria-hidden="true">·</span> {logement.ville}, {logement.pays}
                      </p>
                    </div>

                    <div className={styles.occupation}>
                      <div className={styles.statusLine}>
                        <Badge ton={bailActif ? 'positive' : 'neutral'}>
                          {bailActif ? 'Occupé' : 'Libre'}
                        </Badge>
                        {statutAnnonce ? (
                          <span className={styles.advertStatus} data-tone={statutAnnonce.ton}>
                            {statutAnnonce.libelle}
                          </span>
                        ) : null}
                      </div>

                      {bailActif ? (
                        <p className={styles.tenant}>
                          <span>Locataire</span>
                          <strong>{locataire?.nom ?? 'Locataire associé'}</strong>
                        </p>
                      ) : (
                        <div className={styles.vacancySummary}>
                          <p>Sans bail actif</p>
                          {locataireDisponible ? <Link href="/pro/baux/nouveau">Créer un bail</Link> : null}
                        </div>
                      )}
                    </div>

                    <div className={styles.rent}>
                      <span>Loyer contractuel</span>
                      {bailActif ? (
                        <p>
                          <strong>{formaterFCFA(bailActif.loyer_mensuel)}</strong>
                          <span>/ mois</span>
                        </p>
                      ) : (
                        <p className={styles.rentMissing}>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Aucun loyer contractuel sans bail actif</span>
                        </p>
                      )}
                    </div>

                    <div className={styles.actions} role="group" aria-label={`Actions pour ${logement.adresse}`}>
                      <Link href={`/pro/logements/${logement.id}/modifier`} className={styles.rowAction}>
                        Modifier
                      </Link>
                      {bailActif ? (
                        <Link
                          href={`/pro/baux/${bailActif.id}`}
                          className={styles.rowAction}
                          aria-label={`Voir le bail de ${locataire?.nom ?? 'ce logement'}`}
                        >
                          Voir le bail
                        </Link>
                      ) : null}
                      {actionAnnonce ? (
                        <Link href={actionAnnonce.href} className={styles.rowAction}>
                          {actionAnnonce.libelle}
                        </Link>
                      ) : null}
                      {suppressionPossible ? (
                        <details className={styles.moreActions}>
                          <summary aria-label={`Autres actions pour ${logement.adresse}`}>
                            <MoreHorizontal size={18} aria-hidden="true" />
                          </summary>
                          <div className={styles.actionMenu}>
                            <ActionConfirmee
                              action={supprimerLogement.bind(null, logement.id)}
                              libelle="Supprimer le logement"
                              variante="danger"
                              varianteDeclencheur="tertiary"
                              titreConfirmation="Supprimer ce logement ?"
                              messageConfirmation="Cette action est définitive. Si un bail ou une annonce en cours vient d’être associé, la suppression sera refusée."
                              libelleConfirmation="Supprimer définitivement"
                            />
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
