# Sikaloc — état final de consolidation locale

Date : 21 octobre 2026  
Branche : `codex/consolidation-livraison-3`  
Base : `76037c70626c078f34d661d00df047dc321d417c`

## Synthèse

Cette branche conserve les lots précédents et apporte une consolidation ciblée : les illustrations SVG Transhumans utilisées comme grands états vides Pro sont remplacées par les quatre illustrations éditoriales Sikaloc locales. Le module SVG monolithique (environ 708 Ko de source) et son composant dédié ont été retirés après constat de leurs seuls usages directs dans ces états vides. Les avatars de profil Open Peeps restent séparés : ils sont un mécanisme d'avatar existant, pas une illustration marketing, et n'ont pas été modifiés.

Les 30 pages Pro avaient reçu des modifications individuelles dans le commit de base `76037c7`; huit pages Pro sont également touchées dans cette consolidation pour le remplacement des illustrations. Cela ne constitue ni une nouvelle refonte de chacune des 30 pages, ni une preuve de bon rendu. Les 26 autres pages proviennent des lots précédents ; aucune inspection navigateur n'a été réalisée dans cette intervention.

Le document officiel `DESIGN-sikaloc.md`, le registre `PAGES-sikaloc (1).md` et `PHASE-3-EXECUTION-sikaloc.md` ont été consultés depuis le dossier Téléchargements. Les décisions existantes sont conservées : vert Sikaloc `#B8F36D`, encre `#111810`, vert profond `#17311C`, sauge `#EAF1E7`, blanc ; Inter pour l'interface et Manrope pour les grands titres lorsque disponible. Le kit ZIP du logo n'est pas présent dans le dépôt ; les SVG officiels déjà versionnés sous `public/marque/` sont conservés.

## État des 56 routes

« Code ciblé » décrit le travail de code antérieur présent à la base ; « non vérifié » signifie qu'aucune recette visuelle ou fonctionnelle n'est revendiquée. Dans cette intervention, aucune page n'a été observée dans un navigateur.

