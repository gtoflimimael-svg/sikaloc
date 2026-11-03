# Modifications finales — consolidation locale

Base : `76037c70626c078f34d661d00df047dc321d417c` — branche `codex/consolidation-livraison-3`.

## Code

- `src/components/ui/illustration-marque.tsx` — adaptateur serveur des quatre illustrations éditoriales WebP locales ; images décoratives sans fausse représentation d'un bien disponible.
- `src/components/ui/formulaire-metier.tsx` — retrait de l'étiquette et du pictogramme génériques répétitifs dans le bandeau ; titres, saisie, erreurs, actions et validations inchangés.
- `src/app/pro/(shell)/tableau-de-bord/page.tsx` — illustration d'état vide Sikaloc.
- `src/app/pro/(shell)/logements/page.tsx` — illustration d'état vide Sikaloc.
- `src/app/pro/(shell)/locataires/page.tsx` — illustration d'état vide Sikaloc.
- `src/app/pro/(shell)/baux/page.tsx` — illustration d'état vide Sikaloc.
- `src/app/pro/(shell)/baux/[id]/page.tsx` — illustration d'historique vide Sikaloc.
- `src/app/pro/(shell)/annonces/page.tsx` — illustration d'état vide Sikaloc.
- `src/app/pro/(shell)/annonces/nouvelle/page.tsx` — illustration de contexte sans logement enregistré.
- `src/app/pro/(shell)/paiements/page.tsx` — illustration d'état vide Sikaloc.
- `src/components/ui/illustration.tsx` — supprimé : wrapper exclusivement destiné au SVG Transhumans.
- `src/lib/illustrations/data.ts` — supprimé : tracés SVG générés, environ 708 Ko, uniquement importés par le wrapper retiré.
- `next.config.ts` — commentaire CSP actualisé après suppression du dernier `dangerouslySetInnerHTML` lié aux illustrations. Les usages statiques de `src/app/layout.tsx` restent inchangés.

## Effet de conception et de maintenance

Les états vides concernés partagent maintenant la même famille visuelle que l'accueil et Find/Me, en chargeant des images WebP locales plutôt qu'un gros SVG inline. Le changement ne modifie ni les données, ni les opérations, ni les règles métier. Les avatars de locataires, les visuels de marketing, les photos Find et le logo officiel ne sont pas modifiés.

## Documentation créée / actualisée

- `ETAT-FINAL-SIKALOC.md` : état explicite des 56 routes, sans présenter l'héritage ou les classes partagées comme recette.
- `MODIFICATIONS-FINALES.md` : présent inventaire.
- `REGISTRE-RESERVES.md` : anciennes réserves conservées, suspension des tests et nouveaux changements consignés.
- `DOSSIER-LIVRAISON-SIKALOC.md` : paquet local de passation, configuration nécessaire et points d'arrêt.
- `MATRICE-56-PAGES.md` : ajout d'un addendum reliant le relevé précédent à l'état de cette branche.

## Hors périmètre

Aucune modification de schéma, migration, action serveur, calcul financier, autorisation, Auth, fournisseur externe, maintenance ou donnée existante. Aucun test, build, lint, TypeScript, recette navigateur, push, merge ou déploiement.
