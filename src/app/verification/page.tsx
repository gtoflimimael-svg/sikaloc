import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { CarteAuth } from '@/components/auth/carte-auth'
import {
  FormulaireCodeEmail,
  FormulaireCodeTelephone,
  FormulaireReprise,
} from '@/components/verification/formulaires'
import { ProgressionVerification } from '@/components/verification/progression'
import { destinationApresConnexion } from '@/lib/roles'
import { rolesDuCompte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { creerClientAdmin } from '@/lib/supabase/admin'
import type { Bailleur } from '@/lib/types/database'
import { canauxDisponibles, EXIGENCES_CANAL } from '@/lib/verification/canaux'
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
 *   1. Session ouverte  → l'email est déjà confirmé (GoTrue n'ouvre de session
 *                         qu'à ce moment) : reste le téléphone.
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
     * Le témoin d'invitation, lui, répond : il n'est posé que par
     * `rejoindreAvecInvitation`, c'est-à-dire par un locataire qui vient de
     * créer son compte depuis un lien reçu de son bailleur. Sa présence suffit
     * à savoir qu'aucune étape téléphone ne suivra.
     */
    const invitationEnAttente = Boolean(await lireTemoinInvitation())

    return (
      <CarteAuth
        titre="Vérifiez votre compte"
        description={
          invitationEnAttente
            ? 'Une étape : confirmez votre adresse email.'
            : 'Deux étapes : votre adresse email, puis votre numéro de téléphone.'
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
            telephoneConcerne={!invitationEnAttente}
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
  // futures restreindraient davantage, et elle ne lit que deux colonnes.
  const admin = creerClientAdmin()
  const { data } = await admin
    .from('bailleurs')
    .select('telephone, telephone_verifie_le, telephone_canal_verification')
    .eq('id', user.id)
    .single()

  const profil = data as Pick<
    Bailleur,
    'telephone' | 'telephone_verifie_le' | 'telephone_canal_verification'
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
   * Sans cette distinction, l'écran annonçait à un locataire « Téléphone pas
   * encore vérifié · 1 étape restante » pour une étape qui ne viendrait pas.
   */
  const compteLocataire = profil === null

  // Aucun canal ne peut acheminer un code : l'exigence du téléphone est
  // suspendue, sinon ce compte serait enfermé dehors sans recours. Elle se
  // rétablit d'elle-même dès qu'un fournisseur est branché.
  const canaux = canauxDisponibles()
  const telephoneExigible = canaux.length > 0 && !compteLocataire

  // ── Tout est fait ────────────────────────────────────────────────────────
  if (comptePleinementVerifie(etat, { telephoneExigible })) {
    return (
      <CarteAuth titre="Compte vérifié">
        <div className="space-y-xl">
          <div className="flex items-start gap-md rounded-md border border-positive/30 bg-positive-pale p-lg">
            <CheckCircle2
              size={20}
              strokeWidth={2}
              aria-hidden="true"
              className="mt-xxs shrink-0 text-positive-deep"
            />
            <p className="text-body-sm text-positive-deep">
              {compteLocataire
                ? 'Votre adresse email est confirmée. Votre compte est prêt.'
                : etat.telephoneVerifie
                  ? 'Votre adresse email et votre numéro de téléphone sont confirmés.'
                  : 'Votre adresse email est confirmée. La vérification du numéro sera demandée dès qu’elle sera disponible.'}
            </p>
          </div>

          <ProgressionVerification
            etat={etat}
            courante={null}
            telephoneConcerne={!compteLocataire}
          />

          {/*
            La destination dépend des rôles : un locataire venu d'une
            invitation n'a rien à faire dans l'espace du bailleur, et l'y
            envoyer le ferait rebondir aussitôt.
          */}
          <Link
            href={destinationApresConnexion(await rolesDuCompte())}
            className="btn btn-primary w-full"
          >
            Accéder à Sikaloc
          </Link>
        </div>
      </CarteAuth>
    )
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
        <ProgressionVerification etat={etat} courante="telephone" />

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
