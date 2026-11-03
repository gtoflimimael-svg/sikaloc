import type { Metadata } from 'next'
import { EnteteEditorial } from '@/components/marketing/entete-editorial'
import { notFound, redirect } from 'next/navigation'

import { GestionQuestions } from '@/components/questions/gestion-questions'
import { estAdminQuestions } from '@/lib/questions/admin'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { obtenirUtilisateur } from '@/lib/supabase/serveur'
import type { QuestionVisiteur } from '@/lib/types/database'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Gestion des demandes',
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ statut?: string }>
}

export default async function PageGestionQuestions({ searchParams }: Props) {
  const utilisateur = await obtenirUtilisateur()
  if (!utilisateur) redirect('/connexion?suite=%2Fquestions%2Fgestion')
  if (!estAdminQuestions(utilisateur)) notFound()

  const { statut: filtreRecu } = await searchParams
  const statutsValides = ['nouvelle', 'en_cours', 'repondue'] as const
  const filtre = statutsValides.find((statut) => statut === filtreRecu) ?? 'toutes'
  const serviceConfigure = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
  let data: QuestionVisiteur[] = []
  let erreurChargement = !serviceConfigure

  if (serviceConfigure) {
    const admin = creerClientAdmin()
    let requete = admin
      .from('questions_visiteurs')
      .select('*')
      .order('cree_le', { ascending: false })
      .limit(200)

    if (filtre !== 'toutes') requete = requete.eq('statut', filtre)
    const resultat = await requete
    data = resultat.data ?? []
    erreurChargement = Boolean(resultat.error)
  }

  return (
    <>
      <EnteteEditorial contexte="Espace interne" action={{ href: "/", libelle: "Accueil" }} />
    <main id="contenu" className="questions-admin-page">
      <div className="questions-admin-layout">
        <header className="questions-admin-heading">
          <p className="question-form-eyebrow">Sikaloc · Espace interne</p>
          <h1>Demandes reçues</h1>
          <p>Les coordonnées et messages affichés ici sont réservés aux administrateurs autorisés.</p>
        </header>
        {erreurChargement ? (
          <div className="questions-admin-alert" role="alert">Les demandes ne sont pas accessibles pour le moment. Vérifiez la clé serveur et confirmez que la migration des questions a été appliquée à la base dédiée.</div>
        ) : (
          <GestionQuestions
            questions={data}
            filtre={filtre}
          />
        )}
      </div>
    </main>
    </>
  )
}
