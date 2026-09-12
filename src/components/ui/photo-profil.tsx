import { AvatarPeep } from '@/components/ui/avatar-peep'

/**
 * La représentation d'un bailleur — photo réelle si elle existe, avatar sinon.
 *
 * ─── La règle, en un endroit ────────────────────────────────────────────────
 *
 *     SI photo réelle   → photo réelle
 *     SINON             → avatar
 *
 * Elle est écrite ici et nulle part ailleurs. Chaque écran qui représente le
 * bailleur passe par ce composant : c'est la seule façon d'être sûr que la
 * priorité est la même partout, et qu'un avatar ne reprendra jamais la place
 * d'une photo déjà déposée.
 *
 * ─── Pourquoi l'avatar reste ────────────────────────────────────────────────
 *
 * Il n'est pas supprimé, ni déprécié : il représente le bailleur tant qu'il n'a
 * pas de photo, et le représentera de nouveau s'il la retire. La photo prend la
 * première place, elle ne fait pas disparaître le reste.
 *
 * ─── Pourquoi `<img>` et non `next/image` ───────────────────────────────────
 *
 * La photo est servie par `/api/photo`, une route authentifiée sans paramètre.
 * L'optimiseur de Next devrait la rechercher sans cookie de session et recevrait
 * un 401. C'est le même arbitrage que pour `AvatarPeep`.
 */
export function PhotoProfil({
  id,
  nom,
  avatar,
  aPhoto,
  taille = 40,
  className,
}: {
  id: string
  nom: string
  avatar: string | null
  /** Le bailleur a-t-il déposé une photo réelle ? */
  aPhoto: boolean
  taille?: number
  className?: string
}) {
  if (!aPhoto) {
    return <AvatarPeep id={id} avatar={avatar} nom={nom} taille={taille} className={className} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/api/photo"
      alt={`Photo de profil de ${nom}`}
      width={taille}
      height={taille}
      style={{ width: taille, height: taille }}
      className={`shrink-0 rounded-pill object-cover ring-1 ring-hairline ${className ?? ''}`}
    />
  )
}