| Route | État de code à la base / consolidation | Visuel | Fonctionnel |
|---|---|---|---|
| `/` | Fondations publiques antérieures conservées | Non vérifié | Non vérifié |
| `/pro` | Présentation et captures antérieures conservées | Non vérifié | Non vérifié |
| `/blog` | Page antérieure conservée | Non vérifié | Non vérifié |
| `/blog/[slug]` | Page antérieure conservée | Non vérifié | Non vérifié |
| `/guide/confirmer` | Parcours antérieur conservé | Non vérifié | Non vérifié |
| `/guide/desinscription` | Parcours antérieur conservé | Non vérifié | Non vérifié |
| `/legal/conditions` | Texte légal préservé | Non vérifié | Non vérifié |
| `/legal/confidentialite` | Texte légal préservé | Non vérifié | Non vérifié |
| `/legal/mentions` | Texte légal préservé | Non vérifié | Non vérifié |
| `/connexion` | Auth antérieure conservée | Non vérifié | Non vérifié |
| `/entrer` | Auth antérieure conservée | Non vérifié | Non vérifié |
| `/inscription` | Auth antérieure conservée | Non vérifié | Non vérifié |
| `/mot-de-passe-oublie` | Auth antérieure conservée | Non vérifié | Non vérifié |
| `/reinitialiser-mot-de-passe` | Auth antérieure conservée | Non vérifié | Non vérifié |
| `/verification` | Auth antérieure conservée | Non vérifié | Non vérifié |
| `/find` | Catalogue antérieur conservé | Non vérifié | Non vérifié |
| `/find/[reference]` | Fiche antérieure conservée | Non vérifié | Non vérifié |
| `/find/[reference]/candidater` | Candidature antérieure conservée | Non vérifié | Non vérifié |
| `/me` | Tableau locataire antérieur conservé | Non vérifié | Non vérifié |
| `/me/bail` | Page antérieure conservée | Non vérifié | Non vérifié |
| `/me/loyers` | Page antérieure conservée | Non vérifié | Non vérifié |
| `/me/paiements` | Page antérieure conservée | Non vérifié | Non vérifié |
| `/me/preferences` | Page antérieure conservée | Non vérifié | Non vérifié |
| `/me/candidatures` | Page antérieure conservée | Non vérifié | Non vérifié |
| `/me/rejoindre` | Page antérieure conservée | Non vérifié | Non vérifié |
| `/me/invitation/[jeton]` | Parcours antérieur conservé | Non vérifié | Non vérifié |
| `/pro/tableau-de-bord` | Modification ciblée antérieure ; illustration vide Sikaloc substituée | Non vérifié | Non vérifié |
| `/pro/impayes` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/logements` | Modification ciblée antérieure ; illustration vide Sikaloc substituée | Non vérifié | Non vérifié |
| `/pro/logements/nouveau` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/logements/[id]/modifier` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/locataires` | Modification ciblée antérieure ; illustration vide Sikaloc substituée | Non vérifié | Non vérifié |
| `/pro/locataires/nouveau` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/locataires/[id]/modifier` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/baux` | Modification ciblée antérieure ; illustration vide Sikaloc substituée | Non vérifié | Non vérifié |
| `/pro/baux/nouveau` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/baux/[id]` | Modification ciblée antérieure ; illustration vide Sikaloc substituée | Non vérifié | Non vérifié |
| `/pro/baux/[id]/modifier` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/baux/[id]/historique` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/annonces` | Modification ciblée antérieure ; illustration vide Sikaloc substituée | Non vérifié | Non vérifié |
| `/pro/annonces/nouvelle` | Modification ciblée antérieure ; illustration vide Sikaloc substituée | Non vérifié | Non vérifié |
| `/pro/annonces/[id]` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/annonces/[id]/candidatures` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/paiements` | Modification ciblée antérieure ; illustration vide Sikaloc substituée | Non vérifié | Non vérifié |
| `/pro/paiements/nouveau` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/paiements/[id]/modifier` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/paiements/[id]/confirmer` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/quittances/[id]` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/onboarding` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/parametres` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/parametres/profil` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/parametres/preferences` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/parametres/signature` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/parametres/abonnement` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/parametres/parrainage` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |
| `/pro/parametres/donnees` | Modification ciblée antérieure conservée | Non vérifié | Non vérifié |

**Bilan :** 56 routes répertoriées ; 8 pages Pro ont reçu le changement direct d'illustration dans cette branche. Le lot visuel précédent a modifié directement les 30 fichiers de page Pro, tandis que les autres pages relèvent principalement des lots antérieurs et de composants partagés. Cette description n'est pas une déclaration d'achèvement visuel.

## Identité, composants et ressources

- Palette et tokens du design system maintenus ; aucun système parallèle créé.
- Logo officiel et cinq WebP éditoriaux existants conservés.
- Nouvel adaptateur `IllustrationMarque` pour réutiliser les WebP locaux dans les états vides Pro.
- Bandeau commun des formulaires simplifié : le titre métier reste seul, sans étiquette générique ni icône décorative répétée.
- Images `home-01` à `home-04` observées comme illustrations d'architecture abstraite, non comme annonces.
- Ancien SVG inline Transhumans retiré de ces états vides ; le générateur de tracés de 708 Ko n'est plus embarqué par ces pages.
- Avatars Open Peeps de l'application non modifiés, car distincts des illustrations éditoriales et utilisés comme mécanisme d'avatar ; leur remplacement éventuel doit être décidé séparément.
- Pas de nouvelle illustration ni capture applicative produite.

## Non implémenté / non vérifié

- Pas de revue visuelle navigateur, pas de parcours fonctionnel, pas de vérification des largeurs, du clavier, du zoom ou de l'accessibilité.
- Aucune validation des migrations, de PostgreSQL, de RLS ou des flux financiers dans cette intervention.
- Pas de capture Pro authentique récente ; les anciennes captures restent à distinguer et remplacer avant leur usage comme preuve produit.
- La suite des réserves et les conditions de publication figurent dans `REGISTRE-RESERVES.md` et `DOSSIER-LIVRAISON-SIKALOC.md`.
