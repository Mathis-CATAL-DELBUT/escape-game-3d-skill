# Concevoir les énigmes, le récit et la coopération

Sommaire : 1. Document de conception · 2. Choisir un thème (tous genres) · 3. Graphe des énigmes ·
4. Types d'énigmes éprouvés · 5. Coopération et solo · 6. Indices · 7. Rythme, chrono, fin, score ·
8. Récit et cohérence · 9. Textes · 10. Liste de contrôle

## 1. Document de conception (à écrire avant la 3D)

Une page suffit, dans `build/DESIGN.md` (fichier marqué SPOILERS) :
- pitch (2 phrases), public, ton, durée, joueurs ;
- lieu : liste des pièces et de ce qu'on y fait ;
- actes (3 en général) et ce qui ouvre le suivant ;
- graphe des énigmes (voir §3) ;
- objets : où ils sont, ce qu'ils servent, s'ils sont consommés ;
- informations : où elles sont, sur quels canaux (texte, image, son) ;
- fin(s), score, conditions ;
- indices par sujet (3 niveaux).

## 2. Choisir un thème (le moteur est le même pour tous)

Le squelette « pièces + objets + verrous + informations » marche pour tout. Exemples :
- **Enquête** (manoir, bureau de détective, train de nuit) : indices croisés, témoignages, coffre final.
- **Science-fiction** (station orbitale, laboratoire) : énergie à rétablir, terminaux, sas, oxygène comme chrono.
- **Aventure / fantastique** (temple, bibliothèque de sorcier) : mécanismes, symboles, miroirs, sons.
- **Musée / histoire** (cabinet de curiosités, atelier d'inventeur) : objets à identifier, frises, cartes.
- **Famille / enfants** (cabane, chambre de jouets) : couleurs, formes, comptines ; pas de peur, textes simples.
- **Horreur** (pavillon de chasse, hôpital) : tension par l'éclairage et le son, jamais par le gore gratuit.

Adapter : vocabulaire des textes, matériaux, éclairage (chaleureux, néon, lune), sons d'ambiance, et
le « chrono » narratif (heure de l'histoire, oxygène, marée, arrivée de quelqu'un).

## 3. Graphe des énigmes

Chaque nœud : **entrées** (objets, informations, état) → **action** (où, par qui) → **sorties** (objet,
porte, information, événement). Vérifier sur le graphe :
- tout est atteignable depuis le départ, pour chaque nombre de joueurs prévu ;
- **aucun blocage définitif** : un objet consommé n'est requis nulle part ailleurs ; une porte refermable
  se rouvre ; un code faux bloque au pire quelques secondes ; un joueur qui part ne bloque rien (ses objets
  restent récupérables) ;
- parallélisme : au moins deux pistes ouvertes à la fois dans chaque acte (sinon un groupe de 4 attend) ;
- convergence : chaque acte finit par un verrou qui demande ce qu'on a trouvé dans l'acte ;
- l'ordre imposé par le récit est aussi imposé par la mécanique (ou alors le récit s'adapte).

Écrire la simulation du moteur (`testing-and-qa.md`) **comme le parcours du graphe** : elle sert de preuve.

## 4. Types d'énigmes éprouvés (et ce qui les rend jouables en 3D)

| Type | Rendre jouable |
|---|---|
| Fouiller (paille, tiroir, poche) | objet qui apparaît là où l'on regarde ; zone de toucher généreuse |
| Cadenas / code | information trouvable par deux chemins ; blocage court après 3 erreurs |
| Objet à utiliser sur un autre | invite qui change avec l'objet en main ; message clair si mauvais objet |
| Combinaison d'objets | menu d'objet « Combiner » ; texte qui dit pourquoi ça ne marche pas |
| Rétablir l'énergie (fusibles, leviers) | fenêtre dédiée ; états lisibles ; retour sonore et visuel |
| Ordre / séquence (sons, notes) | rejouable ; transcription écrite quelque part pour les joueurs sans son |
| Observation (compter, comparer) | examen 3D avec boutons ; texte de plaque affiché ; indice qui dit « regardez sous tous les angles » |
| Communication entre joueurs | informations réparties de part et d'autre d'une séparation visible (barreaux, vitre) |
| Machine à états (radio, répondeur) | interface claire, persistance de l'état, messages explicites |
| Personnage (dialogue) | accessible par le judas/l'interphone **et** en face une fois la porte ouverte |
| Image partielle (vidéo masquée) | ce qui est caché l'est vraiment (contrôle au pixel), le reste est net |

## 5. Coopération et solo

- Séparer les joueurs au début (box, cellules, pièces) avec une **séparation visible** qui laisse se parler
  et se passer des objets (barreaux) : chacun a une moitié de l'information.
