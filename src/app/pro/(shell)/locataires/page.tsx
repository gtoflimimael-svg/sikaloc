import type { Metadata } from 'next'
import Link from 'next/link'
import { MoreHorizontal, Plus } from 'lucide-react'

import { BoutonInvitation } from '@/components/app/bouton-invitation'
import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { Alerte } from '@/components/ui/retours'
import { supprimerLocataire } from '@/lib/actions/locataires'
import {
  peutSupprimerLocataire,
  presenterAccesMe,
  presenterSituationLocative,
  type InvitationLocatairePresentation,
} from '@/lib/locataires-presentation'
import { DELAI_RENVOI_SECONDES } from '@/lib/invitations'
import { bailleurOnboarde } from '@/lib/session'
import { formaterTelephone } from '@/lib/telephone'
import { creerClientServeur } from '@/lib/supabase/serveur'
import styles from './locataires.module.css'

export const metadata: Metadata = { title: 'Locataires' }

type BailListe = { id: string; statut: string }
type LocataireListe = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  compte_id: string | null
  baux: BailListe[] | null
}
type InvitationListe = InvitationLocatairePresentation & {
  locataire_id: string
  cree_le: string
}

export default async function PageLocataires() {
  const supabase = await creerClientServeur()
  const [, locatairesReponse] = await Promise.all([
    bailleurOnboarde(),
    // Seuls les champs nécessaires à cette liste sont lus : ni signature,
    // consentement ni autres données personnelles ne sont chargés ici.
    supabase
      .from('locataires')
      .select('id, nom, email, telephone, compte_id, baux(id, statut)')
      .order('nom', { ascending: true }),
  ])

  const { data: locataires, error: erreurLocataires } = locatairesReponse
  const liste = (locataires ?? []) as unknown as LocataireListe[]
  const invitationsParLocataire = new Map<string, InvitationListe>()
  let erreurInvitations = false

  // RLS reste l'autorité. En plus, la lecture ne porte que sur les locataires
  // de cette liste et ne sélectionne jamais l'empreinte du jeton.
  if (!erreurLocataires && liste.length > 0) {
    const { data: invitations, error } = await supabase
      .from('invitations_locataire')
      .select('locataire_id, expire_le, utilisee_le, annulee_le, cree_le')
      .in('locataire_id', liste.map((locataire) => locataire.id))
      .order('cree_le', { ascending: false })

    erreurInvitations = Boolean(error)
    for (const invitation of invitations ?? []) {
      const ligne = invitation as InvitationListe
      if (!invitationsParLocataire.has(ligne.locataire_id)) {
        invitationsParLocataire.set(ligne.locataire_id, ligne)
      }
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Locataires</h1>
        <Link
          href="/pro/locataires/nouveau"
          className={`btn btn-primary ${styles.addAction}`}
          aria-label="Ajouter un locataire"
        >
          Ajouter
          <Plus size={17} strokeWidth={2} aria-hidden="true" />
        </Link>
      </header>

      {erreurLocataires ? (
        <Alerte ton="erreur">
          Les locataires ne peuvent pas être chargés. Actualisez la page pour réessayer.
        </Alerte>
      ) : liste.length === 0 ? (
        <section className={styles.empty} aria-labelledby="empty-tenants-title">
          <h2 id="empty-tenants-title">Ajoutez votre premier locataire.</h2>
        </section>
      ) : (
        <ul className={styles.list} aria-label="Locataires">
          {liste.map((locataire) => {
            const baux = locataire.baux ?? []
            const bauxActifs = baux.filter((bail) => bail.statut === 'Actif')
            const email = locataire.email?.trim() ?? ''
            const telephone = locataire.telephone?.trim() ?? ''
            const accesMe = presenterAccesMe({
              compteLie: Boolean(locataire.compte_id),
              invitation: invitationsParLocataire.get(locataire.id) ?? null,
              erreurChargement: erreurInvitations,
              emailDisponible: Boolean(email),
              delaiRenvoiSecondes: DELAI_RENVOI_SECONDES,
            })
            const contact = email
              ? { valeur: email, href: `mailto:${encodeURIComponent(email)}` }
              : telephone
                ? {
                    valeur: formaterTelephone(telephone),
                    href: `tel:${telephone.replace(/[^\d+]/g, '')}`,
                  }
                : null
            const bailPrincipal =
              bauxActifs.length === 1 ? bauxActifs[0] : baux.length === 1 ? baux[0] : null
            const invitationPrincipale = accesMe.action !== null && Boolean(email)

            return (
              <li key={locataire.id} className={styles.row}>
                <div className={styles.identity}>
                  <h2 className={styles.name}>{locataire.nom}</h2>
                  {contact ? (
                    <a className={styles.contact} href={contact.href}>
                      {contact.valeur}
                    </a>
                  ) : (
                    <span className={styles.contactMissing}>Coordonnée manquante</span>
                  )}
                </div>

                <div className={styles.statuses}>
                  <p className={styles.accessStatus} data-tone={accesMe.ton}>
                    <span className="sr-only">Accès à Sikaloc Me : </span>
                    {accesMe.libelle}
                  </p>
                  <p className={styles.tenancyStatus}>
                    <span className="sr-only">Situation locative : </span>
                    {presenterSituationLocative(baux)}
                  </p>
                </div>

                <div className={styles.actions} role="group" aria-label={`Actions pour ${locataire.nom}`}>
                  {invitationPrincipale ? (
                    <BoutonInvitation
                      locataireId={locataire.id}
                      libelle={accesMe.action === 'renvoyer' ? 'Renvoyer' : 'Inviter'}
                    />
                  ) : bailPrincipal && accesMe.action === null ? (
                    <Link href={`/pro/baux/${bailPrincipal.id}`} className={styles.primaryAction}>
                      Voir le bail
                    </Link>
                  ) : null}

                  <details className={styles.moreActions}>
                    <summary aria-label={`Autres actions pour ${locataire.nom}`}>
                      <MoreHorizontal size={19} strokeWidth={2} aria-hidden="true" />
                    </summary>
                    <div className={styles.actionMenu}>
                      <Link href={`/pro/locataires/${locataire.id}/modifier`} className={styles.menuAction}>
                        Modifier
                      </Link>

                      {accesMe.emailRequis ? (
                        <p className={styles.menuHint}>Ajoutez un e-mail pour l’invitation.</p>
                      ) : null}
                      {accesMe.renvoiTemporise ? (
                        <p className={styles.menuHint}>Patientez avant un nouvel envoi.</p>
                      ) : null}

                      {baux.map((bail, index) => {
                        if (!invitationPrincipale && bail.id === bailPrincipal?.id) return null

                        return (
                          <Link
                            key={bail.id}
                            href={`/pro/baux/${bail.id}`}
                            className={styles.menuAction}
                            aria-label={`Voir le bail ${bail.statut.toLowerCase()} de ${locataire.nom}, ${index + 1} sur ${baux.length}`}
                          >
                            Voir le bail {bail.statut.toLowerCase()}
                          </Link>
                        )
                      })}

                      {peutSupprimerLocataire(baux.length) ? (
                        <div className={styles.destructiveAction}>
                          <ActionConfirmee
                            action={supprimerLocataire.bind(null, locataire.id)}
                            libelle="Supprimer"
                            varianteDeclencheur="tertiary"
                            titreConfirmation={`Supprimer ${locataire.nom} ?`}
                            messageConfirmation="Cette action est définitive."
                            libelleConfirmation="Supprimer définitivement"
                          />
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
