# Direction photographique Sikaloc

Registre de référence pour les photographies éditoriales et les illustrations de marque. Mis à jour le 24 octobre 2026.

Cette directive porte sur la photographie, pas sur les tokens UI. `design.md` est présent mais daté du 16 octobre 2026 et décrit encore l'ancienne identité indigo/Copernicus/Styrene ; ne pas le traiter comme la référence de la direction visuelle actuelle sans actualisation séparée. Pour les nouvelles images, la cohérence avec la marque validée prime sur une uniformisation des couleurs : lumière et matériaux naturels, avec les accents Sikaloc (`#17311C`, `#B8F36D`, `#EAF1E7`) utilisés seulement lorsqu'ils appartiennent naturellement à la scène.

## Règles permanentes

- Une photographie éditoriale active appartient à un seul emplacement de page/section. Ne pas réutiliser le même fichier sur une autre page.
- Vérifier aussi le récit : changer de modèle ou de tenue ne suffit pas si l'action, la posture et le cadrage restent identiques.
- Chaque image sert une fonction précise : gestion et responsabilité pour Pro, vie quotidienne et autonomie pour Me, découverte et choix pour Find.
- Garder une cohérence de qualité (lumière naturelle, matériaux crédibles, diversité des cadrages) sans uniformiser les scènes ni imposer du vert dans chaque image.
- Les images générées sont des illustrations éditoriales, pas des photographies de vrais clients, bailleurs, logements proposés ou transactions. Les textes alternatifs et leur contexte ne doivent pas laisser croire le contraire.
- Pour chaque asset : conserver un nom descriptif, une taille adaptée, un ratio compatible avec son emplacement, une alternative textuelle utile et une optimisation WebP lorsque pertinent.
- Contrôler le cadrage à la taille réelle, sur mobile et desktop, avant de valider une nouvelle image. Mettre à jour ce registre au moment de son intégration.

## Exceptions fonctionnelles

L'unicité éditoriale ne s'applique pas aux éléments réutilisés pour leur fonction : logotype et icônes officiels, illustrations d'états vides du design system, captures de produit lorsqu'elles documentent la même interface, variantes responsive d'un même emplacement, et photos réelles d'un même logement dans son annonce, sa carte et sa fiche.

Les images d'annonces Find sont servies par les routes internes `/find/photo/<référence>/<position>` et `/api/annonces/photos/<id>`. Elles sont liées à un logement réel ou de démonstration et ne sont pas des assets éditoriaux de ce registre. Ne pas les remplacer ni dissocier les images d'une carte de celles de sa fiche.

## Audit et état actuel

L'audit visuel a porté sur les 9 photographies éditoriales initiales, les 7 illustrations de `public/illustrations/` et les 9 nouveaux WebP générés, soit 25 assets visuellement inspectés. Les sommes SHA-256 des 16 fichiers photo/illustration présents avant les nouveaux assets étaient toutes différentes, et une vérification des 25 assets après intégration n'a trouvé aucun doublon binaire exact. Une recherche des références dans le code a révélé 5 placements répétés sur 3 sources photographiques, ainsi que 4 paires narratives trop proches.

Après intégration, les 14 emplacements photographiques éditoriaux actifs ci-dessous ont chacun un fichier unique. Les quatre anciennes photographies remplacées restent dans le dépôt, non référencées, pour éviter une suppression inutile ; ne pas les réutiliser sans nouvel examen.

| Emplacement | Fichier actif | Sujet et fonction narrative |
|---|---|---|
| Accueil — Pro | `public/images/home/sikaloc-pro-editorial.webp` | Propriétaire assise à une table avec ordinateur : gestion locative numérique. |
| Accueil — Me | `public/images/home/sikaloc-me-editorial.webp` | Locataire détendue sur un canapé, téléphone en main : consultation personnelle au quotidien. |
| Accueil — Find | `public/images/home/sikaloc-find-editorial.webp` | Couple visitant un appartement et découvrant la vue : choix d'un logement. |
| Page `/pro` — hero | `public/images/pro/sikaloc-pro-hero.webp` | Propriétaire dans une cour résidentielle, en observation du bien. |
| Page `/pro` — organisation | `public/images/pro/sikaloc-pro-organisation-corridor.webp` | Couloir partagé avec plusieurs entrées distinctes : organisation des biens, sans personnage ni écran. |
| Page `/pro` — paiements | `public/images/pro/sikaloc-pro-paiements.webp` | Échange entre bailleur et locataire au seuil du logement : relation locative. |
| Inscription Pro | `public/images/pro/sikaloc-pro-inscription-property-review.webp` | Propriétaire évaluant la lumière d'un logement encore peu meublé : préparation d'une location. |
| Connexion Pro | `public/images/pro/sikaloc-pro-login-owner-keys.webp` | Propriétaire debout à l'entrée, clés en main : responsabilité et prise en main du patrimoine. |
| Connexion Me | `public/images/me/sikaloc-me-connexion-everyday-home.webp` | Locataire préparant la table : scène quotidienne et autonomie, sans écran. |
| Page publique Me — rejoindre | `public/images/me/sikaloc-me-rejoindre-home-life.webp` | Locataire aménageant une étagère : appropriation et vie dans son logement. |
| Activation sur invitation Me | `public/images/me/sikaloc-me-invitation-welcome-home.webp` | Détail d'un seuil résidentiel sans personnage : accueil et passage vers un espace personnel. |
| Connexion Find | `public/images/find/sikaloc-find-login-kitchen-visit.webp` | Candidate examinant les rangements d'une cuisine : visite pratique d'un logement. |
| Inscription à une candidature Find | `public/images/find/sikaloc-find-candidate-studio.webp` | Studio vide, cadrage architectural : projection dans un espace, visuel générique sans lien avec l'annonce. |
| Connexion générale | `public/images/general/sikaloc-general-login-courtyard.webp` | Cour résidentielle sans personnage : contexte neutre pour la plateforme. |

