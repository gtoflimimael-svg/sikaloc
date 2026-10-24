# Sikaloc — système visuel de référence

Version harmonisée au 24 octobre 2026. Les valeurs exécutables sont dans
`src/app/globals.css`, avec Tailwind 4 et les composants existants. Aucune nouvelle
bibliothèque UI n’est nécessaire. Les espaces publics et le shell Pro connecté
utilisent les signatures Sikaloc et les polices locales officielles.

## Direction et identité

SaaS de gestion immobilière au Bénin : lecture des montants, des échéances et des
statuts avant la décoration. Conserver le logotype officiel et la palette Sikaloc :
vert signature `#B8F36D`, vert profond `#17311C`, encre `#111810`, sauge `#EAF1E7`
et blanc. Manrope porte les titres et valeurs éditoriales ; Inter porte le texte
courant et les contrôles. Dans le shell Pro connecté, Manrope est chargée localement
et limitée à cet espace. Les états vides utilisent un repère métier sobre, sans
réutiliser les anciennes scènes 3D de maisons reliées.

Les pilotes sont le tableau de bord Pro, la modification d’un logement et
l’accueil Me. Find suit les mêmes fondations sans reprendre le shell de gestion.
La structure de Pro reste une barre latérale sur bureau et un tiroir sur mobile ;
Me conserve ses onglets. Ces différences répondent aux usages, pas à deux marques.

Lecture : titre et contexte → synthèse → action → détails. Alignement à gauche,
montants à droite dans les tableaux, nombres tabulaires. Un seul accent fort par
ensemble ; pas de gradient de fond, d’ombre sur chaque bloc ou de mouvement au survol
qui décale les liens. Ne pas uniformiser toutes les informations en grandes cartes.

## Tokens et palette

Les primitifs existants restent compatibles. Les tokens sémantiques donnent le
sens, les tokens de composant règlent dimensions et densité. Utiliser les utilitaires
Tailwind correspondants, sans hex dans les composants. Les exceptions locales sont
réservées aux composants documentés ou aux ressources de marque.

| Rôle / token | Clair | Sombre |
|---|---|---|
| Marque / `primary` | `#B8F36D` | `#B8F36D` |
| Survol marque / `primary-active` | `#A4E951` | `#A4E951` |
| Texte bouton / `on-primary` | `#111810` | `#111810` |
| Sol / `canvas-soft` | `#EAF1E7` | `#111810` |
| Surface / `canvas`, `surface-card` | `#FFFFFF` | `#1B2E20`, `#203726` |
| Surface secondaire / `surface-soft` | `#EAF1E7` | `#203726` |
| Titre / `ink` | `#111810` | `#F2F2F7` |
| Texte / `body` | `#424940` | `#C8C8D2` |
| Secondaire / `mute` | `#636D63` | `#AAAABA` |
| Aide / `mute-soft` | `#637267` | `#AAAABA` |
| Séparation / `hairline` | `#D6E0D2` | `#36523A` |
| Limite de contrôle / `control-border` | `#758A77` | `#747485` |
| Succès texte/fond | `#125B32` / `#E4F5E8` | `#A8E0B8` / `#1C2F22` |
| Attention texte/fond | `#3E2D0A` / `#FFF3D8` | `#F2D78F` / `#332A12` |
| Erreur texte/fond | `#8F1E27` / `#FFF0EF` | `#F4A8A8` / `#341D1D` |
| Action dangereuse texte / `on-negative` | blanc | `#211013` |

`positive` et `warning` ne sont pas des couleurs de texte sur fond clair : employer
`positive-deep` et `warning-content`. Les textes d’erreur utilisent `negative-darkest`
ou `negative` selon leur support. Le statut ne repose jamais sur la seule couleur.
Le filet décoratif peut être discret ; le contour d’un champ doit rester identifiable.
Les accents de marque ne remplacent pas les couleurs sémantiques des états.

## Typographie

