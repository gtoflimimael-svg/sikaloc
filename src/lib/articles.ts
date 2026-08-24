/**
 * Articles du blog.
 *
 * Le contenu vit ici, en données structurées, plutôt qu'en MDX : le projet n'a
 * aucune dépendance de rendu Markdown et une page de blog ne justifie pas d'en
 * ajouter une. Le prix à payer est un peu de verbosité ; le gain est qu'aucun
 * contenu ne peut injecter de balisage arbitraire.
 *
 * ─── Règle de rédaction, sans exception ──────────────────────────────────────
 *
 * Ces textes sont DESCRIPTIFS : ils disent ce que Sikaloc fait, jamais ce que la
 * loi exige du lecteur. Un article signé Sikaloc engage plus qu'une page
 * produit, puisqu'il se présente comme du conseil — et les conditions
 * d'utilisation excluent le conseil juridique.
 *
 * Sont donc proscrits : « vous devez », « obligatoire », « conforme »,
 * « invalide », tout pronostic judiciaire, et toute statistique non sourçable.
 * Le corpus de 50 articles prescrit par l'Axe 3 n'a pas été repris pour cette
 * raison — son article d'exemple contenait à lui seul un crédential inventé, un
 * chiffre non sourçable et une affirmation fausse sur le droit de timbre.
 */

export type Bloc =
  | { type: 'titre'; texte: string }
  | { type: 'paragraphe'; texte: string }
  | { type: 'citation'; texte: string }
  | { type: 'liste'; items: string[] }

export interface Article {
  slug: string
  titre: string
  /** Reprise dans la balise `description` et sur la page d'index. */
  resume: string
  /** Encadré d'ouverture — la réponse, avant l'explication. */
  enBref: string
  publieLe: string
  blocs: Bloc[]
}

const AVERTISSEMENT_STANDARD =
  'Cet article décrit le fonctionnement de Sikaloc. Il ne constitue pas un conseil juridique et ne remplace pas l’avis d’un professionnel du droit.'

const AVERTISSEMENT_FISCAL =
  'Cet article décrit le fonctionnement de Sikaloc. Il ne constitue pas un conseil juridique, fiscal ou comptable, et ne remplace pas l’avis d’un professionnel. Les références au Code général des impôts sont données à titre indicatif : leur interprétation et leur application relèvent d’un conseil qualifié.'

/** Mention légale close chaque article ; elle n'est pas optionnelle. */
export function avertissement(slug: string): string {
  return slug === 'droit-de-timbre' ? AVERTISSEMENT_FISCAL : AVERTISSEMENT_STANDARD
}

