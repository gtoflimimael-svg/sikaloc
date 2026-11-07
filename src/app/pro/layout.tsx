/**
 * Le segment `/pro`, qui n'est plus entièrement privé.
 *
 * ─── Pourquoi ce layout ne pose pas de garde ───────────────────────────────
 *
 * Une garde ici protégerait d'un seul geste tout ce qui vit sous `/pro`. Ce
 * serait incorrect : `/pro` est aussi la page de présentation de Sikaloc_Pro,
 * destinée aux visiteurs sans compte.
 *
 * Une garde posée ici rendrait cette présentation inatteignable pour son seul
 * public — exactement la faute déjà commise sur le lien d'invitation du
 * locataire.
 *
 * ─── Où se trouve la protection ────────────────────────────────────────────
 *
 * Le shell privé porte sa garde avant d'afficher l'application ou le guide :
 *
 *     (shell)/layout.tsx      `bailleurOnboarde()` — toute l'application
 *     onboarding/page.tsx     `bailleurCourant()` — l'écran d'installation
 *
 * Les pages opérationnelles conservent aussi `bailleurOnboarde()` comme
 * défense en profondeur. L'onboarding reste hors du shell et peut donc être
 * affiché aux comptes qui n'ont pas encore terminé leur installation.
 *
 * ─── Ce layout subsiste-t-il pour rien ? ────────────────────────────────────
 *
 * Oui : il ne fait que rendre ses enfants. La présentation `/pro` existe et ne
 * s'appuie pas sur lui. Il est laissé en place faute d'avoir tranché son sort ;
 * le supprimer ne changerait rien au rendu, et reste la suite logique.
 */
export default function LayoutEspaceBailleur({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
