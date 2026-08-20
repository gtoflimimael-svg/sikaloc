'use client'

import { useActionState, useEffect, useState } from 'react'

import { CaptureSignature } from '@/components/app/capture-signature'
import { BoutonSoumettre } from '@/components/ui/boutons'
import {
  ChampCase,
  ChampMontant,
  ChampSelection,
  ChampTexte,
} from '@/components/ui/champs'
import { Alerte } from '@/components/ui/retours'
import { ignorerOnboarding, terminerOnboarding } from '@/lib/actions/onboarding'
import { televerserSignature } from '@/lib/actions/parametres'
import { aujourdhuiISO } from '@/lib/format'
import { TYPES_LOGEMENT } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

type Etape = 1 | 2 | 3 | 4

const TITRES: Record<Etape, { titre: string; aide: string }> = {
  1: {
    titre: 'Votre activité',
    aide: 'Voici ce que nous savons de vous. Ces informations apparaîtront sur vos quittances.',
  },
  2: {
    titre: 'Votre signature',
    aide: 'Elle sera apposée sur chaque quittance. Scannez-la maintenant, ou plus tard depuis vos paramètres.',
  },
  3: {
    titre: 'Votre premier locataire',
    aide: 'Le locataire n’a pas de compte à créer : il recevra ses quittances par WhatsApp.',
  },
  4: {
    titre: 'Votre premier bail',
    aide: 'Dernière étape. Sikaloc en déduit les échéances et détecte les retards tout seul.',
  },
}

/**
 * Assistant en 4 étapes.
 *
 * La signature est demandée ici plutôt qu'au formulaire d'inscription : à ce
 * moment-là, le compte n'existe pas encore et il n'y a donc aucun dossier de
 * stockage où déposer l'image. Elle reste dans le parcours de création de
 * compte, mais après la première ouverture de session.
 *
 * Les étapes 3 et 4 vivent dans un seul <form> : passer de l'une à l'autre
 * masque des champs sans démonter le formulaire, ce qui préserve la saisie si
 * le bailleur revient en arrière. L'étape 2 a son propre formulaire — deux
 * <form> ne peuvent pas s'imbriquer, et la signature s'enregistre séparément.
 */
export function AssistantOnboarding({
  nomBailleur,
  telephoneBailleur,
  emailBailleur,
  nbLogementsDeclare,
  signatureExistante,
}: {
  nomBailleur: string
  telephoneBailleur: string
  emailBailleur: string
  nbLogementsDeclare: number | null
  signatureExistante: boolean
}) {
  const [etape, setEtape] = useState<Etape>(1)
  const [etat, action] = useActionState(terminerOnboarding, ETAT_INITIAL)

  // Une erreur de validation renvoyée par le serveur concerne l'étape 3 ou 4 :
  // on ramène le bailleur là où le champ fautif est visible.
  const champsEtape3 = ['locataireNom', 'locataireTelephone', 'consentement']
  const erreurEnEtape3 =
    etat.erreursChamps &&
    champsEtape3.some((champ) => etat.erreursChamps?.[champ] !== undefined)

  const etapeVisible: Etape = erreurEnEtape3 ? 3 : etat.erreursChamps ? 4 : etape

  return (
    <div>
      <div className="mb-2xl">
        <p className="text-body-sm font-semibold text-primary">
          Étape {etapeVisible} sur 4
        </p>
        <h1 className="mt-xs text-display-md font-extrabold tracking-tight text-ink">
          {TITRES[etapeVisible].titre}
        </h1>
        <p className="mt-sm text-body-md text-mute">{TITRES[etapeVisible].aide}</p>

        <div className="mt-lg flex gap-sm" aria-hidden="true">
          {[1, 2, 3, 4].map((numero) => (
            <span
              key={numero}
              className={`h-1 flex-1 rounded-pill transition-colors duration-300 ${
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
        <div className="card card-lg anim-apparait">
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

      {/* ── Étape 2 — signature ──────────────────────────────────────── */}
      {etapeVisible === 2 ? (
        <EtapeSignature
          dejaEnregistree={signatureExistante}
          onSuivant={() => setEtape(3)}
          onRetour={() => setEtape(1)}
        />
      ) : null}

      {/* ── Étapes 3 et 4 — un seul formulaire ───────────────────────── */}
      <form action={action} className={etapeVisible <= 2 ? 'hidden' : undefined}>
        <div className={etapeVisible === 3 ? 'card card-lg space-y-lg anim-apparait' : 'hidden'}>
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
            <button type="button" onClick={() => setEtape(4)} className="btn btn-primary">
              Continuer
            </button>
            <button type="button" onClick={() => setEtape(2)} className="btn btn-secondary">
              Retour
            </button>
          </div>
        </div>

        <div className={etapeVisible === 4 ? 'card card-lg space-y-lg anim-apparait' : 'hidden'}>
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
            <button type="button" onClick={() => setEtape(3)} className="btn btn-secondary">
              Retour
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function EtapeSignature({
  dejaEnregistree,
  onSuivant,
  onRetour,
}: {
  dejaEnregistree: boolean
  onSuivant: () => void
  onRetour: () => void
}) {
  const [etat, action] = useActionState(televerserSignature, ETAT_INITIAL)

  // L'enregistrement réussi enchaîne : le bailleur n'a pas à confirmer deux
  // fois la même chose.
  useEffect(() => {
    if (etat.succes) onSuivant()
  }, [etat.succes, onSuivant])

  return (
    <div className="space-y-lg anim-apparait">
      {dejaEnregistree ? (
        <Alerte ton="succes">
          Une signature est déjà enregistrée. Vous pouvez la remplacer ou passer à
          la suite.
        </Alerte>
      ) : null}

      <form action={action} className="card card-lg space-y-lg">
        {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
        <CaptureSignature />
      </form>

      <div className="flex flex-wrap gap-md">
        <button type="button" onClick={onSuivant} className="btn btn-tertiary">
          {dejaEnregistree ? 'Continuer' : 'Je la mettrai plus tard'}
        </button>
        <button type="button" onClick={onRetour} className="btn btn-secondary">
          Retour
        </button>
      </div>
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
