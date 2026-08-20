import type { Metadata } from 'next'

import { EnteteParametre } from '@/components/app/entete-parametre'
import { LienParrainageCopiable } from '@/components/app/parametres'
import { Badge } from '@/components/ui/retours'
import { formaterDateCourte } from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { lienParrainage } from '@/lib/whatsapp'

export const metadata: Metadata = { title: 'Paramètres · Parrainage' }

export default async function PageParrainage() {
  const supabase = await creerClientServeur()

  const [bailleur, { data: recompenses }] = await Promise.all([
    bailleurOnboarde(),
    supabase.from('recompenses_parrainage').select('*').order('attribuee_le', { ascending: false }),
  ])

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const lienInscription = `${base}/inscription?parrain=${bailleur.code_parrainage}`

  return (
    <div className="max-w-[46rem]">
      <EnteteParametre cle="parrainage" />

      <div className="space-y-xl">
        <div className="card-sage">
          <p className="text-display-xs font-semibold text-ink-deep">
            Parrainez un bailleur, gagnez 1 mois
          </p>
          <p className="mt-sm text-body-md text-body">
            Vous et votre filleul recevez chacun 1 mois offert dès sa première
            souscription payante.
          </p>
        </div>

        <div className="card card-lg space-y-lg">
          <div>
            <p className="field-label">Votre code de parrainage</p>
            <p className="text-display-sm font-extrabold tracking-tight text-primary">
              {bailleur.code_parrainage}
            </p>
          </div>

          <div>
            <p className="field-label">Votre lien d&apos;invitation</p>
            <LienParrainageCopiable lien={lienInscription} />
          </div>

          <a
            href={lienParrainage(lienInscription, bailleur.nom)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Partager sur WhatsApp
          </a>
        </div>

        <div>
          <h2 className="mb-lg text-display-xs font-semibold text-ink">Vos filleuls</h2>
          {(recompenses ?? []).length === 0 ? (
            <p className="rounded-xl bg-canvas-soft p-xl text-body-md text-mute">
              Aucun filleul n&apos;a encore souscrit. Les mois offerts apparaîtront
              ici.
            </p>
          ) : (
            <ul className="space-y-sm">
              {(recompenses ?? []).map((recompense) => (
                <li
                  key={recompense.id}
                  className="flex items-center justify-between gap-md rounded-lg border border-hairline bg-canvas px-lg py-md"
                >
                  <span className="text-body-sm text-body">
                    Filleul inscrit · {formaterDateCourte(recompense.attribuee_le)}
                  </span>
                  <Badge ton="positive">+{recompense.mois_offerts} mois offert</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
