import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { FormulaireProfilCandidat, VerificationTelephoneCandidat } from '@/components/find/candidature'
import { EnTeteFind, PiedDePageFind } from '@/components/find/navigation'
import { Alerte, Badge, EtatVide } from '@/components/ui/retours'
import {
  demanderCodeCandidat,
  enregistrerProfilCandidat,
  verifierCodeCandidat,
} from '@/lib/actions/candidatures'
import { LIBELLES_STATUT_CANDIDATURE, TON_STATUT_CANDIDATURE } from '@/lib/candidatures/messages'
import { formaterDate, formaterFCFA } from '@/lib/format'
import { creerClientServeur, obtenirUtilisateur } from '@/lib/supabase/serveur'
import { canauxDisponibles } from '@/lib/verification/canaux'
import type { CandidatureDuCandidat } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Mes candidatures' }

/**
 * Ce qu'un candidat retrouve : ses candidatures, et son profil.
 *
 * ─── Pourquoi cette page vit HORS du groupe `(espace)` ─────────────────────
 *
 * Le groupe `(espace)` est celui du locataire : sa barre d'onglets mène à ses
 * loyers, ses paiements, son bail, et son pied de page dit « les informations
 * affichées sont celles enregistrées par votre bailleur ». Rien de tout cela
 * n'existe pour un candidat. L'y faire entrer lui promettrait quatre écrans
 * vides — exactement ce que le layout du locataire évite déjà en renvoyant
 * vers l'explication.
 *
 * D'où une page à part, volontairement sobre. Un véritable espace candidat, si
 * le produit en demande un, se décidera plus tard : S8-B ne fait que rendre au
 * candidat ce qu'il a envoyé.
 */
export default async function PageMesCandidatures() {
  const utilisateur = await obtenirUtilisateur()
  if (!utilisateur) redirect('/connexion?suite=%2Fme%2Fcandidatures')

  const supabase = await creerClientServeur()
  const [{ data: profil, error: erreurProfil }, { data: lignes, error: erreurCandidatures }] = await Promise.all([
    supabase.from('candidats').select('nom, telephone, notif_whatsapp, telephone_verifie_le').eq('id', utilisateur.id).maybeSingle(),
    supabase.rpc('mes_candidatures'),
  ])

  const candidatures = (lignes ?? []) as CandidatureDuCandidat[]

  return (
    <div className="flex min-h-screen flex-col bg-canvas-soft">
      <EnTeteFind connecte />

      <main id="contenu" className="app-main flex-1">
        <div className="mx-auto max-w-[900px] space-y-2xl">
          <div>
            <h1 className="page-title">
              Mes candidatures
            </h1>
            <p className="mt-sm text-body-md text-body">
              Le bailleur voit votre nom et votre message. Ni votre téléphone, ni votre email.
            </p>
          </div>

          {erreurCandidatures ? <Alerte ton="erreur">Vos candidatures n’ont pas pu être chargées. Réessayez dans un instant.</Alerte> : candidatures.length === 0 ? (
            <EtatVide
              titre="Aucune candidature"
              description="Parcourez les logements publiés sur Sikaloc_Find : vous pourrez candidater depuis la fiche d’une annonce."
              action={
                <Link href="/find" className="btn btn-primary">
                  Voir les logements
                </Link>
              }
            />
          ) : (
            <ul className="space-y-md">
              {candidatures.map((c) => (
                <li key={c.candidature_id} className="card list-card list-row">
                  <div className="list-copy min-w-0">
                    <p className="text-body-md font-semibold text-ink">
                      {c.annonce_type}
                      {c.annonce_quartier ? ` · ${c.annonce_quartier}` : ''}, {c.annonce_ville}
                    </p>
                    <p className="text-body-sm text-mute">
                      {c.annonce_loyer !== null ? `${formaterFCFA(c.annonce_loyer)} / mois · ` : ''}
                      Réf. {c.reference}
                    </p>
                    <p className="mt-xs text-caption text-mute">
                      Envoyée le {formaterDate(c.deposee_le)}
                      {c.repondue_le ? ` · réponse le ${formaterDate(c.repondue_le)}` : ''}
                    </p>
                  </div>
                  <div className="list-actions">
                    <Badge ton={TON_STATUT_CANDIDATURE[c.statut]}>
                      {LIBELLES_STATUT_CANDIDATURE[c.statut]}
                    </Badge>
                    <Link href={`/find/${c.reference}`} className="btn btn-tertiary btn-sm">
                      Voir l’annonce
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {erreurProfil ? <Alerte ton="erreur">Votre profil n’a pas pu être chargé. Rechargez la page avant de le modifier.</Alerte> : null}
          {profil?.telephone ? (
            <section className="card card-lg">
              <h2 className="section-title">Mon numéro</h2>
              <p className="mt-sm mb-lg text-body-sm text-body">
                Lorsque le canal est disponible, un numéro vérifié et votre accord permettent
                de recevoir les réponses par WhatsApp.
              </p>
              <VerificationTelephoneCandidat
                telephone={profil.telephone}
                verifie={profil.telephone_verifie_le !== null}
                demander={demanderCodeCandidat}
                verifier={verifierCodeCandidat}
                canaux={canauxDisponibles()}
              />
            </section>
          ) : null}

          {!erreurProfil ? <section className="card card-lg">
            <h2 className="section-title">Mon profil</h2>
            <p className="mt-sm mb-lg text-body-sm text-body">
              Ces informations servent à vos candidatures. Vous pouvez les corriger à tout moment.
            </p>
            <FormulaireProfilCandidat
              action={enregistrerProfilCandidat.bind(null, '')}
              nom={profil?.nom}
              telephone={profil?.telephone}
              notifWhatsApp={profil?.notif_whatsapp ?? false}
              libelleSoumission="Enregistrer mon profil"
            />
          </section> : null}
        </div>
      </main>
      <PiedDePageFind />
    </div>
  )
}