- Solo : le joueur incarne deux personnages et bascule (bouton « Changer ») ; toutes les énigmes de
  communication restent faisables seul. Un nouveau venu peut reprendre le second personnage.
- À 3 ou 4 : placer les joueurs en plus sur les côtés existants ; prévoir des tâches parallèles.
- Donner/passer des objets : règle claire (proximité, à travers des barreaux, ou par un passe-plat dans une
  vitre), retour visuel.
- **Joueurs à distance** (pas dans la même pièce réelle) : les énigmes de communication supposent qu'ils
  peuvent se parler. Prévoir une messagerie dans le journal (messages courts, visibles par tous) et
  conseiller en salle d'attente « appelez-vous pendant la partie ». Chaque information à transmettre doit
  pouvoir s'écrire en une ligne (un code, une couleur, une forme), pas exiger de décrire une image.

## 6. Indices

- Par **sujet** (une énigme ou une étape), trois niveaux : orientation → méthode → solution.
- Pénalité de temps affichée avant de consommer (confirmation en deux appuis), cumulée au score.
- Sujets visibles seulement quand ils sont pertinents (pas de sujet sur un lieu pas encore vu).
- Pour chaque énigme qui dépend d'un geste particulier (faire tourner un objet, appuyer longtemps, écouter),
  le niveau 1 doit le suggérer.
- Les indices sont la seule façon « officielle » d'aider : dans la conversation avec l'utilisateur, ne pas
  donner de solution sauf demande explicite (s'il demande, donner exactement ce qu'il demande).

## 7. Rythme, chrono, fin, score

- Durée cible par acte (ex. 25 / 35 / 30 min pour 1 h 30). Événements scénarisés à des minutes fixes
  (appel, aboiements, lumière au loin) pour relancer la tension et donner des pistes.
- Après la limite : la partie continue (menace qui monte), le score baisse ; ne jamais couper une partie
  presque finie.
- Fins multiples selon les choix (sauvé quelqu'un, preuve emportée, secours prévenus) ; score sur 100 avec
  détail (temps, indices, objectifs) ; écran de fin qui raconte ce qui s'est passé.
- Rejouabilité : variantes de codes possibles (graine) si le jeu sera rejoué par les mêmes personnes.

**Public enfants / tout public** :
- Le chrono raconte sans angoisser : « réserve d'énergie », « heure du goûter », pas « vous allez mourir » ;
  après la limite la partie continue, seul le score baisse, et l'intro le dit (« prenez votre temps »).
- Difficulté dès 10 ans : codes de 3–4 chiffres, une seule étape de déduction par énigme, consignes écrites
  en phrases courtes, aucune lecture d'heure ou calcul piège ; indices de niveau 1 très tôt proposés.
- Pas de peur, de sang ni de menace réelle ; la fin « ratée » reste douce (sauvés quand même, score plus bas).
- Faire relire le ton par l'agent « cohérence » avec cette consigne explicite.

## 8. Récit et cohérence

- Chaque objet, texte et événement doit être cohérent avec l'histoire (dates qui tombent les bons jours,
  noms, lieux) — faire relire par un agent dédié « cohérence ».
- Un changement d'état ne fait pas disparaître sans explication : si un personnage est libéré, il reste
  visible (assis, épuisé) ou part de façon visible ; le message le dit.
- Les messages du jeu sont des indices : « Le témoin du chargeur reste éteint : pas de courant dans cette
  prise » est bon — il dit pourquoi et oriente. Un refus muet est un bug.

## 9. Textes

- Langue de l'utilisateur ; typographie soignée (en français : espaces insécables avant `: ; ! ? »`, après
  `«`, entre nombre et unité ; guillemets « » ; apostrophes cohérentes).
- Messages courts dans les notifications (≤ 2 lignes) ; détails dans le journal.
- Pas de faute : relecture dédiée (agent « orthographe et typographie ») sur tous les textes visibles :
  client, serveur, indices, fin, salle d'attente, menus.

## 10. Liste de contrôle de conception

- [ ] Graphe sans blocage définitif, prouvé par la simulation à chaque nombre de joueurs prévu.
- [ ] Joueurs à distance : ils ont un moyen de se parler (messagerie, appel conseillé).
- [ ] Chaque information nécessaire existe sur deux canaux.
- [ ] Chaque énigme a 3 indices ; chaque geste spécial est suggéré au niveau 1.
- [ ] Chaque refus du serveur a un message qui explique.
- [ ] Rien d'indispensable ne dépend du son seul, de la couleur seule ou d'un détail < 1 cm à l'écran.
- [ ] Les fins et le score sont cohérents avec ce que les joueurs ont fait.