Les fichiers de `src/app/fonts/` sont chargés localement avec `next/font`. Inter est
la police de lecture ; Manrope est la police d'affichage. Le shell Pro connecté
charge les variantes locales Manrope dans son layout, sans dépendance réseau.
Georgia reste le repli serif. Ne pas supprimer les accents pour contourner un
problème de fonte. Les textes français, ligatures, guillemets et espaces FCFA
doivent être contrôlés dans le navigateur.

| Usage | Police et taille | Poids / interligne |
|---|---|---|
| Titre de page `.page-title` | Manrope, 28 → 36 px | 700–800 / 1,12 |
| Section d’application `.section-title` | Manrope, 18 px | 650–750 / 1,4 |
| Chiffre de synthèse `.metric-value` | Manrope, 28 → 32 px | 700–800 / 1,2 |
| Corps et champ | Inter, 16 px | 400 / 1,55 |
| Ligne dense et bouton | 14 px | 400 ou 500 / ≥ 1,4 |
| Aide et légende | 13 px | 400 / 1,4 |

Les titres marketing display de 48–80 px restent réservés au marketing. Ne pas
utiliser `font-extrabold` pour une page de gestion. Éviter les labels en capitales
espacées ; garder la casse de phrase. Ne pas descendre sous 13 px pour une aide.

## Grille, espacements, rayons et élévation

Base de 4 px : 4, 8, 12, 16, 24, 32, 48, 64. Les alias actuels `xxs/xs/sm/md/lg/xl`
restent respectivement 4/8/12/16/24/32 px. `2xl` vaut historiquement 32 px ; ne pas
supposer une progression Tailwind standard. **Ne pas utiliser `max-w-sm/md/lg/xl`** :
les noms de spacing entrent en collision avec ces largeurs ; employer une largeur
explicite (`max-w-[42rem]`) ou les classes de conteneur documentées.

- `.app-main` : gouttière 16 px au mobile, 32 px à partir de 640 px ; vertical 24/32 px.
- Pro : zone de travail jusqu’à 1440 px, largeur affinée par famille de contenu ;
  formulaires autour de 42 rem ; Me : 900 px.
- Carte `.card` : 20 px de padding, 24 px à partir de 640 ; `.card-lg` : 20/32 px.
- Espacement entre sections 24–32 px ; entre champs 24 px ; label → champ 8 px.
- Rayon champ/bouton 8 px ; carte/tableau 12 px ; menu 12 px ; badge seul en pilule.
- Filet 1 px. `shadow-elevated` pour un menu, `shadow-modal` pour un dialogue.
  Les cartes statiques utilisent un filet et une surface ; pas d’ombre systématique.

## Composants communs

### Boutons

`.btn` conserve les variantes primary, secondary, tertiary et danger. Hauteur minimale
44 px, texte pouvant revenir à la ligne ; `.btn-sm` 36 px sur bureau. Cibles tactiles
44 px sur appareils à pointeur grossier. `.btn-icon` 40 px sur bureau, 44 px au tactile.
Primary = action principale, secondary = alternative, tertiary = navigation auxiliaire,
danger = confirmation d’une action destructive. Ne pas multiplier les primary concurrents.
`BoutonSoumettre` garde l’action serveur et `useFormStatus` : désactivation et `aria-busy`
pendant l’envoi, libellé explicite et spinner décoratif. Ne pas déplacer la validation.

### Formulaires

`ChampTexte`, `ChampSelection`, `ChampMontant` et `ChampCase` gardent noms, valeurs,
contraintes natives et contrats existants. Chaque label est relié au champ. Les aides
ont un id `nom-aide`, les erreurs `nom-erreur`. `aria-describedby` référence uniquement
les textes réellement présents ; l’erreur remplace l’aide comme avant. `aria-invalid`
est posé en présence d’erreur et le message est annoncé. Conserver un texte explicite,
pas seulement un bord rouge. Champ 44 px / texte 16 px, contour visible et focus vert profond.
Les validations serveur restent l’autorité ; l’état vide ne remplace jamais une erreur.

