import Link from 'next/link'

import { MarqueSikaloc } from '@/components/ui/logo'

const colonnes = [
  {
    titre: 'Produit',
    liens: [
      { libelle: 'Fonctionnalités', href: '/#fonctionnalites' },
      { libelle: 'Tarifs', href: '/#tarifs' },
      { libelle: 'Créer un compte', href: '/inscription' },
      { libelle: 'Se connecter', href: '/connexion' },
    ],
  },
  {
    titre: 'Légal',
    liens: [
      { libelle: 'Politique de confidentialité', href: '/legal/confidentialite' },
      { libelle: "Conditions d'utilisation", href: '/legal/conditions' },
      { libelle: 'Mentions sur les quittances', href: '/legal/conditions#quittances' },
    ],
  },
  {
    titre: 'Aide',
    liens: [
      { libelle: 'Comment ça marche', href: '/#etapes' },
      { libelle: 'Questions fréquentes', href: '/#faq' },
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
              envoyées au locataire sur WhatsApp.
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
