---
name: escape-game-3d
description: Concevoir, construire, tester et mettre en ligne un escape game 3D jouable dans le navigateur (téléphone, tablette, ordinateur ; 1 à 4 joueurs en ligne), de n'importe quel thème (enquête, science-fiction, aventure, fantastique, horreur, musée, famille…), où chaque objet est visible, atteignable et fonctionnel. Utiliser ce skill dès qu'on demande un jeu d'évasion, un escape room, un jeu d'énigmes en vue à la première personne, un « point & click » 3D, une salle d'énigmes multijoueur, une enquête ou une aventure 3D à explorer pièce par pièce en ligne (escape room game, WebGL/Three.js first-person puzzle, multiplayer browser puzzle game), ou qu'on doit corriger un tel jeu (objets qui lévitent, portes qui bloquent, objets introuvables, touches tactiles qui ne marchent pas…), même si le mot « escape game » n'est pas prononcé. Ne pas l'utiliser pour un escape room physique ou sur papier, un jeu 2D, Unity/Godot/Unreal ou une simple visite 3D sans énigmes.
---

# Escape game 3D jouable partout

Ce skill condense la construction complète d'un vrai escape game 3D multijoueur (Three.js + serveur Node
autoritaire), et surtout **tous les bugs rencontrés en le faisant jouer à de vrais joueurs**. Le piège de ce
genre de projet n'est pas d'écrire le code : c'est qu'un jeu qui « passe les tests » peut rester injouable
parce qu'un objet clé est caché derrière un meuble, qu'une porte pivote au milieu de l'embrasure, que le doigt
ne peut pas toucher la moitié gauche de l'écran ou qu'un escalier bloque à la troisième marche. Les joueurs
découvrent ces défauts en cinq minutes ; les tests unitaires, jamais.

Le principe directeur : **tout ce qui est nécessaire pour finir doit être vu, atteint et actionné par un
joueur réel, sur chaque appareil** — et on le prouve avec des contrôles automatiques dans un vrai navigateur,
pas en relisant le code.

## Quand lire quoi

| Besoin | Fichier |
|---|---|
| **Démarrer de zéro** : niveaux de finition, versions, squelette, schéma du plan, modèles 3D par thème, hébergement | `references/bootstrap.md` |
| Architecture serveur/client, protocole, état, structure des fichiers | `references/architecture.md` |
| **Squelette du client** : boucle, joystick, toucher, souris, collisions, visée avec tolérance | `references/client-skeleton.md` |
| Plan du lieu, murs, portes, escaliers, objets, éclairage, ressources 3D | `references/world-building.md` |
| Viser, toucher, joystick, souris, fenêtres d'énigmes, examen 3D | `references/interaction-input.md` |
| Énigmes, coopération, indices, récit, fin, rejouabilité | `references/puzzle-design.md` |
| **Catalogue des bugs réels, comment les détecter et les corriger** | `references/pitfalls.md` |
| Contrôles automatiques, parcours complets, captures, critères de sortie | `references/testing-and-qa.md` |
| Paquet, déploiement avec sauvegarde, mises à jour en cours de partie | `references/deployment.md` |
| Scripts de contrôle prêts à l'emploi (Playwright) | `scripts/` (voir `scripts/README.md`) |