## Corrections réalisées

| Ancien placement ou récit | Nouveau placement | Motif |
|---|---|---|
| Connexion Pro reprenait la propriétaire à l'ordinateur de l'accueil. | Nouvelle scène de propriétaire debout à l'entrée, clés en main. | Doublon exact entre deux pages ; récit de gestion mieux ancré dans le patrimoine. |
| Connexion Find, connexion générale et inscription candidature reprenaient la scène Find de l'accueil. | Visite de cuisine pour la connexion Find ; cour neutre pour la connexion générale ; studio vide pour l'inscription de candidature. | Trois usages distincts auparavant sur la même photo ; intention et cadrages désormais différenciés. |
| Activation Me reprenait la photo de la connexion Me. | Détail d'entrée résidentielle sans personnage. | Suppression de la réutilisation inter-pages tout en distinguant l'étape d'invitation. |
| Organisation Pro et accueil Pro montraient toutes deux une personne à table devant un ordinateur. | Couloir résidentiel avec plusieurs entrées distinctes, sans personnage. | L'organisation des logements est illustrée par l'architecture, sans répéter la scène d'écran ni le rangement sur étagère de Me. |
| Connexion Me et accueil Me montraient toutes deux une personne consultant son téléphone à domicile. | Locataire préparant une table dans son logement. | Diversification de l'action et retrait d'un usage répétitif du téléphone. |
| Inscription Pro montrait une personne au laptop, proche de la scène Pro de l'accueil. | Propriétaire évaluant la lumière d'un logement. | Rupture narrative : préparation d'un bien plutôt que travail à l'écran. |
| Page publique Me montrait une personne assise sur un canapé avec téléphone, comme la scène Me de l'accueil. | Locataire aménageant une étagère dans son logement. | Diversification de posture, d'action et d'intention. |

Les anciens fichiers non affectés restent présents : `public/images/pro/sikaloc-pro-inscription-editorial.webp`, `public/images/pro/sikaloc-pro-organisation.webp`, `public/images/me/sikaloc-me-rejoindre-editorial.webp` et `public/images/me/sikaloc-me-connexion-editorial.webp`. Ils ne sont plus référencés par les pages actives.

## Illustrations, captures et ressources non éditoriales

| Ressource | Usage constaté | Décision |
|---|---|---|
| `public/illustrations/home-01-villas.webp` | Hero de l'accueil ; collection de villas Sikaloc stylisées sur fond transparent. | Conserver : illustration de marque, pas une photo ni une annonce Find. |
| `public/illustrations/home-01.webp` | Illustration « écosystème » de `IllustrationMarque`. | Réutilisation fonctionnelle d'état/explication ; exception au principe d'unicité photo. |
| `public/illustrations/home-02.webp` | Illustration « habitat » ; référence conditionnelle dans `CarteAuth` (`ambiance` vaut faux par défaut et aucun appel actif ne l'active). | Conserver, ressource de marque réutilisable ; usage auth actuellement dormant. |
| `public/illustrations/home-03.webp` | Illustration « locataire » de `IllustrationMarque`. | Réutilisation fonctionnelle, non éditoriale. |
| `public/illustrations/home-04.webp` | Illustration « recherche » de `IllustrationMarque`. | Réutilisation fonctionnelle, non éditoriale. |
| `public/illustrations/home-01-mobile.webp` | Aucune référence active trouvée. | Variante ancienne non affectée ; conservée, ne pas la présenter comme active. |
| `public/illustrations/home-01-sculpture.png` | Aucune référence active trouvée ; ancienne sculpture de bâtiments reliés. | Asset legacy non affecté ; conservé mais à ne pas réintroduire dans les pages éditoriales. |
| `public/demo/*.png` (6 captures) | Produites par des scripts de capture ; aucune référence directe trouvée dans `src`. | Captures fonctionnelles, hors inventaire éditorial actif ; ne pas les présenter comme captures actuelles sans revue et anonymisation. |
| `public/marque/*` et logo distant de l'e-mail | Identité et courriels. | Ressources de marque permanentes ; réutilisation prévue. |

Aucune photographie marketing distante n'a été trouvée dans les références source inspectées. Les photos de logements passent par les routes Find internes citées plus haut.

## Parcours photographique par espace

- **Pro :** propriété et maîtrise (accueil), observation d'un bien (page Pro), organisation documentaire (section dédiée), préparation sans écran (inscription), clés et responsabilité (connexion). Les récits d'ordinateur sont limités à la démonstration de gestion numérique où ils sont pertinents.
- **Me :** confort et consultation personnelle (accueil), vie quotidienne sans écran (page publique), accès individuel (connexion), seuil résidentiel sans personnage (activation sur invitation).
- **Find :** visite de couple (accueil), exploration concrète d'une cuisine (connexion candidature), espace architectural générique (inscription candidature). Ces visuels éditoriaux ne remplacent pas les photos liées aux annonces.

## Liste de contrôle avant intégration

1. Rechercher les références de l'asset et comparer les empreintes aux photos actives.
2. Décrire l'action, la posture, le cadrage, le décor et l'intention ; comparer avec le tableau des scènes existantes.
3. Si le nouveau visuel pourrait être interverti avec une image existante sans changer le sens, préciser sa fonction avant intégration.
4. Vérifier qu'il ne suggère ni vrai client, ni logement réellement disponible, ni transaction, signature ou résultat non démontré.
5. Vérifier cadrage et sujet sur mobile/desktop, texte alternatif et poids WebP ; préserver les photos fonctionnelles des annonces.
6. Ajouter l'asset et son récit au registre dans le même changement de code.
