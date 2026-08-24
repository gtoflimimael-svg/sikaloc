import { urlAvatar } from '@/lib/avatar/config'

/**
 * Avatar Open Peeps — médaillon rond servi par la route `/avatar`.
 *
 * L'image garde son propre fond clair dans les deux thèmes, comme le ferait une
 * photo : c'est ce qui évite d'avoir à produire deux variantes de rendu. Le
 * fond ne s'inverse donc pas en mode nuit, c'est volontaire.
 *
 * Sans `avatar` personnalisé, un avatar stable est dérivé de l'identifiant :
 * aucune ligne existante n'a besoin d'être remplie en base.
 */
export function AvatarPeep({
  id,
  avatar,
  nom,
  taille = 40,
  className = '',
}: {
  id: string
  avatar?: string | null
  nom?: string
  taille?: number
  className?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill ${className}`}
      style={{ width: taille, height: taille, backgroundColor: '#f4f4fb' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- `next/image`
          optimiserait une vignette déjà minuscule, servie par notre propre
          route, en ajoutant une requête et un cache pour rien. */}
      <img
        src={urlAvatar(id, avatar)}
        alt={nom ? `Avatar de ${nom}` : ''}
        aria-hidden={nom ? undefined : true}
        width={taille}
        height={taille}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </span>
  )
}
