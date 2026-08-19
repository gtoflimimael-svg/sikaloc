# design-sync notes — sikaloc-mvp

This repo is a **Next.js application**, not a published design-system package.
Everything below exists because of that. Nothing here modifies `src/` — the
sync reads the app's real components and stylesheet and adapts around them.

## Layout of the sync scaffolding

- `.design-sync/pkg/` — a **synthetic package root** the converter treats as
  the DS package. It exists because the converter resolves `PKG_DIR` as
  `node_modules/<pkg>` when no `--entry` is given, and `node_modules/sikaloc-mvp`
  never exists (npm won't self-install). It holds `package.json` (with the
  `types` entry the converter needs to find prop contracts), the compiled
  `styles.css`, `fonts.css` + `fonts/`, and the generated `types/` tree.
- `.design-sync/pkg/index.ts` — the bundle + declaration entry, re-exporting
  every component module. **Regenerate it when a component file is added**, or
  the new component silently never ships.
- `.design-sync/shims/` — browser stand-ins for modules that cannot run in a
  static bundle: `next/link` (the real one throws without an App Router
  context), `next/navigation`, and one file per `'use server'` action module.
  Wired in via `.design-sync/tsconfig.sync.json` `paths`, NOT via a lib fork.
- `.design-sync/build-css.mjs` — compiles the app's `src/app/globals.css` into
  the shipped stylesheet. Run it before `package-build.mjs` whenever
  `globals.css` changes.
- `.design-sync/tsconfig.dts.json` — emits the `.d.ts` tree with `tsc`.

## Rebuild sequence

```
node .design-sync/build-css.mjs                                   # globals.css → pkg/styles.css
npx tsc -p .design-sync/tsconfig.dts.json                          # → pkg/types/**
#   then flatten the index (tsc nests it under the rootDir mirror):
sed "s|'\.\./\.\./src/|'./src/|g" \
  .design-sync/pkg/types/.design-sync/pkg/index.d.ts \
  > .design-sync/pkg/types/index.d.ts && rm -rf .design-sync/pkg/types/.design-sync
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle
```

## Gotchas that cost time

- **A `"//"` comment key in `tsconfig.sync.json` breaks the whole path map.**
  The converter strips `//` comments with a regex that also eats a `"//"` JSON
  key, leaving invalid JSON; `tsconfigPathsPlugin` then returns `null`
  *silently* and every stub is bypassed — the failure surfaces far away, as
  esbuild trying to bundle `next/dist/server/**` and `node:crypto`. Keep that
  file comment-free.
- **`--font-inter` must be bound in the shipped CSS.** `next/font` defines it
  on `<html>` at runtime. Nothing does that in a design, and
  `--font-sans: var(--font-inter), 'Inter', …` is invalid at computed-value
  time when it is undefined — so the *entire* font stack drops and pages
  render in the UA serif. `build-css.mjs` appends `:root{--font-inter:'Inter'}`.
- **Inter is shipped from `.next/static/chunks/*.css`**, copied verbatim (35
  `@font-face` rules, 7 woff2 subsets) so designs match the app exactly. If the
  Next build output is cleared, re-run `next build` before re-extracting.
- **The safelist is load-bearing.** Tailwind only compiles classes it *sees*,
  but the design agent writes its own layout glue. `build-css.mjs` safelists
  the full token vocabulary plus Tailwind's default spacing/layout scales.
  Off-brand colours (`text-gray-500`) are deliberately NOT safelisted so
  designs cannot drift off-palette.
- **`EnTeteMobile` is `lg:hidden`.** The validate capture runs wide, so the
  component measured 0px. Its preview renders it inside a phone frame that
  forces `display:flex`, and `cfg.overrides.EnTeteMobile` sets a mobile
  viewport plus `cardMode: column`.
- **Two TS2339 errors in `src/lib/fedapay.ts` appear during the `.d.ts` emit
  but are NOT repo bugs.** `tsconfig.dts.json` sets `strict: false`, which
  turns off `strictNullChecks` and breaks the discriminated-union narrowing
  that file relies on. The repo's own `npm run typecheck` (strict) passes
  clean. Declaration emit is unaffected — ignore those two lines.

## Rebrand indigo (19/08/2026) — porté dans l'app ET le design system

Le design system publié sur claude.ai/design suit désormais
`new_design_sikaloc/DESIGN-Sikaloc.md` (version alpha) : identité indigo
`#5c5ccc`, canvas lavande clair, display serif Copernicus, interface StyreneB,
code JetBrains Mono. **`src/` n'a pas été touché** — le site reste en vert
Inter. C'était la demande explicite.