Le formulaire pilote regroupe visuellement les informations et isole sa barre d’actions.
Un refus serveur conserve la saisie : le reset automatique React ne doit pas remettre
l’ancienne valeur sous une erreur portant sur la nouvelle. La réussite redirige comme avant.
Ne pas ajouter de champs ou modifier les règles de pays, de montant ou d’autorisation.
Les contrôles spécialisés mot de passe, téléphone et OTP conservent leur comportement ;
leur harmonisation détaillée par parcours relève de F/H.

### Cartes, listes et tableaux

`.card` = surface lisible avec filet ; `.card-sage` = mise en avant secondaire ;
`.card-dark` = contraste intentionnel. `CarteMetrique` = label, valeur tabulaire,
détail ; le fond vert profond reste limité à la métrique principale. Une colonne au mobile,
deux dès 640 px pour ne pas comprimer les montants FCFA insécables. Ne pas réduire
la police jusqu’à rendre un nombre illisible pour obtenir quatre colonnes.

`.data-table` : en-têtes en casse de phrase, surface distincte, lignes séparées,
survol discret, montants alignés à droite et sans retour à la ligne. Le tableau reste
un vrai tableau avec `scope`. `.table-defilante` contient son débordement ; ajouter un
nom accessible et `tabIndex=0` quand le tableau doit défiler. Garder les informations
essentielles sur mobile et ne jamais cacher une erreur de requête derrière « aucun ».
Les listes métiers peuvent garder leur structure ; éviter de les convertir en tableaux.

### Retours, états vides et chargement

`Alerte` fournit ton, icône et annonce : erreur = alert, autres = status.
`Badge` conserve un libellé de statut, sans dépendre uniquement de la couleur.
`EtatVide` propose une prochaine action quand elle existe ; dans le shell Pro, le
repère est un pictogramme métier compact, pas une ancienne illustration 3D de maisons
reliées. Le pilote Pro affiche une alerte par lecture en échec (indicateurs, loyers en retard,
paiements) ; il ne transforme plus ces erreurs en zéros ou en états vides.
Les squelettes existants ne servent qu’à une attente réelle, jamais
à masquer une erreur serveur. Les messages d’échec ne deviennent pas des états vides.
Le chargement de soumission conserve le libellé et bloque les doubles clics.

## Navigation, dialogues et clavier

Pro bureau : barre latérale stable, ligne active surlignée par une surface neutre, `aria-current=page`,
aucun décalage horizontal au survol. Le bandeau supérieur porte le groupe de
navigation, pas une seconde copie du titre H1. Les actions de paiement sont
contextuelles aux pages qui les utilisent ; elles ne persistent pas dans le shell.
Le contenu peut s’étendre jusqu’à 1440 px, tandis que les formulaires et détails
gardent leur largeur de lecture. Lien d’évitement vers le contenu du shell.
Pro mobile : bouton nommé, `aria-expanded` et `aria-controls`, tiroir natif modal
`dialog`. À l’ouverture le focus entre dans le tiroir ; Tab reste dans le modal,
Échap ou fond ferment, le focus revient au déclencheur. Le fond ne défile pas.
Changer de route ou passer en vue bureau referme le tiroir.

Menu compte : premier item focalisé, flèches haut/bas et Home/End naviguent,
Échap ferme et revient au déclencheur ; Tab sort et ferme, clic extérieur ferme.
Les liens gardent leurs destinations et la déconnexion garde sa Server Action.
Me : onglets nommés, défilement horizontal local, cible active visible au clavier.
Find : conserver la recherche et les liens publics ; pas de shell Pro ajouté.
Les confirmations métier en place restent en place ; ne pas imposer un modal à une
confirmation simple. Tout futur modal doit avoir un titre accessible et gérer le focus.

## Responsive, accessibilité et thèmes

Recette pilote à 375, 768 et 1440 px. Aucun défilement horizontal de page ; seul le
contenu qui en a besoin (tableau/onglets) défile localement. Les champs restent à
16 px pour éviter le zoom mobile. Tester les longs noms/adresses et grands montants.
Les contrôles ont un focus visible 2 px avec décalage 2 px. Le focus ne doit pas
rester dans une zone masquée. Contraste cible 4,5:1 pour texte courant, 3:1 pour grands
textes et limites des contrôles ; contrôler les combinaisons réellement affichées.
Respecter le zoom, `prefers-reduced-motion` et l’ordre logique du DOM.

