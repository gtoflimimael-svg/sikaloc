'use client'

import { useActionState, useState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import {
  ChampCase,
  ChampMontant,
  ChampSelection,
  ChampTexte,
} from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import { ignorerOnboarding, terminerOnboarding } from '@/lib/actions/onboarding'
import { aujourdhuiISO } from '@/lib/format'
import { TYPES_LOGEMENT } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Assistant en 3 étapes.
 *
 * Les deux étapes de saisie vivent dans un seul <form> : passer de l'une à
 * l'autre masque des champs sans démonter le formulaire, ce qui préserve la
 * saisie si le bailleur revient en arrière.
 */
export function AssistantOnboarding({
  nomBailleur,
  telephoneBailleur,
  emailBailleur,
  nbLogementsDeclare,
}: {
  nomBailleur: string
  telephoneBailleur: string
  emailBailleur: string
  nbLogementsDeclare: number | null
}) {
  const [etape, setEtape] = useState<1 | 2 | 3>(1)
  const [etat, action] = useActionState(terminerOnboarding, ETAT_INITIAL)

  // Une erreur de validation renvoyée par le serveur concerne l'étape 2 ou 3 :
  // on ramène le bailleur là où le champ fautif est visible.
  const champsEtape2 = ['locataireNom', 'locataireTelephone', 'consentement']
  const erreurEnEtape2 =
    etat.erreursChamps &&
    champsEtape2.some((champ) => etat.erreursChamps?.[champ] !== undefined)

  const etapeVisible: 1 | 2 | 3 = erreurEnEtape2 ? 2 : etat.erreursChamps ? 3 : etape

  return (
    <div>
      <div className="mb-2xl">
        <p className="text-body-sm font-semibold text-primary">
          Étape {etapeVisible} sur 3
        </p>
        <h1 className="mt-xs text-display-md font-extrabold tracking-tight text-ink">
          {etapeVisible === 1
            ? 'Votre activité'
            : etapeVisible === 2
              ? 'Votre premier locataire'
              : 'Votre premier bail'}
        </h1>
        <p className="mt-sm text-body-md text-mute">
          {etapeVisible === 1
            ? 'Voici ce que nous savons de vous. Ces informations apparaîtront sur vos quittances.'
            : etapeVisible === 2
              ? 'Le locataire n’a pas de compte à créer : il recevra ses quittances par WhatsApp.'
              : 'Dernière étape. Sikaloc en déduit les échéances et détecte les retards tout seul.'}
        </p>

        <div className="mt-lg flex gap-sm" aria-hidden="true">
          {[1, 2, 3].map((numero) => (
            <span
              key={numero}
              className={`h-1 flex-1 rounded-pill ${
                numero <= etapeVisible ? 'bg-primary' : 'bg-hairline'
              }`}
            />
          ))}
        </div>
      </div>

      {etat.erreur ? (
        <div className="mb-lg">
          <Alerte ton="erreur">{etat.erreur}</Alerte>
        </div>
      ) : null}

      {/* ── Étape 1 — récapitulatif ──────────────────────────────────── */}
      {etapeVisible === 1 ? (
        <div className="card card-lg">
          <dl className="space-y-lg">
            <Ligne terme="Nom" definition={nomBailleur} />
            <Ligne terme="Téléphone" definition={telephoneBailleur} />
            <Ligne terme="Email" definition={emailBailleur} />
            <Ligne
              terme="Logements gérés"
              definition={
                nbLogementsDeclare !== null ? String(nbLogementsDeclare) : 'Non précisé'
              }
            />
          </dl>

          <div className="mt-2xl flex flex-wrap gap-md">
            <button type="button" onClick={() => setEtape(2)} className="btn btn-primary">
              Continuer
            </button>
            <form action={ignorerOnboarding}>
              <button type="submit" className="btn btn-secondary">
                Passer cette étape
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Étapes 2 et 3 — un seul formulaire ───────────────────────── */}
      <form action={action} className={etapeVisible === 1 ? 'hidden' : undefined}>
        <div className={etapeVisible === 2 ? 'card card-lg space-y-lg' : 'hidden'}>
          <ChampTexte
            nom="locataireNom"
            libelle="Nom du locataire"
            placeholder="Awa Kponou"
            requis
            erreur={etat.erreursChamps?.locataireNom}
          />
          <ChampTexte
            nom="locataireTelephone"
            libelle="Téléphone du locataire"
            type="tel"
            inputMode="tel"
            placeholder="+229 97 00 00 00"
            aide="C’est à ce numéro que partiront les quittances sur WhatsApp."
            requis
            erreur={etat.erreursChamps?.locataireTelephone}
          />
          <ChampCase
            nom="consentement"
            libelle="J’ai informé ce locataire de la collecte de ses données"
            description="Obligatoire : le locataire doit savoir que son nom et son numéro sont enregistrés dans Sikaloc."
            erreur={etat.erreursChamps?.consentement}
          />

          <div className="flex flex-wrap gap-md pt-sm">
            <button type="button" onClick={() => setEtape(3)} className="btn btn-primary">
              Continuer
            </button>
            <button type="button" onClick={() => setEtape(1)} className="btn btn-secondary">
              Retour
            </button>
          </div>
        </div>

        <div className={etapeVisible === 3 ? 'card card-lg space-y-lg' : 'hidden'}>
          <ChampTexte
            nom="logementAdresse"
            libelle="Adresse du logement"
            placeholder="Lot 42, Quartier Fidjrossè"
            requis
            erreur={etat.erreursChamps?.logementAdresse}
          />

          <div className="grid gap-lg sm:grid-cols-2">
            <ChampTexte
              nom="logementVille"
              libelle="Ville"
              placeholder="Cotonou"
              requis
              erreur={etat.erreursChamps?.logementVille}
            />
            <ChampSelection
              nom="logementType"
              libelle="Type de bien"
              valeurDefaut="Appartement"
              options={TYPES_LOGEMENT.map((t) => ({ valeur: t, libelle: t }))}
              erreur={etat.erreursChamps?.logementType}
            />
          </div>

          <ChampMontant
            nom="loyerMensuel"
            libelle="Loyer mensuel"
            placeholder="60000"
            requis
            erreur={etat.erreursChamps?.loyerMensuel}
          />

          <div className="grid gap-lg sm:grid-cols-2">
            <ChampTexte
              nom="jourEcheance"
              libelle="Jour d'échéance"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              valeurDefaut={5}
              aide="Le jour du mois où le loyer est dû."
              requis
              erreur={etat.erreursChamps?.jourEcheance}
            />
            <ChampTexte
              nom="dateDebut"
              libelle="Date de début du bail"
              type="date"
              valeurDefaut={aujourdhuiISO()}
              requis
              erreur={etat.erreursChamps?.dateDebut}
            />
          </div>

          <div className="flex flex-wrap gap-md pt-sm">
            <BoutonSoumettre libelleEnCours="Création…">
              Terminer et voir mon tableau de bord
            </BoutonSoumettre>
            <button type="button" onClick={() => setEtape(2)} className="btn btn-secondary">
              Retour
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Ligne({ terme, definition }: { terme: string; definition: string }) {
  return (
    <div className="flex items-baseline justify-between gap-lg border-b border-hairline-soft pb-md last:border-0 last:pb-0">
      <dt className="text-body-sm text-mute">{terme}</dt>
      <dd className="text-body-md font-semibold text-ink">{definition}</dd>
    </div>
  )
}
