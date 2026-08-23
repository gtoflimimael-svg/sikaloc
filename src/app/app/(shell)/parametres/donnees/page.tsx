import { Download } from 'lucide-react'
import type { Metadata } from 'next'

import { EnteteParametre } from '@/components/app/entete-parametre'
import { bailleurOnboarde } from '@/lib/session'

export const metadata: Metadata = { title: 'Paramètres · Mes données' }

/**
 * Écran « Mes données » — export complet.
 *
 * Un simple lien, et non un formulaire : la route répond un fichier, le
 * navigateur le télécharge. Aucun état à gérer, donc aucun composant client,
 * donc rien qui puisse échouer côté navigateur au moment précis où le bailleur
 * a besoin que ça marche.
 */
export default async function PageDonnees() {
  const bailleur = await bailleurOnboarde()

  return (
    <div className="max-w-[46rem]">
      <EnteteParametre cle="donnees" />

      <div className="space-y-lg">
        <div className="card card-lg">
          <h2 className="text-title-lg font-bold text-ink">
            Télécharger une copie de tout
          </h2>
          <p className="mt-sm text-body-md text-body">
            L&apos;archive contient vos paiements, vos quittances et leurs PDF,
            vos logements et vos locataires. Les tableaux s&apos;ouvrent avec
            Excel, LibreOffice ou Google Sheets.
          </p>

          <a
            href="/api/export"
            download
            className="btn btn-primary mt-xl h-auto min-h-10 whitespace-normal py-sm leading-snug"
          >
            <Download size={17} strokeWidth={2} aria-hidden="true" />
            Télécharger mes données
          </a>

          <p className="mt-md text-caption text-mute">
            La préparation peut prendre quelques instants si vous avez beaucoup
            de quittances.
          </p>
        </div>

        <div className="card-sage">
          <p className="text-body-md font-semibold text-ink-deep">
            Vérifier qu&apos;un document n&apos;a pas été modifié
          </p>
          <p className="mt-sm text-body-md text-body">
            Chaque quittance porte une empreinte SHA-256, indiquée dans le
            fichier <strong>quittances.csv</strong> de l&apos;archive. Elle
            permet de démontrer qu&apos;un PDF est bien celui qui a été émis :
            recalculez l&apos;empreinte du fichier et comparez-la à celle
            enregistrée.
          </p>
        </div>

        <p className="text-body-sm text-mute">
          Ce téléchargement reste disponible même si votre abonnement est
          suspendu, et jusqu&apos;à la suppression définitive de votre compte.
          Vous êtes connecté en tant que {bailleur.nom}.
        </p>
      </div>
    </div>
  )
}
