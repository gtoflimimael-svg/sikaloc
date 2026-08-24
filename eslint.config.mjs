import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * Configuration ESLint — première du projet.
 *
 * Le projet a vécu jusqu'au 24 août 2026 sans aucun contrôle de style ou de
 * correction automatique : `package.json` appelait `next lint`, commande retirée
 * de Next.js 16, et aucun fichier de configuration n'existait. La commande
 * échouait donc silencieusement depuis la mise à jour.
 *
 * Les seuls garde-fous réellement actifs étaient `npm run typecheck` et
 * `npm run build`.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,

  {
    rules: {
      /**
       * Un paramètre préfixé d'un souligné est déclaré inutilisé à dessein.
       *
       * Les Server Actions branchées sur `useActionState` reçoivent l'état
       * précédent en premier argument, que la plupart n'utilisent pas : la
       * signature est imposée, pas choisie. Le souligné est la convention qui
       * le dit, et la règle doit la reconnaître plutôt que la contredire.
       */
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  {
    /**
     * Le générateur de PDF a son propre `<Image>`, homonyme du balisage web
     * mais sans rapport : il n'accepte pas d'attribut `alt`, et une quittance
     * n'est pas une page consultée au lecteur d'écran. La règle vise ici un
     * composant qu'elle a confondu avec une balise HTML.
     */
    files: ['src/lib/pdf/**/*.tsx'],
    rules: { 'jsx-a11y/alt-text': 'off' },
  },

  globalIgnores([
    // Ignorés par défaut d'`eslint-config-next`, à répéter dès qu'on redéfinit
    // la liste.
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',

    // Produit par `npm run generer:objets` : une liste de données, relue en
    // revue mais jamais écrite à la main.
    'src/lib/schema-objets.ts',

    // Types engendrés par la CLI Supabase.
    'src/lib/types/database.ts',

    // Bancs d'essai en CommonJS, exécutés par Node directement et non par
    // Next : ils vivent hors du périmètre applicatif.
    'scripts/**/*.cjs',
    'scripts/**/*.mjs',

    // Outillage du design system et sauvegardes horodatées. `ds-bundle`
    // contient notamment une copie de React, qui pesait à elle seule 1194 des
    // 1269 problèmes du premier passage — du bruit qui aurait enterré les
    // vraies remarques. Ces mêmes dossiers sont déjà écartés du déploiement
    // par `.vercelignore`.
    '.ds-sync/**',
    'ds-bundle/**',
    '.design-sync/**',
    '.design-sync.backup-*/**',
    '.backup-site-*/**',
  ]),
])