Les thèmes système, clair et sombre gardent `data-theme` et le script anti-flash du
layout. Surcharger les tokens, pas les composants par des couleurs fixes ou des
exceptions `dark:`. Vérifier champs natifs, boutons danger, focus, aides et badges
sur chaque surface. Le mode impression des quittances n’est pas rénové au lot E.

## Périmètre et règles du lot F

Les fondations partagées se propagent automatiquement ; cela ne vaut pas recette de
chaque écran. Étendre d’abord aux listes Pro (tableaux, filtres, actions), puis aux
formulaires et confirmations, ensuite à Me et Find. Utiliser `EnTetePage`, les champs
partagés, `Alerte` et les tokens plutôt que copier du CSS dans une page.

Interdits : remplacer une permission par un état visuel, masquer une erreur de données,
modifier les requêtes pour remplir une maquette, changer une action serveur pour un
test, ajouter une police distante ou une librairie UI pour un détail, multiplier les
ombres/gradients, tronquer un montant essentiel. Les lots financiers et Auth restent
la référence. La recette finale H intégrera D2 et les parcours non pilotes.


## Compléments F1 — listes Pro

- `ResumeListe` (`ui/listes.tsx`) affiche le résumé des résultats chargés, sans
  modifier les calculs ni les requêtes ; ne pas le rendre à la place d’une erreur.
- `TableauListe` fournit une région nommée, focalisable et une aide au défilement.
  Le tableau enfant garde ses colonnes, scopes et alignements. La largeur minimale
  de l’historique utilise `.table-paiements`, pas une règle globale sur les tableaux.
- `LienFiltre` garde un lien GET existant, `aria-current` et un indicateur d’attente
  Next dans une boîte de taille fixe ; aucune nouvelle logique de filtre.
- `.card.list-card` garde son padding de carte dans les espaces où une surface est
  utile. Dans Pro, les rangées de gestion sont ouvertes et séparées par des filets ;
  `.list-row` empile au mobile et sépare identité/actions dès que la largeur le permet.
  `.list-actions` distingue les commandes ; `.list-aside` met en évidence statut et montant.
- Dans l’espace Pro, les cartes statiques ne sont conservées que lorsqu’elles portent
  une surface fonctionnelle ou un signal métier ; les autres listes s’appuient sur
  la typographie et les séparateurs. Le tableau de bord présente les KPI en bandeau
  typographique, et les paramètres forment une table de matières ouverte en deux
  colonnes, sans six cartes répétées.
- `.list-title` et `.list-copy` permettent les noms, adresses et emails longs.
  `.money` utilise les chiffres tabulaires sans troncature ni retour dans un montant.
- Une erreur auxiliaire (ex. liste des baux du filtre) est signalée sans masquer les
  paiements déjà chargés ; conserver le filtre courant lors d’une nouvelle soumission.
- La confirmation en place `ActionConfirmee` focalise Annuler à l’ouverture, puis
  restaure le déclencheur après annulation ou retour d’erreur. Son action reste identique.


## Compléments F2 — formulaires Pro

- `FormulaireMetier` fournit le nom du formulaire, le rappel des champs obligatoires,
  le retour d’erreur et le focus vers le premier champ invalide (ou l’erreur générale).
  Il conserve la saisie après refus. À réserver aux parcours dont la réussite redirige.
  Les actions et validations restent celles de l’appelant.
- `SectionFormulaire` utilise `fieldset` / `legend`, sans cartes imbriquées. Regrouper
  par décision : association, montant/durée, échéance/garantie. Une ligne sépare
  les sections ; ne pas ajouter un grand padding sous chaque légende.
- `ActionsFormulaire` isole Enregistrer / Annuler avec un filet, boutons empilés
  sous 480 px. Pendant l’envoi : champs et bouton désactivés, lien Annuler neutralisé,
  attente annoncée. Ne pas perdre la saisie ni lancer une seconde action.
