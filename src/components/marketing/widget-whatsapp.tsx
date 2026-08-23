import { normaliserNumero } from '@/lib/whatsapp'

/**
 * Bouton WhatsApp flottant — support avant-vente.
 *
 * Composant serveur : ce n'est qu'un lien, aucun état, aucun JavaScript envoyé
 * au navigateur.
 *
 * ─── Pourquoi il peut ne rien rendre ────────────────────────────────────────
 *
 * Le rapport livre l'URL en dur, `wa.me/229XXXXXXXX`, alors que le numéro
 * n'existe pas encore — il prévoit lui-même d'acheter une puce dédiée. Or un
 * lien vers un numéro invalide n'échoue pas discrètement : WhatsApp affiche
 * « le numéro de téléphone partagé via un lien est invalide ». Un bouton de
 * support qui mène à une erreur détruit exactement la crédibilité qu'il est
 * censé construire — c'est pire que pas de bouton du tout.
 *
 * Le composant lit donc `NEXT_PUBLIC_WHATSAPP_SUPPORT` et ne rend rien tant
 * qu'elle est absente. Le code part en production aujourd'hui ; le bouton
 * apparaît le jour où la variable est renseignée, sans toucher au code. C'est
 * le réflexe déjà tenu ailleurs dans le dépôt pour une dépendance externe non
 * configurée (`src/lib/fedapay.ts` sur `FEDAPAY_SECRET_KEY`).
 *
 * Le numéro passe par `normaliserNumero()` plutôt qu'un formatage réécrit :
 * cette fonction gère déjà l'indicatif béninois, le zéro de tête et le double
 * préfixe.
 */

/**
 * Vert WhatsApp foncé, et non le #25D366 prescrit par le rapport : en blanc
 * sur ce dernier, l'icône tombe à 1,98:1 pour 3:1 exigés par le critère WCAG
 * 1.4.11 (contraste des éléments non textuels). #128C7E est l'autre vert de
 * la marque WhatsApp et monte à 4,14:1 — mesuré, pas estimé.
 */
const VERT_WHATSAPP = '#128C7E'

const MESSAGE = 'Bonjour Sikaloc, j’ai une question sur votre service.'

export function WidgetWhatsApp() {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT?.trim()
  if (!numero) return null

  const lien = `https://wa.me/${normaliserNumero(numero)}?text=${encodeURIComponent(MESSAGE)}`

  return (
    <a
      href={lien}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Poser une question sur WhatsApp"
      style={{ backgroundColor: VERT_WHATSAPP }}
      className="fixed bottom-lg right-lg z-40 inline-flex size-12 items-center justify-center rounded-pill text-white shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95 sm:size-14"
    >
      {/* Glyphe officiel WhatsApp, tracé inline : aucune requête, aucun tiers. */}
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-6 sm:size-7">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  )
}