Pour un nouveau projet, commencer par `references/bootstrap.md` (choisir le niveau N1/N2/N3 : les lightmaps
sont facultatives). Pour le client, partir de `references/client-skeleton.md` (c'est la partie la plus longue à écrire). Lire `references/pitfalls.md` **avant** d'écrire le monde 3D : la plupart des pièges se préviennent au
moment de la conception pour presque rien, alors qu'ils coûtent cher une fois des joueurs bloqués.

## Déroulé recommandé

Travailler par phases, chacune fermée par une vérification. Ne pas passer à la suivante avec des échecs.

### 1. Cadrer (questions à poser si l'utilisateur ne l'a pas dit)
- Thème, ton, public (enfants ? adultes ? sang, peur, humour ?), langue des textes.
- Durée visée (45 min, 1 h 30…), nombre de joueurs (solo jouable ? 2 à 4 ?), même pièce ou à distance.
- Joueurs à distance : comment se parlent-ils ? Par défaut, une messagerie dans le journal du jeu, et la
  salle d'attente conseille un appel vocal (téléphone, visio). Sans cela, la coopération à distance est muette.
- Personnages : par défaut, ils ont un nom fixe donné par le récit (les documents du jeu les nomment) et
  le prénom du joueur s'affiche à côté (« Inspectrice Morel · Paul »). Ne pas faire dépendre les textes du prénom saisi.
- Appareils : téléphone (paysage conseillé), tablette, ordinateur clavier/souris/pavé tactile.
- Hébergement : serveur existant ? domaine ? Docker ? Faut-il sauvegarder avant chaque mise en ligne ? Ou
  simple livraison locale (lancer sur sa machine, jouer sur le réseau de la maison) ?
- Spoilers : l'utilisateur va-t-il jouer lui-même ? Si oui, **ne jamais révéler énigmes ni solutions dans
  la conversation** (même dans les comptes rendus de tests) sauf demande explicite.

### 2. Concevoir le jeu sur papier (avant toute 3D)
Écrire un document de conception court (voir `references/puzzle-design.md`) :
- le récit en trois actes, l'objectif, la (les) fin(s) et le score ;
- le **graphe des énigmes** : chaque énigme = entrées (objets, informations) → action → sorties ;
  vérifier qu'il n'existe aucun blocage définitif (objet consommé deux fois, porte qui ne se rouvre pas…) ;
- pour le multijoueur : ce qui force la coopération (zones séparées, informations réparties) et comment le
  solo reste possible (au choix : un joueur incarne plusieurs personnages, ou énigmes adaptées au solo) ;
- trois niveaux d'indices par sujet, avec pénalité de temps ;
- pour chaque information nécessaire, **au moins deux canaux** (visuel + texte, ou son + visuel) : un joueur
  sans son, daltonien ou sur petit écran doit pouvoir finir.

### 3. Écrire le moteur de jeu côté serveur et le tester seul
Le serveur décide de tout (état, portes, objets, zones, chrono, indices) ; le client ne fait qu'afficher et
demander. Écrire tout de suite une simulation complète en Node (connexions factices, horloge simulée) qui
joue la partie de bout en bout à chaque nombre de joueurs prévu (de 1 au maximum du jeu), plus un appareil
de trop, pause, reprise, recommencer, déconnexion, connexion muette, reconnexion, arrivée en cours de partie. Voir `references/architecture.md` et `references/testing-and-qa.md`.

### 4. Construire le monde 3D à partir d'un plan unique
Un seul fichier de plan (JSON généré par un script) décrit pièces, murs, ouvertures, dalles et trémies,
escaliers, portes, fenêtres, objets, lumières et zones. Le serveur, le client, le générateur d'architecture
et la cuisson d'éclairage le lisent tous : jamais deux sources de vérité. Voir `references/world-building.md`.

### 5. Brancher interactions, interface et son
Viser au centre (ordinateur) ou toucher au doigt (tactile), portée limitée, jamais à travers un mur ;
fenêtres d'énigmes ; inventaire ; journal ; indices ; menu (pause pour tous, recommencer pour tous, réglages,
touches) ; salle d'attente ; écran de fin. Voir `references/interaction-input.md`.

### 6. Contrôler comme un joueur, dans de vrais navigateurs
Lancer **tous** les contrôles de `scripts/` (objets qui lévitent, portée de chaque cible, passage de chaque
porte, escalier, visite photographique, toucher tactile, examen 3D, recommencer, parties complètes) sur
WebKit (Safari iOS) et Chromium (Android, ordinateur), sur les formats de `scripts/lib.cjs` (`DEVICES` :
téléphone paysage/portrait, iPad 768/1024, tablette, Android, ordinateur 1280/1440). Regarder les captures soi-même : un contrôle vert ne prouve pas qu'on voit l'objet.

### 7. Relire, puis mettre en ligne avec sauvegarde
Trois relectures indépendantes : fautes et typographie, cohérence du récit et des énigmes, bugs (une
relecture du code par un agent à part trouve souvent 5 à 10 vrais bugs). Puis paquet de production,
sauvegarde du serveur, déploiement, vérification publique. Voir `references/deployment.md`.

## Invariants à respecter partout

Ces règles viennent chacune d'un bug qui a bloqué de vrais joueurs (détails dans `references/pitfalls.md`).

**Monde**
- Chaque battant de porte, couvercle ou porte de meuble pivote sur **sa charnière**, pas sur son centre :
  vérifier l'origine du nœud dans le modèle et insérer un pivot si besoin. Une porte coulissante glisse
  dans son rail jusqu'à dégager toute l'embrasure. La collision suit le battant.
- Une porte appartient aux **deux** pièces qu'elle sépare pour l'affichage (sinon, vue de l'autre côté,
  elle disparaît et laisse un trou noir impossible à toucher).