- Aucun avatar n’est ajouté aux profils ou formulaires ; les identités restent
  textuelles et les contrôles de profil déjà existants sont conservés. Les onglets
  utilisent flèches, Home/End et un seul arrêt Tab.
  Le consentement déjà attesté est transmis par le formulaire de modification ;
  la validation serveur reste obligatoire et inchangée.
- Le récapitulatif de paiement distingue montant à confirmer, loyer, cumul et solde
  déjà calculés par le serveur. La nature du document dépend du cumul de la période,
  pas du seul versement saisi. Aucun calcul ne doit être recopié côté client.
- `GroupeActions` empêche le lancement simultané de commandes alternatives, notamment
  Confirmer / Abandonner. Ce blocage d’interface complète les garanties serveur.
- `ActionConfirmee` reste en place, sans modal ni piège de focus. Échap ou Annuler
  ferment avant exécution ; pendant l’opération, les commandes sont désactivées.
  Le focus revient au déclencheur après annulation, erreur ou réussite sans redirection.

Le papier de signature garde son fond blanc pour le tracé noir. Son aide utilise
`on-paper-mute` (#616169 dans les deux thèmes), afin de rester lisible en mode sombre.
Le rendu, le recadrage et le téléversement de la signature ne changent pas.

## Compléments F3 — Me et Find

Me conserve ses liens de navigation horizontaux : le lien actif est ramené dans
la zone visible sans animation. Il s’agit de navigation entre pages, pas d’un
widget `tablist`. L’accueil donne accès aux loyers et documents ; chaque bail
reste distinct. `.me-detail-row` empile les termes et valeurs au mobile.
`.me-amounts` présente loyer, versements enregistrés et solde provenant de la même
lecture serveur ; les périodes « À déterminer » n’affichent pas une dette supposée.
Ne pas écrêter ni recalculer un solde négatif : afficher la valeur de la source.
Les listes de versements nomment chaque téléchargement par type et numéro.
Les erreurs de lecture ne deviennent plus des listes vides ni une invitation manquante.

Find possède `EnTeteFind`, `MenuFind` et `PiedDePageFind` : recherche et suivi des
candidatures en priorité. Le menu est une divulgation native non modale : Échap
referme et restaure le focus, Tab suit les liens, clic extérieur/navigation ferment.
Les liens institutionnels du pied de page existant restent accessibles dans un
`details`, avec les liens utiles immédiatement visibles. Les autres espaces et
leur navigation partagée ne sont pas modifiés.

Les cartes `.find-card` utilisent la photo 4:3, un seul lien étendu, un prix
insécable et une localisation lisible. La fiche place titre/localisation avant
la galerie et rend prix/candidature immédiatement accessibles au mobile ; les
conditions détaillées gardent leur bloc dédié. Regrouper les caractéristiques
dans une seule surface, pas une carte décorative par valeur.
Les montants des filtres s’empilent dans la barre latérale étroite ; les équipements
se déplient. Le formulaire GET, les critères et l’URL restent la source de recherche.
Échap ferme les filtres mobiles et rend le focus au déclencheur.

La galerie conserve les positions de photos fournies par le serveur et les routes
publiques ; aucune URL Storage n’est exposée. Images contenues dans la fiche,
cadrées dans le catalogue, jamais déformées. Flèches, Home/End et vignettes sont
accessibles ; le compteur utilise une surface sémantique dans les deux thèmes.
Une photo manquante affiche un état d’erreur, avec possibilité de parcourir les autres.

Les formulaires candidat réutilisent les champs E/F2, conservent la saisie et
les choix après refus, associent les aides/erreurs et focalisent le champ invalide.
Le suivi distingue erreur de chargement et absence de candidature. Le numéro ne
propose un code que sur un canal réellement opérationnel ; l’indisponibilité est
explicitement affichée. Aucun contrôle serveur ou prérequis n’est supprimé.
La galerie borne aussi son indice d’affichage quand une actualisation retire des
photos, sans réécrire les positions ni déclencher d’opération serveur.
