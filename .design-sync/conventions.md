# Sikaloc — conventions

Sikaloc est un SaaS de gestion locative pour bailleurs individuels au Bénin.
L'interface est **en français**, les montants en **FCFA**. Identité : canvas
clair lavande, **indigo** `#5c5ccc` pour les actions, surfaces sombres pour les
moments produit denses. Rédigez les libellés en français.

## Setup

Aucun provider, aucun wrapper de thème. Les composants sont du React simple et
tirent leur style de `styles.css` : importez-la une fois et rendez n'importe
quel composant.

Deux choses que la feuille de style impose :

- `body` est peint en `--color-canvas-soft` (`#e8e8f5`). **Ne posez pas une
  page sur du blanc pur** — le blanc n'existe pas dans ce système.
- La profondeur vient du **contraste de surface, pas des ombres**. Séparez avec
  `bg-canvas` / `bg-surface-card` et `border-hairline`, pas avec `shadow-*`.

Les composants dont une prop s'appelle `action` attendent une fonction qui
renvoie une promesse (`async () => ({})` suffit). `ChampTexte`,
`ChampSelection`, `ChampCase` et `ChampMontant` ne sont pas contrôlés : ils
rendent un `<input name=…>` dans un `<form>` — donnez au formulaire son
`action` et lisez les valeurs par `name`.

## Typographie

| Rôle | Famille | Où |
|---|---|---|
| Display | **Copernicus** (serif, 400) | `text-display-*` — appliqué automatiquement |
| Interface et corps | **StyreneB** | tout le reste |
| Code | **JetBrains Mono** | `.code-window-card`, `font-mono` |

Les classes `text-display-mega` → `text-display-sm` basculent seules en serif.
N'ajoutez pas `font-serif` ; et évitez d'empiler `font-extrabold` sur un
display — l'échelle porte déjà son poids (400).

Échelle : `text-display-mega` 80 · `xxl` 64 · `xl` 48 · `lg` 36 · `md` 36 ·
`sm` 28 · `xs` 22 — puis `text-body-lg` 18 · `body-md` 16 · `body-sm` 14 ·
`text-caption` 13 · `text-caption-uppercase` 12 · `text-nav-link` 14 ·
`text-title-lg` 22 · `title-md` 18 · `title-sm` 16 · `text-button` 14 ·
`text-code` 14.

## Vocabulaire de style

Utilitaires Tailwind v4 générés depuis les tokens Sikaloc. **Il n'y a pas
d'échelle de couleurs numérique** — `text-gray-500`, `bg-slate-100` ne sont pas
compilés et ne rendent rien. Utilisez les noms ci-dessous.

**Classes composants** (à composer plutôt que restyler) :

| Famille | Classes |
|---|---|
| Boutons | `btn` + `btn-primary` · `btn-secondary` · `btn-tertiary` · `btn-danger`, modificateurs `btn-sm`, `btn-icon` |
| Champs | `input`, `field-label`, `field-hint`, `field-error` |
| Cartes | `card`, `card-lg`, `card-sage`, `card-dark` |
| Badges | `badge` + `badge-positive` · `badge-warning` · `badge-negative` · `badge-neutral` |
| Tableaux | `data-table` (stylez le `<table>`) |
| Navigation | `sidebar-row`, `sidebar-row-active` |
| Utilitaires | `tabular` (chiffres tabulaires — sur **tout** montant FCFA), `no-scrollbar`, `print-hidden` |

Un bouton s'écrit toujours `className="btn btn-primary"`, jamais `btn` seul.

**Blocs de page** apportés par le nouveau système, sans composant React —
utilisez-les sur un `<div>` : `top-nav`, `hero-band`, `hero-illustration-card`,
`feature-card`, `model-comparison-card`, `connector-tile`,
`product-mockup-card-dark`, `code-window-card`, `cookie-consent-card`,
`pricing-tier-card`, `pricing-tier-card-featured`, `callout-card-coral`,
`cta-band-coral`, `cta-band-dark`, `footer`, `badge-pill`, `badge-coral`,
`category-tab`, `category-tab-active`, `button-secondary-on-dark`, `text-link`.

**Tokens de couleur** — préfixez par `bg-`, `text-`, `border-`, `ring-`,
`fill-`, `stroke-` ; les paliers alpha marchent aussi (`bg-negative/10`) :

- Marque — `primary` `primary-active` `primary-disabled` `on-primary` `accent-teal` `accent-amber`
- Texte — `ink` `body-strong` `body` `muted` `muted-soft` `on-dark` `on-dark-soft`
- Surfaces — `canvas` `canvas-soft` `canvas-sage` `surface-soft` `surface-card` `surface-cream-strong` `surface-elevated` `surface-dark` `surface-dark-elevated` `surface-dark-soft`
- Sémantique — `success` `warning` `error` (alias historiques encore valides : `positive`, `negative`, et leurs variantes `-pale` / `-deep` / `-content` / `-darkest` pour les fonds et textes d'alerte)
- Filets — `hairline` `hairline-soft` `hairline-strong`

`canvas` est la surface haute (cartes, champs) ; `canvas-soft` est le sol de
page ; `surface-card` la carte de contenu. Réservez `primary` aux actions
principales et aux accents majeurs — ne le répandez pas partout.

**Espacements** (`p-` `px-` `m-` `gap-` `space-y-` `w-` `h-`…) : `xxs` 4 ·
`xs` 8 · `sm` 12 · `md` 16 · `lg` 24 · `xl` 32 · `xxl` 48 · `section` 96 px.
L'échelle numérique de Tailwind (`p-4`, `gap-6`) est également compilée et
reste sur le même rythme de 4 px, mais les noms de tokens sont l'idiome.

**Rayons** : `rounded-xs` 4 · `rounded-sm` 6 · `rounded-md` 8 · `rounded-lg` 12
· `rounded-xl` 16 · `rounded-pill`. `rounded-md` pour boutons et champs,
`rounded-lg` pour les cartes.

## Où se trouve la vérité

- `_ds/<dossier>/styles.css` et sa clôture d'`@import` — tous les tokens et classes.
- `components/<groupe>/<Nom>/<Nom>.prompt.md` — usage par composant.
- `components/<groupe>/<Nom>/<Nom>.d.ts` — le contrat de props. Les noms de
  props sont en français (`libelle`, `valeur`, `ton`, `variante`, `taille`,
  `requis`, `aide`).

Groupes : `general` (primitives), `app` (écrans produit), `auth`, `marketing`.

## Exemple idiomatique

```jsx
<div className="min-h-screen bg-canvas-soft p-xl">
  <EnTetePage
    titre="Paiements"
    description="Enregistrez les loyers encaissés et générez les quittances."
    action={<button type="button" className="btn btn-primary">Enregistrer un paiement</button>}
  />

  <div className="grid gap-lg sm:grid-cols-3">
    <CarteMetrique ton="primary" label="Encaissé" valeur="425 000" detail="FCFA ce mois-ci" />
    <CarteMetrique label="Quittances émises" valeur="7" detail="sur 9 baux actifs" />
    <CarteMetrique ton="alerte" label="En retard" valeur="2" detail="depuis plus de 5 jours" />
  </div>

  <div className="mt-xl card">
    <div className="flex items-center justify-between gap-md">
      <div className="flex items-center gap-md">
        <Avatar initiales="AK" />
        <span className="text-body-md font-medium text-ink">Adjoa Kponou</span>
      </div>
      <span className="tabular text-body-md text-ink">75 000 FCFA</span>
      <Badge ton="positive">Payé</Badge>
    </div>
  </div>
</div>
```