export const ARTICLES: Article[] = [
  {
    slug: 'quittance-ou-recu-paiement-partiel',
    titre: 'Quittance ou reçu : ce qui change quand le loyer n’est payé qu’en partie',
    resume:
      'Un locataire verse 40 000 FCFA sur un loyer de 60 000. Le document que vous lui remettez ne dit pas la même chose selon qu’il porte le mot « quittance » ou le mot « reçu ».',
    enBref:
      'Sikaloc choisit le bon des deux mots selon ce qui a réellement été payé, et imprime le solde restant sur le document.',
    publieLe: '2026-08-24',
    blocs: [
      { type: 'titre', texte: 'La situation' },
      {
        type: 'paragraphe',
        texte:
          'Elle est banale. Le locataire n’a pas tout. Il apporte ce qu’il peut, promet le reste pour la semaine prochaine, et vous notez le versement.',
      },
      {
        type: 'paragraphe',
        texte: 'Trois mois plus tard, personne ne se souvient si le complément est arrivé.',
      },
      {
        type: 'paragraphe',
        texte:
          'Le problème n’est pas la mémoire. C’est que **le papier remis ce jour-là ne disait rien du solde**.',
      },

      { type: 'titre', texte: 'Deux mots qui ne veulent pas dire la même chose' },
      {
        type: 'paragraphe',
        texte:
          'Dans l’usage courant, on les emploie l’un pour l’autre. Ils ne se valent pourtant pas.',
      },
      {
        type: 'paragraphe',
        texte: '**Un reçu** atteste qu’une somme a été versée. Il dit : *j’ai reçu ceci.*',
      },
      {
        type: 'paragraphe',
        texte:
          '**Une quittance** atteste qu’une dette est éteinte. Elle dit : *j’ai reçu ceci, et vous ne me devez plus rien pour cette période.*',
      },
      {
        type: 'paragraphe',
        texte:
          'La nuance tient en une phrase, et elle change tout. Remettre une quittance pour un loyer payé à moitié revient à écrire que le locataire ne doit plus rien — alors qu’il doit encore 20 000 FCFA.',
      },

      { type: 'titre', texte: 'Ce que Sikaloc écrit dans chaque cas' },
      {
        type: 'paragraphe',
        texte:
          'Quand vous enregistrez un paiement, Sikaloc compare le montant reçu au loyer prévu au bail. Il n’y a rien à cocher : la comparaison se fait toute seule.',
      },
      {
        type: 'paragraphe',
        texte:
          '**Le loyer est réglé en totalité.** Le document produit est une quittance. Il porte cette phrase :',
      },
      {
        type: 'citation',
        texte:
          'Reçu de [nom du locataire] la somme de [montant en lettres] francs CFA ([montant]) pour le loyer de la période du [date] au [date].',
      },
      {
        type: 'paragraphe',
        texte:
          '**Le loyer n’est réglé qu’en partie.** Le document devient un reçu, et il le dit lui-même :',
      },
      {
        type: 'citation',
        texte:
          'Ce paiement étant partiel, le présent document vaut reçu et non quittance : il ne libère pas le locataire du solde restant dû pour la période, soit [montant].',
      },
      {
        type: 'paragraphe',
        texte:
          'Le solde est calculé et écrit noir sur blanc. Ni vous ni votre locataire n’avez à faire la soustraction, et aucun des deux ne peut se tromper dessus trois mois plus tard.',
      },

      { type: 'titre', texte: 'Pourquoi cela vaut d’être écrit' },
      {
        type: 'paragraphe',
        texte: 'Un papier vaut par ce qu’il dit, pas par ce dont on se souvient.',
      },
      {
        type: 'paragraphe',
        texte:
          'Si le complément arrive, vous enregistrez un second paiement et un second document est émis. Si le complément n’arrive jamais, le reçu porte encore la trace du solde — daté, chiffré, remis le jour même.',
      },
      {
        type: 'paragraphe',
        texte:
          'C’est une différence de nature avec la ligne au crayon dans un cahier : celle-là ne prouve rien à personne, et surtout pas au locataire, qui n’en a pas de copie.',
      },

      { type: 'titre', texte: 'Et si vous vous trompez de montant' },
      { type: 'paragraphe', texte: 'Cela arrive. Un chiffre mal saisi, un mois décalé.' },
      {
        type: 'paragraphe',
        texte:
          'Sikaloc vous laisse cinq minutes après la validation pour corriger. Passé ce délai, le paiement est figé.',
      },
      {
        type: 'paragraphe',
        texte:
          'Cette limite peut sembler courte. Elle est là pour une raison : **un document qu’on peut rééditer indéfiniment ne prouve pas grand-chose.** C’est précisément parce qu’il devient impossible à retoucher qu’il garde sa valeur pour les deux parties.',
      },

      { type: 'titre', texte: 'Voir la différence' },
      {
        type: 'paragraphe',
        texte:
          'Les deux documents sont consultables sans créer de compte. Même bail, même locataire, même période — seul le montant versé change :',
      },
      {
        type: 'liste',
        items: [
          '[Un exemple de quittance](/exemple-quittance) — loyer réglé en totalité',
          '[Un exemple de reçu](/exemple-recu) — 45 000 versés sur 75 000, avec le solde imprimé',
        ],
      },
      { type: 'paragraphe', texte: 'Comparez-les ligne à ligne.' },
    ],
  },

  {
    slug: 'envoyer-quittance-whatsapp',
    titre: 'Envoyer une quittance de loyer sur WhatsApp',
    resume:
      'Votre locataire n’a rien à installer et aucun compte à créer. Il reçoit un lien de téléchargement dans la conversation que vous avez déjà avec lui.',
    enBref:
      'Sikaloc prépare le message et le lien ; c’est vous qui appuyez sur « envoyer », depuis votre propre numéro. Le lien reste valable 30 jours.',
    publieLe: '2026-08-24',
    blocs: [
      { type: 'titre', texte: 'Le problème du papier' },
      {
        type: 'paragraphe',
        texte:
          'Vous imprimez la quittance. Vous attendez de croiser le locataire. Vous la lui remettez — ou vous la glissez sous la porte, et vous n’avez aucune preuve qu’il l’a eue.',
      },
      {
        type: 'paragraphe',
        texte:
          'S’il la perd, il revient vous en demander une autre. S’il conteste, vous n’avez que votre souche.',
      },

      { type: 'titre', texte: 'Ce que fait Sikaloc' },
      {
        type: 'paragraphe',
        texte:
          'À la confirmation d’un paiement, le PDF est produit et déposé dans votre espace. Sikaloc génère alors un **lien de téléchargement personnel**, valable 30 jours, et prépare un message WhatsApp contenant ce lien.',
      },
      { type: 'paragraphe', texte: 'Vous relisez le message, et vous l’envoyez.' },

      { type: 'titre', texte: 'Vous envoyez, pas Sikaloc' },
      {
        type: 'paragraphe',
        texte: 'C’est une distinction qui compte, et nous la tenons volontairement.',
      },
      {
        type: 'paragraphe',
        texte:
          'Sikaloc **n’a pas d’accès à votre WhatsApp**. Il ne s’y connecte pas, n’y écrit pas, n’envoie rien en votre nom. Il ouvre la conversation avec le message déjà rédigé ; le doigt qui appuie sur « envoyer » est le vôtre.',
      },
      {
        type: 'paragraphe',
        texte:
          'Concrètement, le message part de **votre numéro**, dans le fil de discussion que votre locataire connaît déjà. Rien n’arrive d’un expéditeur inconnu, rien ne tombe dans les indésirables.',
      },

      { type: 'titre', texte: 'Ce que le locataire reçoit' },
      { type: 'paragraphe', texte: 'Un message, un lien, un PDF.' },
      {
        type: 'paragraphe',
        texte:
          'Pas de compte à créer. Pas de mot de passe. Pas d’application à installer. Il ouvre le lien, télécharge le document, le garde sur son téléphone.',
      },
      {
        type: 'paragraphe',
        texte:
          'Pour beaucoup de locataires, c’est la première fois qu’ils disposent d’une trace personnelle de leurs paiements — quelque chose qu’ils détiennent eux-mêmes, plutôt qu’une ligne dans le cahier de quelqu’un d’autre.',
      },

      { type: 'titre', texte: 'Pourquoi trente jours' },
      { type: 'paragraphe', texte: 'Le lien expire au bout de 30 jours. C’est délibéré.' },
      {
        type: 'paragraphe',
        texte:
          'Un lien de téléchargement qui ne meurt jamais finit par circuler : transféré, copié dans une conversation de groupe, retrouvé des années plus tard. Trente jours suffisent largement à télécharger un document, et limitent la durée pendant laquelle une adresse oubliée reste ouverte.',
      },
      {
        type: 'paragraphe',
        texte:
          'Si votre locataire laisse passer le délai, vous renvoyez le document depuis votre espace : un nouveau lien est produit.',
      },

      { type: 'titre', texte: 'Et pour les relances' },
      {
        type: 'paragraphe',
        texte:
          'Le même principe s’applique aux loyers en retard. Sikaloc prépare un message avec le nom, la période, le montant et l’échéance ; vous relisez et vous envoyez.',
      },
      {
        type: 'paragraphe',
        texte:
          'Là encore, **Sikaloc n’écrit jamais à votre place**. Relancer un locataire est une conversation, parfois délicate, souvent entre gens qui se connaissent. Ce n’est pas à un logiciel de la mener.',
      },
      {
        type: 'paragraphe',
        texte:
          'Les relances se débloquent avec le plan Standard. L’envoi des quittances, lui, est inclus dès le plan gratuit.',
      },

      { type: 'titre', texte: 'Voir un document' },
      {
        type: 'paragraphe',
        texte:
          'Le PDF que votre locataire recevra est consultable sans créer de compte : [voir un exemple de quittance](/exemple-quittance).',
      },
    ],
  },

  {
    slug: 'montant-en-lettres',
    titre: 'Pourquoi le montant est écrit en lettres sur vos quittances',
    resume:
      '« Soixante mille francs CFA (60 000 FCFA) ». Le montant apparaît deux fois sur chaque document, en chiffres et en toutes lettres.',
    enBref:
      'Un chiffre seul se retouche ; un montant écrit en lettres beaucoup moins. Sikaloc écrit la version en lettres tout seul, avec l’orthographe correcte.',
    publieLe: '2026-08-24',
    blocs: [
      { type: 'titre', texte: 'Une habitude qui vient des banques' },
      {
        type: 'paragraphe',
        texte:
          'Regardez un chèque : le montant y figure en chiffres dans une case, et en lettres sur une ligne. Regardez un acte notarié, une facture ancienne, un ordre de virement : même chose.',
      },
      {
        type: 'paragraphe',
        texte:
          'Ce n’est pas de la décoration. Un chiffre est fragile — un zéro s’ajoute, une virgule se déplace, un 3 devient un 8 d’un coup de stylo. Une somme écrite en toutes lettres résiste beaucoup mieux.',
      },
      {
        type: 'paragraphe',
        texte:
          'Et quand les deux versions se contredisent, c’est en général celle en lettres qui fait foi dans les usages bancaires.',
      },

      { type: 'titre', texte: 'Ce que ça change concrètement' },
      {
        type: 'paragraphe',
        texte:
          'Sur un reçu manuscrit portant « 60 000 », rien n’empêche matériellement qu’un 6 devienne un 8, ou qu’un zéro s’ajoute.',
      },
      {
        type: 'paragraphe',
        texte:
          'Sur un document portant **« Soixante mille francs CFA (60 000 FCFA) »**, il faudrait modifier deux endroits de façon cohérente. Sur un PDF émis et horodaté, dont Sikaloc a conservé l’empreinte, c’est encore une autre affaire.',
      },

      { type: 'titre', texte: 'Sikaloc l’écrit pour vous' },
      { type: 'paragraphe', texte: 'Vous saisissez un chiffre. Le document affiche les deux formes.' },
      {
        type: 'paragraphe',
        texte:
          'Vous n’écrivez jamais la version en lettres à la main — ce qui évite la faute d’orthographe, l’oubli d’un mot, ou la formulation approximative sur un document que vous remettez à quelqu’un.',
      },

      { type: 'titre', texte: 'Le détail que personne ne remarque' },
      {
        type: 'paragraphe',
        texte: 'L’orthographe des nombres en français est pleine de pièges. Sikaloc les applique :',
      },
      {
        type: 'liste',
        items: [
          '**quatre-vingts**, **deux cents** — le *s* apparaît quand le mot est multiplié et ne précède aucun autre nombre',
          '**quatre-vingt mille**, **deux cent mille** — le *s* disparaît devant « mille », qui est un adjectif numéral',
          '**quatre-vingts millions**, **deux cents millions** — il revient devant « million » et « milliard », qui sont des noms',
        ],
      },
      {
        type: 'paragraphe',
        texte:
          'Peu de gens sauraient trancher de mémoire. Sur un document qu’on présente, l’orthographe se remarque : elle dit le sérieux de celui qui l’a produit.',
      },

      { type: 'titre', texte: 'Sur les autres lignes aussi' },
      {
        type: 'paragraphe',
        texte: 'Le même souci de non-ambiguïté vaut ailleurs sur le document :',
      },
      {
        type: 'liste',
        items: [
          'la période est bornée par **deux dates complètes**, pas par un nom de mois',
          'le **loyer prévu au bail** figure à côté du montant reçu, ce qui rend l’écart immédiatement visible',
          'en cas de paiement partiel, le **solde restant** est calculé et imprimé',
        ],
      },
      { type: 'paragraphe', texte: 'Chaque ligne cherche à fermer une interprétation possible.' },

      { type: 'titre', texte: 'Voir un document' },
      {
        type: 'paragraphe',
        texte:
          'Le montant en lettres apparaît au centre du document : [voir un exemple de quittance](/exemple-quittance).',
      },
    ],
  },

  {
    slug: 'suivre-plusieurs-logements',
    titre: 'Suivre les loyers de plusieurs logements sans cahier',
    resume:
      'Au-delà de deux ou trois logements, la mémoire ne suffit plus et le cahier ne se relit pas.',
    enBref:
      'Sikaloc affiche en permanence qui a payé, qui doit encore, et depuis combien de jours. Le retard se déclenche tout seul, selon l’échéance et la tolérance de chaque bail.',
    publieLe: '2026-08-24',
    blocs: [
      { type: 'titre', texte: 'Le moment où le cahier lâche' },
      { type: 'paragraphe', texte: 'Avec un logement, tout tient dans la tête.' },
      {
        type: 'paragraphe',
        texte:
          'Avec cinq, la question « est-ce que le locataire du B2 a payé mars ? » demande de retrouver le cahier, la bonne page, la bonne ligne — et de faire confiance à ce qui y est écrit.',
      },
      {
        type: 'paragraphe',
        texte:
          'Avec dix, personne ne relit plus rien. On sait qu’il y a des retards, sans savoir lesquels ni depuis quand.',
      },
      {
        type: 'paragraphe',
        texte:
          'Le cahier n’est pas un mauvais outil. Il n’est simplement pas fait pour être interrogé.',
      },

      { type: 'titre', texte: 'Ce que Sikaloc montre en permanence' },
      { type: 'paragraphe', texte: 'Quatre chiffres, mis à jour à chaque paiement enregistré :' },
      {
        type: 'liste',
        items: [
          '**Taux d’occupation** — combien de vos logements sont effectivement loués',
          '**Taux de recouvrement** — ce qui a été encaissé ce mois-ci, rapporté à ce qui était attendu',
          '**Impayés** — le nombre de loyers en retard, et la somme totale à recouvrer',
          '**Chiffre d’affaires du mois** — ce qui est réellement rentré',
        ],
      },
      {
        type: 'paragraphe',
        texte:
          'En dessous, la liste des loyers en retard : le nom du locataire, le logement, le mois concerné, et **depuis combien de jours** le retard court.',
      },

      { type: 'titre', texte: 'Le retard se déclenche tout seul' },
      {
        type: 'paragraphe',
        texte:
          'Chaque bail a son jour d’échéance et sa tolérance — le nombre de jours que vous accordez avant de considérer un loyer comme en retard.',
      },
      {
        type: 'paragraphe',
        texte:
          'Passé ce délai, le loyer bascule en impayé et remonte en haut du tableau de bord. Vous n’avez rien à surveiller ni à cocher.',
      },
      {
        type: 'paragraphe',
        texte:
          'C’est la différence la plus concrète avec le cahier : **le cahier attend qu’on l’ouvre, le tableau de bord vient à vous.**',
      },

      { type: 'titre', texte: 'Agir avant que le retard s’installe' },
      {
        type: 'paragraphe',
        texte:
          'Un retard de huit jours se règle souvent par un message. Un retard de quatre mois devient un litige.',
      },
      {
        type: 'paragraphe',
        texte:
          'Voir « 12 jours de retard » à côté d’un nom, plutôt que de le découvrir au trimestre, change ce que vous pouvez encore faire — et le ton de la conversation que vous aurez.',
      },

      { type: 'titre', texte: 'Chaque logement reste distinct' },
      {
        type: 'paragraphe',
        texte:
          'Un point qui compte quand le parc grandit : chaque document désigne **son** logement, adresse complète.',
      },
      {
        type: 'paragraphe',
        texte:
          'Si un même locataire vous loue deux biens, il reçoit deux documents distincts. Rien ne se mélange, et rien ne dépend de ce dont vous vous souvenez.',
      },
    ],
  },

  {
    slug: 'droit-de-timbre',
    titre: 'Droit de timbre : dans quel cas Sikaloc l’affiche sur vos quittances',
    resume:
      'Sikaloc ajoute un encart chiffré uniquement quand vous encaissez plus de 100 000 FCFA en espèces. Pour un règlement par Mobile Money ou virement, il n’apparaît pas.',
    enBref:
      'Sikaloc signale la règle et le cas où elle est susceptible de s’appliquer. Il ne calcule pas cette taxe, ne la collecte pas, et ne dit pas qui doit l’acquitter.',
    publieLe: '2026-08-24',
    blocs: [
      { type: 'titre', texte: 'Une source de confusion fréquente' },
      {
        type: 'paragraphe',
        texte:
          'Sur ce sujet, on lit à peu près tout — y compris qu’un droit de timbre serait dû sur chaque quittance, quel qu’en soit le montant ou le mode de règlement.',
      },
      {
        type: 'paragraphe',
        texte: 'Ce n’est pas ce que dit le texte, et ce n’est pas ce que Sikaloc imprime.',
      },

      { type: 'titre', texte: 'Ce que Sikaloc écrit, dans tous les cas' },
      { type: 'paragraphe', texte: 'Chaque document produit porte, en bas de page, cette mention :' },
      {
        type: 'citation',
        texte:
          'Droit de timbre — En cas de paiement en espèces supérieur à 100 000 FCFA, un droit de timbre de 1 % peut être exigible conformément à l’article 423 du CGI (modifié par la LF 2025). Pour les paiements par Mobile Money ou virement, ce droit n’est pas applicable. Sikaloc ne calcule pas ce montant : son acquittement relève de la responsabilité des parties.',
      },
      {
        type: 'paragraphe',
        texte:
          'Elle figure sur **toutes** les quittances, y compris celles du plan gratuit. Elle n’a jamais été une fonctionnalité à vendre.',
      },

      { type: 'titre', texte: 'Ce que Sikaloc ajoute, dans un seul cas' },
      {
        type: 'paragraphe',
        texte:
          'Quand deux conditions sont réunies — **mode de paiement « espèces »** et **montant supérieur à 100 000 FCFA** — un encart supplémentaire apparaît sur le document. Il rappelle la règle et indique l’ordre de grandeur du 1 %, calculé sur le montant effectivement encaissé.',
      },
      {
        type: 'paragraphe',
        texte:
          'Dans tous les autres cas, cet encart n’apparaît pas. Un loyer de 200 000 FCFA réglé par Mobile Money ne le déclenche pas. Un loyer de 60 000 FCFA en espèces non plus.',
      },

      { type: 'titre', texte: 'Ce que Sikaloc ne fait pas' },
      {
        type: 'liste',
        items: [
          '**Il ne calcule pas la taxe.** L’encart donne un ordre de grandeur pour attirer votre attention, rien de plus.',
          '**Il ne la collecte pas.** Aucun montant n’est prélevé, ajouté au loyer, ni transmis à qui que ce soit.',
          '**Il ne dit pas qui doit la payer.** Le document renvoie à la responsabilité des parties et invite à se rapprocher d’un conseil.',
        ],
      },
      {
        type: 'paragraphe',
        texte:
          'C’est délibéré. Nous décrivons une règle et signalons le cas où elle est susceptible de s’appliquer — nous ne nous substituons pas à un fiscaliste, et nos conditions d’utilisation excluent explicitement le conseil juridique.',
      },

      { type: 'titre', texte: 'Pourquoi le signaler quand même' },
      { type: 'paragraphe', texte: 'On pourrait se taire. Beaucoup d’outils le font.' },
      {
        type: 'paragraphe',
        texte:
          'Mais un bailleur qui encaisse 150 000 FCFA en espèces mérite de savoir qu’une règle existe, au moment où il produit le document — pas deux ans plus tard. Signaler n’est pas conseiller.',
      },

      { type: 'titre', texte: 'Vérifier par vous-même' },
      {
        type: 'paragraphe',
        texte:
          'La mention figure en bas du document : [voir un exemple de quittance](/exemple-quittance).',
      },
    ],
  },
]

export function articleParSlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug)
}
