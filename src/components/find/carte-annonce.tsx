import Link from 'next/link'

import { LIBELLES_EQUIPEMENT, libelleChambres } from '@/lib/annonces/libelles'
import { formaterDate, formaterFCFA } from '@/lib/format'
import type { AnnoncePublique, EquipementAnnonce } from '@/lib/types/database'

/**
 * Une annonce dans le catalogue public.
 *
 * Elle ne reçoit qu'une `AnnoncePublique` — la projection de S2 — et ne peut
 * donc rien afficher d'autre : ni adresse, ni bailleur, ni statut. Ce qui
 * n'est pas dans la projection n'existe pas pour elle.
 *
 * Toute la carte mène à la fiche (`/find/[reference]`), par UN seul lien —
 * celui du titre, étendu à la carte par un pseudo-élément. Un lien par zone
 * cliquable aurait fait trois arrêts au clavier pour une seule destination, et
 * un lecteur d'écran aurait lu trois fois la même annonce.
 *
 * `<img>` et non `next/image` : l'optimiseur de Next recompresserait une image
 * déjà réduite et nettoyée (S3), et multiplierait les lectures du coffre.
 */

/** Les équipements qui départagent le plus souvent deux logements, dans cet ordre. */
const EQUIPEMENTS_PRIORITAIRES: EquipementAnnonce[] = [
  'compteur_electrique_individuel',
  'compteur_eau_individuel',
  'douche_interieure',
  'wc_interieur',
  'cuisine_interieure',
  'cour_cloturee',
  'climatisation',
  'parking',
  'gardien',
  'eau_courante',
  'electricite',
]

function disponibilite(disponibleLe: string | null, aujourdhui: string): string {
  if (!disponibleLe || disponibleLe <= aujourdhui) return 'Disponible maintenant'
  return `Disponible le ${formaterDate(disponibleLe)}`
}

export function CarteAnnonce({
  annonce,
  aujourdhui,
  prioritaire = false,
}: {
  annonce: AnnoncePublique
  /** Date du jour, `AAAA-MM-JJ`, fixée une fois par page. */
  aujourdhui: string
  /** Première rangée : l'image se charge sans attendre le défilement. */
  prioritaire?: boolean
}) {
  const logement = libelleChambres(annonce.chambres)
  const lieu = annonce.quartier ? `${annonce.quartier}, ${annonce.ville}` : annonce.ville
  const titre = logement ? `${annonce.type} · ${logement}` : annonce.type
  const equipements = EQUIPEMENTS_PRIORITAIRES.filter((e) => annonce.equipements.includes(e)).slice(0, 3)

  return (
    <article className="card find-card relative flex h-full flex-col overflow-hidden p-0 transition-colors hover:border-hairline-strong has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary">
      <div className="aspect-[4/3] w-full bg-canvas-soft">
        {annonce.photo_position !== null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/find/photo/${annonce.reference}/${annonce.photo_position}`}
            alt={`${titre} à louer — ${lieu}`}
            width={annonce.photo_largeur ?? undefined}
            height={annonce.photo_hauteur ?? undefined}
            loading={prioritaire ? 'eager' : 'lazy'}
            decoding="async"
            className="size-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-sm p-md">
        <p className="text-caption font-medium text-mute">{annonce.type}</p>
        <h2 className="list-copy text-body-lg font-semibold text-ink">
          <Link
            href={`/find/${annonce.reference}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {logement ?? annonce.type}
            <span className="block text-body-sm font-normal text-body">{lieu}</span>
          </Link>
        </h2>

        <p className="flex flex-wrap items-baseline gap-xxs text-body-md text-ink">
          <span className="font-semibold money">{formaterFCFA(annonce.loyer)}</span>
          <span className="text-mute"> / mois</span>
        </p>
        <ul className="space-y-xxs text-body-sm text-body">
          {annonce.charges === 0 ? <li>Sans charges</li> : null}
          {annonce.charges !== null && annonce.charges > 0 ? (
            <li>+ {formaterFCFA(annonce.charges)} de charges par mois</li>
          ) : null}
          {annonce.surface_m2 !== null ? <li>{annonce.surface_m2} m²</li> : null}
          <li>{disponibilite(annonce.disponible_le, aujourdhui)}</li>
        </ul>

        {equipements.length > 0 ? (
          <ul className="flex flex-wrap gap-xs" aria-label="Équipements">
            {equipements.map((e) => (
              <li key={e} className="badge badge-neutral">
                {LIBELLES_EQUIPEMENT[e]}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-auto pt-sm text-caption text-mute">Réf. {annonce.reference}</p>
      </div>
    </article>
  )
}
