import Link from 'next/link'

import { MarqueSikaloc } from '@/components/ui/logo'
import { mentionsCompletes } from '@/lib/mentions-legales'

const colonnes = [
  {
    titre: 'Produit',
    liens: [
      // Fonctionnalités et tarifs sont ceux de Sikaloc_Pro, le seul espace qui
      // en a : ils vivent sur `/pro`. Pointés vers `/`, ils menaient à une
      // ancre disparue avec l'ancienne page d'accueil.
      //
      // `?presentation=1` : sans lui, `/pro` renvoie un bailleur vérifié vers
      // son tableau de bord, et le fragment, que le serveur ne voit pas, se
      // perd avec. Voir `src/app/pro/page.tsx`.
      { libelle: 'Fonctionnalités', href: '/pro?presentation=1#fonctionnalites' },
      { libelle: 'Tarifs', href: '/pro?presentation=1#tarifs' },
      { libelle: 'Créer un compte', href: '/inscription' },
      { libelle: 'Se connecter', href: '/entrer' },
    ],
  },
  {
    titre: 'Légal',
    liens: [
      { libelle: 'Politique de confidentialité', href: '/legal/confidentialite' },
      { libelle: "Conditions d'utilisation", href: '/legal/conditions' },
      { libelle: 'Mentions sur les quittances', href: '/legal/conditions#quittances' },
      // La page de mentions légales répond 404 tant que l'éditeur n'est pas
      // renseigné : on ne publie pas un lien vers une page qui n'existe pas.
      ...(mentionsCompletes()
        ? [{ libelle: 'Mentions légales', href: '/legal/mentions' }]
        : []),
    ],
  },
  {
    titre: 'Aide',
    liens: [
      // Le pied de page est commun à tout le site : « comment ça marche » y
      // désigne l'écosystème, que la page d'accueil explique en `#parcours`.
      { libelle: 'Comment ça marche', href: '/#parcours' },
      { libelle: 'Trouver un logement', href: '/find' },
      // Le pied de page est là où l'on cherche quand on ne sait pas où aller —
      // et c'est souvent le cas d'un locataire arrivé ici sans rien demander.
      { libelle: 'Je suis locataire', href: '/me/rejoindre' },
      { libelle: 'Le blog', href: '/blog' },
      // La FAQ n'existe que sur `/pro`, où elle a été déplacée avec le reste
      // du contenu bailleur — ses trois questions de locataire comprises.
      { libelle: 'Questions fréquentes', href: '/pro?presentation=1#faq' },
      { libelle: 'Nous écrire', href: 'mailto:bonjour@sikaloc.com' },
    ],
  },
]

export function PiedDePage() {
  return (
    <footer className="bg-surface-dark px-xl py-4xl text-on-dark-mute">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid gap-3xl md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <MarqueSikaloc href={null} surSombre />
            {/* « Outil » a disparu de l'accroche marketing, mais reste dans la
                mention légale ci-dessous, où il est porteur : c'est lui qui
                établit que Sikaloc n'est pas partie au contrat de bail. */}
            <p className="mt-md max-w-[20rem] text-body-sm">
              Les quittances des bailleurs au Bénin. Numérotées, horodatées,
              envoyées par le bailleur au locataire sur WhatsApp.
            </p>
          </div>

          {colonnes.map((colonne) => (
            <div key={colonne.titre}>
              <p className="mb-md text-body-sm font-semibold text-on-dark">
                {colonne.titre}
              </p>
              <ul className="space-y-sm">
                {colonne.liens.map((lien) => (
                  <li key={lien.libelle}>
                    <Link
                      href={lien.href}
                      className="text-body-sm transition-colors hover:text-primary-on-dark"
                    >
                      {lien.libelle}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-3xl border-t border-white/10 pt-xl">
          <p className="text-caption">
            © {new Date().getFullYear()} Sikaloc. Données hébergées en Europe
            (Francfort). Les quittances sont générées sous la responsabilité du
            bailleur ; Sikaloc n&apos;est pas partie au contrat de bail et ne
            fournit aucun conseil juridique.
          </p>
        </div>
      </div>
    </footer>
  )
}