- Un objet mural est rangé dans la pièce **vers laquelle il est tourné**, pas « la première pièce trouvée
  avec une marge » (sinon il disparaît selon l'endroit d'où l'on regarde).
- Rien de nécessaire n'est derrière un meuble, sous un plateau ou au fond d'un tiroir que le plateau cache.
- Aucun objet ne flotte ni ne s'enfonce : chaque objet posé repose sur un support (contrôle automatique).
- Les trémies (escalier, monte-charge) ont des parois sur toute l'épaisseur du plancher ; aucun volume de
  collision « de secours » ne recouvre une trémie.
- Si le joueur a une lampe : les murs projettent son ombre, sur tous les appareils, sinon la lumière traverse.
- Un objet rangé dans un sous-nœud animé (tiroir) garde sa taille réelle (compenser l'échelle du nœud).
- Un personnage ou objet qui change d'état ne disparaît pas sans explication visible.

**Interactions**
- Toute cible que le client sait viser a un traitement côté client **et** côté serveur ; toute réponse du
  serveur qui demande d'ouvrir quelque chose (fenêtre, dialogue) est gérée par le client.
- La tolérance de portée du serveur couvre ce que le client permet de viser (seuil d'une porte ouverte,
  embrasure), sans jamais traverser des barreaux ou une porte fermée.
- Tactile : un toucher court agit **partout** à l'écran, y compris dans la zone du joystick ; tolérance de
  ~1 cm autour du doigt ; l'invite affichée sous le viseur se touche aussi.
- Ordinateur : le clic qui recapture la souris agit aussi (sinon le premier clic après l'inventaire est perdu).
  Pointeur verrouillé = aucun bouton du HUD cliquable : chaque bouton a sa touche ; le pointeur est libéré
  à la pause, à l'ouverture d'un panneau **et à l'écran de fin**.
- Les petits objets à prendre ont une zone de toucher invisible plus grande qu'eux.
- L'examen 3D tourne au glisser **et** avec des boutons ; toucher le fond ne ferme pas pendant un glisser.
- Pause lancée par un autre joueur : libérer le pointeur ; panneaux qui reflètent l'état réel.

**Réseau et parties**
- Recommencer est possible à tout moment (confirmation en deux temps, pour tout le monde) ; revenir en salle
  d'attente recharge proprement le client.
- Un appareil de trop ne doit jamais éjecter les joueurs connectés ; une reconnexion ne doit jamais laisser
  deux connexions vivantes.
- Les identifiants envoyés par le client ne peuvent pas viser des propriétés héritées (`__proto__`…).
- Le serveur coupe une connexion muette (pas de message depuis ~20 s) : sinon un téléphone qui a perdu le
  réseau reste « en ligne » de longues minutes (pas de pause automatique, personnage non reprenable).
- La remise à zéro administrateur exige un jeton secret ou une requête locale : un mot de confirmation
  public (`RESET`) ne protège rien.

**Information**
- Ce qu'une image doit cacher (code masqué par une main…) est vérifié au pixel ; ce qu'elle doit montrer
  aussi.
- Le texte utile d'un objet examiné est toujours écrit dans la carte, en plus du modèle 3D.

## Méthode de travail qui a fait ses preuves

- **Un correctif = une cause comprise + un contrôle qui le prouve** (capture, mesure, test). Quand un joueur
  signale « ça ne marche pas », reproduire d'abord dans le navigateur avec une capture, chercher toute la
  famille du défaut (si une porte pivote mal, vérifier toutes les portes ; si un objet est caché, contrôler
  tous les objets), corriger à la source (le plan, pas une rustine sur un objet), puis relancer la batterie.
- **Les captures sont la vérité** : après chaque changement visuel, regarder l'image. Une mesure peut
  mentir (rayon tiré depuis l'intérieur d'un meuble, matrices pas encore mises à jour, mauvais dossier
  compilé) ; une image d'avant/après tranche.
- **Garder les joueurs en jeu** : si l'utilisateur joue pendant les correctifs, mettre en ligne vite et par
  petits lots, conserver la partie en cours (sauvegarde de l'état, reprise en pause), et lui dire
  « rechargez la page puis Reprendre ». Ne jamais réinitialiser une partie en cours sans accord.
- Respecter les consignes de l'utilisateur sur les secrets et l'accès (ne pas lire de fichiers de secrets,
  ne pas rajouter de protection qu'il a retirée, ne pas mettre en ligne sans son accord).

## Livrables attendus

1. Le jeu en ligne (ou livré en local si l'utilisateur ne veut pas d'hébergement : même paquet, commande de
   lancement et adresse à ouvrir sur les autres appareils documentées), jouable de bout en bout à chaque
   nombre de joueurs prévu sur téléphone, tablette, ordinateur.
2. Les scripts de construction (plan, architecture, ressources, éclairage, client) et de contrôle.
3. Un compte rendu honnête : ce qui a été vérifié (avec quels navigateurs et formats), ce qui ne l'a pas été
   (appareils physiques, Firefox s'il n'a pas pu tourner…), sans dévoiler les énigmes si l'utilisateur joue.
