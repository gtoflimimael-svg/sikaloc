import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CarteAuth } from '@/components/auth/carte-auth'
import {
  FormulaireCodeEmail,
  FormulaireCodeTelephone,
  FormulaireReprise,
} from '@/components/verification/formulaires'
import { ProgressionVerification } from '@/components/verification/progression'
import { destinationApresVerification } from '@/lib/roles'
import { rolesDuCompte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { creerClientAdmin } from '@/lib/supabase/admin'
import type { Bailleur } from '@/lib/types/database'
import { canauxDisponibles, EXIGENCES_CANAL, verificationTelephoneExigible } from '@/lib/verification/canaux'
import { attenteAvantRenvoi } from '@/lib/verification/otp'
import {
  comptePleinementVerifie,
  masquerEmail,
  masquerTelephone,
} from '@/lib/verification/regles'
import { lireTemoinInvitation, lireTemoinVerification } from '@/lib/verification/temoin'

export const metadata: Metadata = { title: 'Vérification de votre compte' }

/**
 * L'écran unique de vérification du compte.
 *
 * ─── Trois situations, une seule page ───────────────────────────────────────
 *
 *   1. Session ouverte  → l'email est confirmé ; le téléphone ne reste une
 *                         étape que si un fournisseur réel est opérationnel.
 *   2. Pas de session, témoin présent → on sort de l'inscription : saisie du
 *                         code email.
 *   3. Ni l'un ni l'autre → on revient un autre jour : on redemande l'adresse.
 *
 * ─── Pourquoi cette page n'utilise pas `bailleurCourant()` ──────────────────
 *
 * Parce que ce dernier redirige ici tant que la vérification n'est pas faite :
 * l'appeler produirait une boucle. C'est `bailleurNonVerifie()` qu'il faut,
 * l'accès explicitement non gardé — et c'est le seul écran de l'application
 * qui y a droit.
 */
export default async function PageVerification() {
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Situation 2 et 3 : pas de session ────────────────────────────────────
  if (!user) {
    const temoin = await lireTemoinVerification()

    /*
     * Sans session, la base ne dit pas encore de qui il s'agit — le compte
     * existe, mais rien ne permet de le lire tant que l'email n'est pas
     * confirmé.
     *
     * Le témoin d'invitation identifie le parcours locataire, qui ne doit pas
     * recevoir l'étape téléphone réservée au bailleur.
     */
    const invitationEnAttente = Boolean(await lireTemoinInvitation())
    const telephoneExigible = verificationTelephoneExigible() && !invitationEnAttente

    return (
      <CarteAuth
        titre="Vérifiez votre compte"
        description={
          telephoneExigible
            ? 'Confirmez votre adresse email, puis votre numéro de téléphone.'
            : 'Confirmez votre adresse email pour activer votre compte.'
        }
        bas={
          <>
            Déjà vérifié ?{' '}
            <Link href="/connexion" className="font-semibold text-ink underline">
              Se connecter
            </Link>
          </>
        }
      >
        <div className="space-y-xl">
          <ProgressionVerification
            etat={{ emailVerifie: false, telephoneVerifie: false }}
            courante="email"
            telephoneConcerne={telephoneExigible}
          />

          {temoin ? (
            <FormulaireCodeEmail email={temoin} emailMasque={masquerEmail(temoin)} />
          ) : (
            <FormulaireReprise />
          )}
        </div>
      </CarteAuth>
    )
  }

  // ── Situation 1 : session ouverte, donc email confirmé ───────────────────
  //
  // Le profil est lu avec la clé d'administration : `bailleurs` n'accorde au
  // rôle `authenticated` que la lecture de sa propre ligne, ce qui suffirait —
  // mais cette page doit fonctionner même sur un compte que les politiques
  // futures restreindraient davantage. Elle ne lit que les champs utiles à la
  // vérification et à l'aiguillage du compte.
  const admin = creerClientAdmin()
  const { data } = await admin
    .from('bailleurs')
    .select('telephone, telephone_verifie_le, telephone_canal_verification')
    .eq('id', user.id)
    .single()

  const profil = data as Pick<
    Bailleur,
    | 'telephone'
    | 'telephone_verifie_le'
    | 'telephone_canal_verification'
  > | null

  const etat = {
    emailVerifie: Boolean(user.email_confirmed_at),
    telephoneVerifie: Boolean(profil?.telephone_verifie_le),
  }

  /*
   * Ce compte a-t-il seulement une étape téléphone ?
   *
   * L'absence de ligne dans `bailleurs` désigne un compte locataire : il naît
   * d'une invitation, et `prive.gerer_nouvel_utilisateur` lui refuse
   * explicitement un profil bailleur. Son numéro, son bailleur le détient déjà
   * et l'a saisi lui-même — Sikaloc ne le lui redemandera jamais.
   *
   * Sans cette distinction, l'écran pourrait annoncer à un locataire une étape
   * téléphone qui ne viendra pas.
   */
  const compteLocataire = profil === null

  // Un compte non-bailleur et un canal non opérationnel ne peuvent pas imposer
  // une vérification téléphone. La présence de clés seules ne suffit pas.
  const canaux = canauxDisponibles()
  const telephoneExigible = verificationTelephoneExigible() && !compteLocataire

  // ── Tout est fait ────────────────────────────────────────────────────────
  if (comptePleinementVerifie(etat, { telephoneExigible })) {
    redirect(destinationApresVerification(await rolesDuCompte()))
  }

  // ── Reste le téléphone ───────────────────────────────────────────────────
  const attente = await attenteAvantRenvoi(user.id)
  const manquants = Object.fromEntries(
    (['SMS', 'WHATSAPP'] as const)
      .filter((c) => !canaux.includes(c))
      .map((c) => [c, EXIGENCES_CANAL[c]]),
  )

  return (
    <CarteAuth
      titre="Encore une étape"
      description="Votre adresse email est confirmée. Il reste votre numéro de téléphone."
    >
      <div className="space-y-xl">
        <ProgressionVerification
          etat={etat}
          courante="telephone"
          telephoneConcerne={telephoneExigible}
        />

        <FormulaireCodeTelephone
          telephoneMasque={masquerTelephone(profil?.telephone ?? '')}
          attenteInitiale={attente}
          codeEnAttente={attente > 0}
          canauxDisponibles={canaux}
          exigences={manquants}
        />

        {/*
          On peut partir et revenir. Le brief le demande explicitement, et c'est
          juste : personne ne doit rester coincé sur un écran parce qu'il n'a pas
          son téléphone sous la main. Au retour, l'email restera vérifié — il n'y
          aura que cette étape à finir.
        */}
        <p className="text-center text-caption text-mute">
          Vous pouvez revenir plus tard : votre email reste vérifié.{' '}
          <Link href="/connexion" className="underline">
            Quitter
          </Link>
        </p>
      </div>
    </CarteAuth>
  )
}
