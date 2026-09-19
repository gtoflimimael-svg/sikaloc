/**
 * Le segment `/pro`, qui n'est plus entièrement privé.
 *
 * ─── Ce que ce layout gardait, et pourquoi il ne le garde plus ──────────────
 *
 * Il appelait `bailleurCourant()`, ce qui protégeait d'un seul geste tout ce
 * qui vit sous `/pro`. C'était juste tant que `/pro` était le tableau de bord.
 *
 * Ça ne l'est plus : `/pro` est la page de présentation de Sikaloc_Pro
 * (`src/app/pro/page.tsx`), qui s'adresse à quelqu'un qui n'a pas de compte.
 * Une garde posée ici la rendrait inatteignable pour son seul public —
 * exactement la faute déjà commise sur le lien d'invitation du locataire.
 *
 * ─── Où la protection est passée : nulle part, elle y était déjà ────────────
 *
 * Aucune garde n'a été déplacée, parce qu'aucune n'a été perdue. Les deux
 * sous-arbres de `/pro` portaient déjà la leur, et la portent encore :
 *
 *     (shell)/layout.tsx      `bailleurCourant()` — toute l'application
 *     onboarding/page.tsx     `bailleurCourant()` — l'écran d'installation
 *
 * S'y ajoute, sur chaque page, le `bailleurOnboarde()` qui exige en plus un
 * onboarding terminé. La garde retirée ici était un troisième tour de clé sur
 * une porte qui en avait déjà deux.
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