**Historique.** Le rebrand a d'abord été appliqué au seul design system via une
surcouche, puis porté dans l'application le même jour. `src/app/globals.css`
est donc redevenu LA source de vérité : tokens, échelles et couche composants
en viennent directement, et le design system les reprend par le pipeline
habituel. `.design-sync/theme-sikaloc.css` a été réduit en conséquence — il ne
redéfinit plus rien et ne contient que deux choses :

1. la **liaison des familles de polices** (`--font-styrene: StyreneB`, …). Dans
   l'app, next/font définit ces variables sur `<html>` ; le design system n'a
   pas de runtime Next, et sans ces liaisons `var(--font-styrene)` serait
   indéfini — ce qui invaliderait TOUTE la valeur de `--font-sans` et ferait
   basculer les pages en serif système ;
2. les **classes de page** du document (`feature-card`, `cta-band-dark`,
   `connector-tile`, `pricing-tier-card`…) que l'application n'utilise pas et
   qui n'ont donc pas leur place dans `globals.css`.

Sauvegardes de l'état vert : `.design-sync.backup-20260819-023530/` (design
system) et `.backup-site-20260819-030312/` (`src/`).

**Trois corrections assumées par rapport au .md**, toutes documentées en tête
du fichier de thème :

1. `canvas` `#5c5ccc` → `#f4f4fb`. Le document décrit « tinted cream canvas »,
   « Light canvas — default body floor », et interdit explicitement « Don't
   spread the primary indigo across every element » — mais donne à `canvas` la
   valeur exacte de `primary`. Appliqué littéralement, `top-nav`, `text-input`,
   `button-secondary`, `hero-band` et `pricing-tier-card` viraient tous indigo
   saturé. La valeur retenue prolonge la rampe claire du document
   (`surface-soft #e8e8f5` > `surface-card #dedeef` > `surface-cream-strong
   #d2d2e8`) d'un cran vers le clair.
2. `on-dark` `#5c5ccc` → `#e8e8f5`. Indigo sur `surface-dark #151518` donne un
   contraste de 2,3:1 (échec WCAG AA). Le pied de page et les cartes sombres
   étaient illisibles. La valeur reprend `surface-soft`, soit ~14,9:1.
3. `accent-teal` et `accent-amber` sont **laissés tels quels** malgré des noms
   trompeurs (ce sont des indigos). Ils ne cassent rien ; les corriger aurait
   introduit des couleurs de marque absentes du document, ce qu'il interdit.

**12 tokens historiques sans équivalent** ont été dérivés (repérables par le
commentaire `/* dérivé */` dans le thème) : `primary-pale`, `primary-neutral`,
`primary-on-dark`, `ink-deep`, `canvas-sage`, `surface-elevated`,
`positive-deep`, `warning-deep`, `warning-content`, `warning-pale`,
`negative-deep`, `negative-darkest`, `hairline-strong`. Ils portent les états
d'`Alerte`, `Badge`, `Avatar` et `EtatVide` — sans eux ces composants
perdaient leurs fonds sémantiques.

**Polices — le point le plus fragile.** Les fichiers fournis sont des versions
d'essai qui **ne contiennent que 66 à 74 glyphes** : l'alphabet de base, sans
aucun accent (`é è à ç ê œ`), sans `« »`, sans `—`, sans `€`. Sur une interface
française c'était rédhibitoire. Parade retenue : les familles de marque restent
en tête de chaque pile, et **Inter (déjà embarquée, latin étendu complet) sert
de repli de couverture** pour les caractères manquants ; le display retombe sur
Georgia. Le rendu vérifié en capture est homogène — les accents ne se
remarquent pas. **Fournir les fichiers complets rend ce repli inerte : il
suffit de remplacer les fichiers dans `pkg/fonts/`, sans autre changement.**
L'utilisation commerciale de ces polices a été confirmée par le propriétaire du
projet le 19/08/2026 ; les archives d'origine portaient « Personal Use Only ».

**Marque.** `IconeSikaloc` code ses couleurs en dur dans le SVG
(`fill="#10B981"`). `src/` étant hors périmètre, la marque est repeinte en
indigo par sélecteurs d'attribut en fin de thème — les attributs de
présentation ayant une spécificité nulle, une règle CSS suffit. Si le SVG
source change de valeurs hexadécimales, **ce bloc cesse silencieusement de
fonctionner** et la marque redevient verte.

**Écart site ↔ design system : refermé.** Les maquettes produites par l'agent
correspondent de nouveau au code livrable. Les 34 valeurs hexadécimales hors
`globals.css` ont toutes été reprises : `document-quittance.tsx`,
`emails.ts`, `logo.tsx`, `page.tsx`, `layout.tsx`.

**La quittance PDF garde Helvetica.** `@react-pdf/renderer` n'utilise pas
Tailwind et le fichier documente ce choix (« document qui n'a pas vocation à
être une pièce de marque ») ; Helvetica est intégrée au standard PDF et couvre
tout le latin étendu. Y mettre les polices de marque — dépourvues d'accents —
aurait cassé un document légal français. Seule sa palette a suivi.

