import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EDITEUR, HEBERGEURS, mentionsCompletes } from '@/lib/mentions-legales'

export const metadata: Metadata = { title: 'Mentions légales' }

/**
 * Mentions légales.
 *
 * La page répond 404 tant que `EDITEUR` n'est pas entièrement renseigné dans
 * `src/lib/mentions-legales.ts`. Publier une page de mentions incomplète
 * donnerait l'apparence d'une conformité qu'elle n'aurait pas — ce qui est pire
 * que l'absence de page.
 *
 * Le pied de page n'affiche le lien que lorsque la page existe : aucun lien mort
 * ne peut apparaître par ce biais.
 */
export default function PageMentions() {
  if (!mentionsCompletes()) notFound()

  return (
    <div className="space-y-xl">
      <header>
        <h1 className="text-display-md font-extrabold tracking-tight text-ink">
          Mentions légales
        </h1>
        <p className="mt-sm text-body-sm text-mute">
          Informations relatives à l&apos;éditeur et à l&apos;hébergement du site
          sikaloc.com.
        </p>
      </header>

      <Section titre="1. Éditeur du site">
        <dl className="space-y-sm">
          <Ligne etiquette="Dénomination" valeur={EDITEUR.denomination} />
          <Ligne etiquette="Forme juridique" valeur={EDITEUR.formeJuridique} />
          <Ligne etiquette="Siège" valeur={EDITEUR.adresse} />
          <Ligne
            etiquette="Immatriculation"
            valeur={
              EDITEUR.immatriculation === false
                ? 'Activité non immatriculée à ce jour'
                : EDITEUR.immatriculation
            }
          />
          <Ligne etiquette="Directeur de la publication" valeur={EDITEUR.directeurPublication} />
          <Ligne etiquette="Contact" valeur={EDITEUR.email} />
          {EDITEUR.telephone !== false ? (
            <Ligne etiquette="Téléphone" valeur={EDITEUR.telephone} />
          ) : null}
        </dl>
      </Section>

      <Section titre="2. Hébergement">
        <p>
          Le site et les données qu&apos;il traite sont hébergés par les
          prestataires suivants :
        </p>
        <ul>
          {HEBERGEURS.map((h) => (
            <li key={h.nom}>
              <strong className="font-semibold text-ink">{h.role}</strong> — {h.nom},{' '}
              {h.adresse}. {h.precision}
            </li>
          ))}
        </ul>
      </Section>

      <Section titre="3. Nature du service">
        <p>
          Sikaloc est un outil de gestion locative. Il produit des documents à
          partir des informations saisies par le bailleur. Il n&apos;est pas partie
          aux contrats de bail, ne fournit aucun conseil juridique, fiscal ou
          comptable, et ne se substitue pas à l&apos;avis d&apos;un professionnel.
        </p>
        <p>
          Les conditions applicables figurent dans les{' '}
          <Link href="/legal/conditions" className="font-semibold text-ink underline">
            conditions d&apos;utilisation
          </Link>
          , et le traitement des données personnelles dans la{' '}
          <Link href="/legal/confidentialite" className="font-semibold text-ink underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </Section>

      <Section titre="4. Propriété intellectuelle">
        <p>
          La marque Sikaloc, le logo, les textes et l&apos;interface du site sont
          la propriété de l&apos;éditeur. Les documents produits par le service —
          quittances, reçus, exports — appartiennent au bailleur qui les a
          générés.
        </p>
      </Section>

      <Section titre="5. Signalement">
        <p>
          Pour signaler un contenu, une erreur ou un dysfonctionnement, écrivez à{' '}
          {EDITEUR.email}. Toute demande relative à vos données personnelles est
          traitée selon la procédure décrite dans la politique de confidentialité.
        </p>
      </Section>
    </div>
  )
}

function Ligne({ etiquette, valeur }: { etiquette: string; valeur: string | null }) {
  if (!valeur) return null

  return (
    <div className="flex flex-col gap-xxs sm:flex-row sm:gap-md">
      <dt className="shrink-0 font-semibold text-ink sm:w-[14rem]">{etiquette}</dt>
      <dd>{valeur}</dd>
    </div>
  )
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-display-xs font-semibold text-ink">{titre}</h2>
      <div className="mt-md space-y-md text-body-md leading-relaxed text-body [&_li]:ml-lg [&_li]:list-disc [&_ul]:space-y-sm">
        {children}
      </div>
    </section>
  )
}
