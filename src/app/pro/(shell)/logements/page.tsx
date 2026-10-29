import type { Metadata } from 'next'
import Link from 'next/link'
import { MoreHorizontal, Plus } from 'lucide-react'

import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { Alerte, Badge } from '@/components/ui/retours'
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
  presenterLocalisationLogement,
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
      <header className={`${styles.header}${plafondAtteint && !erreurLogements ? ` ${styles.headerQuota}` : ''}`}>
        <h1 className={styles.title}>Logements</h1>
        {!erreurLogements ? (
          <>
            <p className={styles.capacity}>
              {presenterQuotaLogements(capacitesBailleur.plan, liste.length, limite)}
              {plafondAtteint ? (
                <Link href="/pro/parametres/abonnement">Changer de plan</Link>
              ) : null}
            </p>
            {!plafondAtteint ? (
              <Link
                href="/pro/logements/nouveau"
                className={`btn btn-primary ${styles.addAction}`}
                aria-label="Ajouter un logement"
              >
                Ajouter
                <Plus size={17} strokeWidth={2} aria-hidden="true" />
              </Link>
            ) : null}
          </>
        ) : null}
      </header>

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

          {liste.length === 0 ? (
            <section className={styles.empty} aria-labelledby="empty-properties-title">
              <h2 id="empty-properties-title">Aucun logement pour le moment.</h2>
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
                const actionPrincipale = bailActif
                  ? { href: `/pro/baux/${bailActif.id}`, libelle: 'Voir le bail' }
                  : actionAnnonce

                return (
                  <li key={logement.id} className={styles.property}>
                    <div className={styles.identity}>
                      <h3>{logement.adresse}</h3>
                      <p>{presenterLocalisationLogement(logement.type, logement.ville, logement.pays)}</p>
                    </div>

                    <div className={styles.occupation}>
                      <div className={styles.statusLine}>
                        <Badge ton={bailActif ? 'positive' : 'neutral'}>
                          {bailActif ? 'Occupé' : 'Libre'}
                        </Badge>
                        {bailActif && locataire?.nom ? (
                          <span className={styles.tenantName}>
                            <span className="sr-only">Locataire : </span>
                            {locataire.nom}
                          </span>
                        ) : null}
                        {statutAnnonce ? (
                          <span className={styles.advertStatus} data-tone={statutAnnonce.ton}>
                            {statutAnnonce.libelle}
                          </span>
                        ) : null}
                      </div>

                    </div>

                    {bailActif ? (
                      <p className={styles.rent}>
                        <span className="sr-only">Loyer contractuel : </span>
                        <strong>{formaterFCFA(bailActif.loyer_mensuel)}</strong>
                        <span>/mois</span>
                      </p>
                    ) : null}

                    <div className={styles.actions} role="group" aria-label={`Actions pour ${logement.adresse}`}>
                      {actionPrincipale ? (
                        <Link
                          href={actionPrincipale.href}
                          className={styles.rowAction}
                          aria-label={`${actionPrincipale.libelle} — ${logement.adresse}`}
                        >
                          {actionPrincipale.libelle}
                        </Link>
                      ) : null}
                      <details className={styles.moreActions}>
                        <summary aria-label={`Plus d’actions pour ${logement.adresse}`}>
                          <MoreHorizontal size={18} aria-hidden="true" />
                        </summary>
                        <div className={styles.actionMenu}>
                          <Link href={`/pro/logements/${logement.id}/modifier`} className={styles.menuAction}>
                            Modifier
                          </Link>
                          {bailActif && actionAnnonce ? (
                            <Link href={actionAnnonce.href} className={styles.menuAction}>
                              Gérer l’annonce
                            </Link>
                          ) : null}
                          {!bailActif && locataireDisponible ? (
                            <Link href="/pro/baux/nouveau" className={styles.menuAction}>
                              Créer un bail
                            </Link>
                          ) : null}
                          {suppressionPossible ? (
                            <ActionConfirmee
                              action={supprimerLogement.bind(null, logement.id)}
                              libelle="Supprimer le logement"
                              variante="danger"
                              varianteDeclencheur="tertiary"
                              titreConfirmation="Supprimer ce logement ?"
                              messageConfirmation="Cette action est définitive. Si un bail ou une annonce en cours vient d’être associé, la suppression sera refusée."
                              libelleConfirmation="Supprimer définitivement"
                            />
                          ) : null}
                        </div>
                      </details>
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