**Deux corrections de sémantique induites par le rebrand.** Quand la marque
était verte, `primary-pale` servait à la fois de teinte de marque et de fond
d'alerte « succès ». Ces deux rôles ont divergé : `primary-pale` est redevenu
indigo, `positive-pale` (et `negative-pale`) ont été créés, et
`retours.tsx` pointe l'alerte de succès sur le vert sémantique. De même,
l'accroche marketing utilisait `badge-positive` comme badge de marque : elle
est passée en `badge-neutral`.

**Les montants FCFA sont insécables** (`formaterFCFA` utilise U+00A0). Ils ne
peuvent pas s'enrouler : en Copernicus, plus large qu'Inter, ils débordaient du
mock du tableau de bord de la page d'accueil. Les quatre métriques y sont
passées en `text-title-lg` avec un padding resserré. **À surveiller partout où
un montant vit dans une colonne étroite.**

## Chantier illustration & thèmes (19/08/2026) — design system à resynchroniser

L'application a reçu : les icônes Lucide, les avatars Open Peeps, les
illustrations Transhumans et le mode nuit. **Six composants synchronisés ont
changé** — `navigation.tsx`, `menu-compte.tsx`, `boutons.tsx`,
`formulaire-locataire.tsx`, `parametres.tsx`, `auth/formulaires.tsx` — ainsi que
`globals.css`. Le projet claude.ai/design est donc périmé tant qu'un re-sync
n'a pas tourné.

Trois points à traiter lors de ce re-sync :

- **`lucide-react`** est désormais importé par des composants synchronisés.
  esbuild le résoudra depuis `node_modules` sans configuration, mais il gonflera
  `_ds_bundle.js` — à surveiller.
- **Les avatars passent par une route** (`/avatar/<config>.svg`). Dans les
  cartes du design system, cette route n'existe pas : `AvatarPeep` y affichera
  une image cassée. Deux options — ajouter un stub via `cfg.storyImports`, ou
  neutraliser `AvatarPeep` dans les previews concernées.
- **`Illustration` est un composant serveur** qui inline 690 Ko de tracés. Il ne
  fait pas partie de `componentSrcMap` ; s'il y entrait, il faudrait vérifier
  qu'`esbuild` ne l'embarque pas dans le bundle client du design system.

Quatre composants nouveaux ne sont pas encore synchronisés :
`ui/theme.tsx` (sélecteur clair/nuit), `ui/avatar-peep.tsx`,
`ui/selecteur-avatar.tsx`, `ui/illustration.tsx`. Les ajouter demande une entrée
dans `componentSrcMap` **et** dans `.design-sync/pkg/index.ts`.

**Le mode nuit ne demande rien de particulier** : il ne redéfinit que des
variables CSS, et `styles.css` embarque déjà les deux thèmes. Les cartes du
design system restent rendues en clair, ce qui est le comportement attendu.

## Re-sync risks — what can silently go stale

- **`pkg/index.ts` is a hand-maintained list.** A component added to
  `src/components/**` will NOT be synced until it is added there *and* to
  `componentSrcMap`. Both are enumerations; there is no discovery fallback,
  because the app ships no `.d.ts` of its own.
- **Preview fixtures are inlined copies.** `BandeauAbonnement`,
  `FormulaireProfil` and `FormulairePreferences` embed a literal `Bailleur`
  object cast through `as never`. If that type gains a required field the
  previews still compile (the cast hides it) but may render wrongly — check
  them after any change to `src/lib/types/database.ts`.
- **The action stubs enumerate real export names.** Renaming or adding an
  export in `src/lib/actions/*` requires the matching stub in
  `.design-sync/shims/actions/` to be updated, or the bundle fails to resolve.
- **Group names come from the source directory layout** (`app`, `auth`,
  `marketing`, plus `general` for `src/components/ui`). Doc `category:`
  frontmatter can only override `general`, so finer grouping of the 17 `app`
  components would need a `source-kit.mjs` fork.
- **`theme-sikaloc.css` ne doit jamais redevenir une surcouche de tokens.**
  S'il se remet à redéfinir des variables, `globals.css` cesse silencieusement
  d'être la source de vérité. Il ne doit contenir que la liaison des polices et
  les classes que l'app n'utilise pas.
- **Le repli de couverture des polices dépend d'Inter.** Si les règles
  `@font-face` Inter disparaissent de `pkg/fonts.css`, tous les caractères
  accentués basculent sur la police système, sans avertissement du validateur.
- Toolchain assumed: node 22, Tailwind 4.3.3 via `@tailwindcss/postcss`,
  TypeScript 5.9.3, playwright chromium installed under `.ds-sync/`.
