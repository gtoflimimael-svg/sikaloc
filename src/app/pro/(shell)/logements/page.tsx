import type { Metadata } from 'next'
import Link from 'next/link'

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
  const limite = capacites(bailleur).maxLogements
  const plafondAtteint = limite !== null && liste.length >= limite
  const locataireDisponible = !locatairesReponse.error && (locatairesReponse.data?.length ?? 0) > 0

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
      ) : liste.length === 0 ? (
        <section className={styles.empty} aria-labelledby="empty-properties-title">
          <div className={styles.emptyCopy}>
            <h2 id="empty-properties-title">Ajoutez votre premier logement.</h2>
            <p>Commencez par enregistrer un bien pour organiser sa location.</p>
          </div>
          <Link href="/pro/logements/nouveau" className="btn btn-primary">
            Ajouter un logement
          </Link>
        </section>
      ) : (
        <>
          {locatairesReponse.error ? (
            <div className={styles.dataNotice}>
              <Alerte ton="info">
                La disponibilité des locataires n’a pas pu être vérifiée. La création d’un bail depuis cette liste est momentanément masquée.
              </Alerte>
            </div>
          ) : null}

          <div className={styles.collectionHeading}>
            <h2>Votre parc</h2>
            <p>{liste.length} logement{liste.length === 1 ? '' : 's'}</p>
          </div>

          {limite !== null ? (
            <div className={styles.capacity}>
              <p>
                {plafondAtteint
                  ? `Vous avez enregistré ${liste.length} logements sur les ${limite} du plan Gratuit.`
                  : `Il vous reste ${limite - liste.length} place${limite - liste.length === 1 ? '' : 's'} sur les ${limite} logements du plan Gratuit.`}
              </p>
              {plafondAtteint ? (
                <Link href="/pro/parametres/abonnement">Découvrir le plan Standard</Link>
              ) : null}
            </div>
          ) : null}

          <ul className={styles.list} aria-label="Logements enregistrés">
            {liste.map((logement) => {
              const baux = logement.baux ?? []
              const bailActif = trouverBailActif(baux)
              const locataire = premiereRelation(bailActif?.locataire)
              const annonce = trouverAnnonceVivante(logement.annonces ?? [])
              const statutAnnonce = annonce ? presenterStatutAnnonce(annonce.statut) : null

              return (
                <li key={logement.id} className={styles.property}>
                  <div className={styles.identity}>
                    <h3>{logement.adresse}</h3>
                  <p>
                    {logement.type} <span aria-hidden="true">·</span> {logement.ville}, {logement.pays}
                  </p>
                  </div>

                  <div className={styles.overview}>
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
                      <div className={styles.leaseSummary}>
                        <p>
                          <span>Locataire</span>
                          <Link href={`/pro/baux/${bailActif.id}`}>
                            {locataire?.nom ?? 'Voir le bail'}
                            {locataire?.nom ? <span className="sr-only"> — consulter le bail</span> : null}
                          </Link>
                        </p>
                        <p className={styles.rent}>
                          <strong>{formaterFCFA(bailActif.loyer_mensuel)}</strong>
                          <span>/ mois</span>
                        </p>
                      </div>
                    ) : (
                      <div className={styles.vacancySummary}>
                        <p>Sans bail actif</p>
                        {locataireDisponible ? (
                          <Link href="/pro/baux/nouveau">Créer un bail</Link>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div
                    className={styles.actions}
                    role="group"
                    aria-label={`Actions pour ${logement.adresse}`}
                  >
                    <Link
                      href={`/pro/logements/${logement.id}/modifier`}
                      className="btn btn-tertiary btn-sm"
                    >
                      Modifier
                    </Link>
                    {annonce ? (
                      <Link
                        href={`/pro/annonces/${annonce.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Gérer l’annonce
                      </Link>
                    ) : (
                      <Link
                        href={`/pro/annonces/nouvelle?logement=${encodeURIComponent(logement.id)}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Préparer une annonce
                      </Link>
                    )}
                    <span className={styles.deleteAction}>
                      <ActionConfirmee
                        action={supprimerLogement.bind(null, logement.id)}
                        libelle="Supprimer"
                        variante="danger"
                        varianteDeclencheur="tertiary"
                        titreConfirmation="Supprimer ce logement ?"
                        messageConfirmation="Cette action est définitive. Elle échouera si un bail ou une annonce en cours y est rattaché."
                        libelleConfirmation="Supprimer définitivement"
                      />
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
