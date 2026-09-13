import { AlertTriangle } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CarteAuth } from '@/components/auth/carte-auth'
import { FormulaireAcceptation } from '@/components/me/formulaire-acceptation'
import { Alerte } from '@/components/ui/retours'
import { empreinteJeton, MESSAGES_INVITATION, secretPresent } from '@/lib/invitations'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Quand la lecture échoue, on ne dit pas « lien invalide » : le lien est
 * peut-être parfait, et c'est Sikaloc qui n'a pas su répondre.
 */
const MESSAGE_INDISPONIBLE =
  'Nous n’arrivons pas à vérifier cette invitation pour le moment. Réessayez dans quelques minutes.'

export const metadata: Metadata = {
  title: 'Votre invitation',
  // Une invitation n'a rien à faire dans un moteur de recherche.
  robots: { index: false, follow: false },
}

/**
 * L'arrivée d'un locataire dans Sikaloc.
 *
 * ─── Deux situations ────────────────────────────────────────────────────────
 *
 *   déjà connecté   un bouton, et le rattachement se fait
 *   pas de compte   on crée le compte, puis on rattache
 *
 * Le second cas est le plus fréquent : c'est le premier contact de cette
 * personne avec Sikaloc.
 *
 * ─── Ce qu'on montre avant de demander quoi que ce soit ─────────────────────
 *
 * Qui invite, et pour quel logement. Une page qui demanderait un mot de passe
 * sans dire de quoi il retourne ressemble à un piège — et c'est exactement ce
 * qu'on apprend aux gens à ne pas ouvrir.
 *
 * Ces informations sont lues avec la clé d'administration : le visiteur n'a
 * aucune session, et les politiques de `locataires` ne rendent que les lignes
 * du bailleur propriétaire. La lecture est bornée au strict nécessaire — un
 * prénom, un nom de bailleur, une adresse — et n'a lieu que si le jeton
 * présenté correspond à une invitation réellement valable.
 */
export default async function PageInvitation({
  params,
}: {
  params: Promise<{ jeton: string }>
}) {
  const { jeton } = await params

  if (!secretPresent()) return <Refus message={MESSAGES_INVITATION.introuvable} />

  const admin = creerClientAdmin()
  const { data: invitation, error } = await admin
    .from('invitations_locataire')
    .select(
      // `!bailleur_id` désambiguïse : la table porte DEUX clés vers
      // `bailleurs` — celle du propriétaire et celle de l'auteur de
      // l'invitation. Sans ce guide, PostgREST refuse de choisir et échoue
      // sur « more than one relationship was found ».
      'id, email, expire_le, utilisee_le, annulee_le, locataire:locataires(nom, compte_id), bailleur:bailleurs!bailleur_id(nom)',
    )
    .eq('empreinte', empreinteJeton(jeton))
    .maybeSingle()

  // Une erreur de lecture n'est PAS une invitation introuvable. Les confondre
  // transformait un défaut de requête en « votre lien n'est pas valable » — et
  // renvoyait un locataire vers son bailleur pour rien. C'est exactement ce qui
  // s'est produit avec l'ambiguïté ci-dessus, découverte en ouvrant la page.
  if (error) return <Refus message={MESSAGE_INDISPONIBLE} />

  if (!invitation) return <Refus message={MESSAGES_INVITATION.introuvable} />
  if (invitation.utilisee_le) return <Refus message={MESSAGES_INVITATION.deja_utilisee} />
  if (invitation.annulee_le) return <Refus message={MESSAGES_INVITATION.annulee} />
  if (new Date(invitation.expire_le) < new Date()) {
    return <Refus message={MESSAGES_INVITATION.expiree} />
  }

  const locataire = premier(invitation.locataire) as { nom: string; compte_id: string | null } | null
  const bailleur = premier(invitation.bailleur) as { nom: string } | null

  // Déjà rattaché à quelqu'un : on ne propose rien, et on ne dit pas à qui.
  if (locataire?.compte_id) {
    const supabase = await creerClientServeur()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Sauf si c'est le même compte — alors le lien a simplement été rouvert.
    if (user?.id === locataire.compte_id) redirect('/me')

    return <Refus message={MESSAGES_INVITATION.deja_rattache} />
  }

  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <CarteAuth
      titre="Votre espace locataire"
      description={`${bailleur?.nom ?? 'Votre bailleur'} vous invite à suivre votre logement sur Sikaloc_Me.`}
    >
      <div className="space-y-xl">
        <div className="rounded-md border border-hairline bg-canvas-soft p-lg">
          <dl className="space-y-sm text-body-sm">
            <Ligne terme="Invitation de" definition={bailleur?.nom ?? '—'} />
            <Ligne terme="Pour" definition={locataire?.nom ?? '—'} />
            <Ligne terme="Adresse email" definition={invitation.email} />
          </dl>
        </div>

        <FormulaireAcceptation
          jeton={jeton}
          email={invitation.email}
          nom={locataire?.nom ?? ''}
          dejaConnecte={Boolean(user)}
          memeAdresse={user?.email?.toLowerCase() === invitation.email.toLowerCase()}
          emailConnecte={user?.email ?? null}
        />

        <p className="text-caption text-mute">
          Vous ne connaissez pas {bailleur?.nom ?? 'cette personne'} ? N’acceptez
          pas cette invitation, et ignorez le message qui vous l’a transmise.
        </p>
      </div>
    </CarteAuth>
  )
}

function Ligne({ terme, definition }: { terme: string; definition: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-sm">
      <dt className="text-mute">{terme}</dt>
      <dd className="font-semibold text-ink">{definition}</dd>
    </div>
  )
}

function Refus({ message }: { message: string }) {
  return (
    <CarteAuth titre="Invitation non valable">
      <div className="space-y-xl">
        <Alerte ton="attention">
          <span className="flex items-start gap-sm">
            <AlertTriangle size={17} strokeWidth={2} aria-hidden="true" className="mt-xxs shrink-0" />
            {message}
          </span>
        </Alerte>

        <p className="text-body-sm text-mute">
          Les invitations ont une durée de vie limitée et ne servent qu’une fois.
          Votre bailleur peut vous en envoyer une nouvelle depuis sa fiche.
        </p>

        <Link href="/me/rejoindre" className="btn btn-secondary w-full">
          Comment ça marche ?
        </Link>
      </div>
    </CarteAuth>
  )
}

function premier<T>(valeur: T | T[] | null): T | null {
  if (Array.isArray(valeur)) return valeur[0] ?? null
  return valeur
}
