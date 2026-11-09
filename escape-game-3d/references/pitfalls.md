# Catalogue des pièges réels

Chaque entrée vient d'un vrai signalement de joueur (ou d'une relecture) sur un escape game 3D en ligne.
Format : **symptôme** (ce que dit le joueur) → cause → détection → correction. Avant d'écrire une partie
du jeu, parcourir la section correspondante ; quand un joueur signale un défaut, chercher ici d'abord, puis
**contrôler toute la famille** (toutes les portes, tous les objets, tous les tiroirs…).

Sommaire : A. Portes et mécanismes · B. Visibilité · C. Objets mal placés · D. Escaliers et collisions ·
E. Éclairage · F. Visée et toucher · G. Fenêtres et interface · H. Serveur, réseau, parties ·
I. Contenu et information · J. Méthode (pièges de vérification)

## A. Portes et mécanismes

**A1. « La porte s'ouvre mais on ne peut pas passer »** — le battant pivote sur son centre (origine du nœud
au milieu du modèle) et reste en travers de l'embrasure ; sa collision aussi. *Détection* : lire l'origine
du nœud `door` dans le GLB (translation x ≈ 0 alors que la largeur ≈ 0,9) ; `audit-walk.cjs`. *Correction* :
insérer un pivot au bord des gonds (`hingeX = bbox.min.x` pour un battant normal, `max.x` pour le droit
d'une double porte), y rattacher le battant (`node.position.x -= hingeX`) et la boîte de collision.
Touchait 5 portes sur 13 (même modèle réutilisé).

**A2. « Le couvercle du congélateur s'ouvre au milieu »** — même cause pour couvercles et portes de
meubles. *Correction* : option `hinge` dans les animations ; pour un couvercle, pivot sur le bord
**inférieur arrière** (sinon un couvercle épais flotte au-dessus) ; pour une porte de frigo, bord droit si
elle tourne de +100° autour de y (pour qu'elle s'ouvre vers l'avant). *Détection* : lister toutes les
animations en rotation et la position de l'origine dans la boîte (0,5 = centre = suspect ; les
interrupteurs et molettes, eux, tournent au centre normalement).

**A3. Sens d'ouverture** — une porte qui s'ouvre vers un meuble ou un mur bloque. Choisir le sens par porte
et vérifier en capture.

## B. Visibilité

**B1. « Il y a un trou noir à la place de la porte »** — la porte était rangée dans le groupe de la pièce
d'un côté ; vue de l'autre côté (pièce non affichée car porte fermée), elle disparaît, et on ne peut pas la
toucher pour l'ouvrir. *Correction* : groupe propre à la porte, visible si l'une des deux pièces l'est.

**B2. « Le tableau électrique n'apparaît que dans certaines positions, sinon il disparaît du mur »** — un
objet mural à 15 cm de la limite était rangé dans la pièce voisine (règle « première pièce trouvée avec
30 cm de marge »). 13 objets concernés (trophées, horloge, interrupteurs, portemanteau…). *Correction* :
pièce qui contient strictement l'objet ; sinon celle vers laquelle il est tourné (point décalé de 30 cm
vers l'avant) ; sinon la plus proche. *Détection* : `audit-reach.cjs` (cibles « cachées » depuis leur pièce),
script statique qui compare l'ancienne et la nouvelle règle.

**B3. « Dans l'escalier on voit à travers les pièces un moment »** — l'épaisseur du plancher autour de la
trémie n'avait pas de parois : bandes de vide entre le haut des murs du bas et le bas des murs du haut.
*Correction* : parois de trémie (faces verticales sur l'épaisseur, ± 3 cm). *Détection* : captures image par
image de la montée (`audit-stairs.cjs --shots`).

**B4. Surfaces blanches au hasard** — cache de matériaux rempli après chargement : deux demandes simultanées
créent deux matériaux dont un sans textures. *Correction* : mettre la **promesse** en cache.

**B5. Géométrie en double** (scintillement, sol par-dessus une trémie) — pièce imbriquée non soustraite de
la pièce englobante. *Correction* : soustraire les intervalles des pièces imbriquées.

**B6. Murs à moitié noirs** (vus seulement sur la visite photo) — un mur du plan qui longe deux pièces a
reçu le matériau d'une seule (ou « extérieur ») sur toute sa longueur. Découper chaque mur aux limites des
pièces avant d'attribuer le matériau de chaque face (`world-building.md` §9).

## C. Objets mal placés

**C1. « Il y a plein d'objets qui lévitent »** — hauteurs saisies à la main (0,66 sur une table à 0,55 ;
objet à 30 cm du bord du bureau, donc au-dessus du sol). *Détection* : `audit-float.cjs` : pour chaque objet
posé (ni mural ni suspendu), rayons vers le bas depuis le **dessus** de l'objet ; écart base ↔ support.
*Correction* : recaler dans le plan (pas dans le client), régénérer, recontrôler, regarder les captures.

**C2. Objet caché derrière un meuble** (« je ne trouve pas le bouton vert dans la cuisine ») — un boîtier
mural indispensable fixé derrière le frigo. *Détection* : capture « vue joueur » de chaque cible
indispensable + `audit-reach.cjs` (aucun endroit libre d'où on le vise). *Correction* : déplacer sur un pan de
mur dégagé, à hauteur d'yeux, en vue en entrant dans la pièce.

**C3. « Je ne peux pas récupérer le fusible dans le tiroir »** — l'objet, enfant du nœud du tiroir, héritait
d'une échelle ~0,3 (taille 1 cm) et sa position locale le laissait au fond, sous le plateau qui déborde.
*Correction* : placement en coordonnées monde près de la façade (20 cm), compensation d'échelle, zone de
toucher invisible, préférence « objet derrière le bord d'un meuble ». *Piège de mesure* : après une
animation forcée, appeler `updateMatrixWorld(true)` avant de mesurer, sinon on vise l'ancienne position.

**C4. « On a ouvert la porte du saloir mais il n'y avait personne dedans »** — le personnage libéré était
masqué instantanément (« il vous suit » sans être montré). *Correction* : le laisser visible (pose
cohérente) et l'expliquer dans le message.

**C5. Modèle d'une pose donnée (assis) déplacé debout** — un personnage assis déplacé près d'une porte
était caché derrière le chambranle (« on ne voit qu'une main »). Vérifier toute nouvelle position en capture.

## D. Escaliers et collisions

**D1. « Pas sûr qu'on puisse monter l'escalier »** — un volume de collision « sol extérieur de secours »
couvrait toute la carte juste sous le plancher, y compris la trémie : tête qui bute à la 3ᵉ marche, sol
invisible au-dessus du vide en descendant. *Correction* : découper ces volumes autour du bâtiment.
*Détection* : `audit-stairs.cjs` (monter et descendre réellement, sur plusieurs lignes).

**D2. Portes infranchissables** — voir A1. Contrôle : `audit-walk.cjs` (les portes qui terminent la partie
peuvent rester bloquées dans un sens : normal).

**D3. Pente trop forte / plafond trop bas** — vérifier pente ≤ 40° et garde au plafond sur toute la
montée.

## E. Éclairage

**E1. « La lampe torche passe à travers les murs »** — les maillages d'architecture ne projetaient pas
d'ombre (`castShadow = false`) et l'ombre de la lampe était coupée sur les appareils « peu puissants »
(critère : mobile ≤ 4 cœurs, donc presque tous). *Correction* : murs `castShadow = true`, ombre de la lampe
toujours active (carte 512 sur mobile), mise à jour seulement lampe allumée.

**E2. Pièce trop sombre / « lave »** — exposition et gains par pièce ; textures mal tuilées ; régler sur la
visite photographique, allumé et de nuit.

**E3. Luminaire sans lumière / lumière sans luminaire** — chaque source dans un luminaire visible, et
inversement.

## F. Visée et toucher

**F1. « Sur tablette, j'ai du mal à atteindre certaines choses »** — tout toucher dans les 42 % gauche de
l'écran partait au joystick : impossible de toucher un objet à gauche. *Correction* : toucher court sans
glisser = interagir aussi dans la zone du joystick ; tolérance autour du doigt (couronnes 14/28 px) ;
invite touchable ; tolérance autour du viseur.

**F2. « Quand je clique sur Brancher le téléphone, ça ne marche pas »** (ordinateur) — avec la souris libérée
(après choix dans l'inventaire), le clic ne faisait que recapturer le pointeur. *Correction* : agir sur
l'objet cliqué/visé puis recapturer.

**F3. Petits objets impossibles à viser** (bobine de câble : le rayon passe par le trou) — zone de toucher
invisible ≥ 7 cm.

**F4. Cible sans traitement client** (« on ne peut pas parler à Inès, il ne se passe rien ») — le serveur
renvoyait `data: { dialog }` pour une cible que le client envoyait au cas par défaut, sans lire `data`.
*Détection* : croiser les cibles du plan, les `case` du client et du serveur, et les clés de `data`.

**F5. « Hors de portée » alors qu'on touche l'objet** — zone serveur ≠ ce que le client permet de viser
(limite de zone 20 cm au-delà du mur, joueur dans l'embrasure). *Correction* : tolérance de 60 cm au seuil
d'une zone reliée par une porte ouverte ou un passage, jamais à travers des barreaux.

**F6. Passe-plat visé par son tunnel** — à travers l'ouverture d'un passe-plat, le rayon touche la face de
l'autre pièce : le serveur répond « hors de portée ». Une cible par face, et le fond du tunnel bloque la
visée (voir `world-building.md` §3).

## G. Fenêtres et interface

**G1. « On ne peut pas faire tourner les trophées (pour compter les cors) »** — la fenêtre d'examen se
fermait au premier contact (fermeture au `pointerdown` sur le fond = la surface de rotation) ; le défilement
de la fenêtre coupait le geste sur tablette. *Correction* : pas de fermeture au fond pour l'examen 3D
(fermer sur toucher court sans glisser), `touch-action: none`, **boutons** tourner/pencher/zoomer. Et ne
pas affirmer à la légère qu'un geste « ne sert à rien » : vérifier dans les énigmes.

**G2. « Je peux seulement faire pause, pas recommencer »** — prévoir Recommencer dans le menu et l'écran de
pause, deux appuis, pour tous, message en salle d'attente.

**G3. Bouton du menu périmé** — état capturé à l'ouverture ; lire l'état au clic, redessiner sur changement.

**G4. Pause lancée par un autre joueur sur ordinateur** — pointeur resté verrouillé, impossible de cliquer
« Reprendre ». Libérer le pointeur quand la pause arrive.

**G5. Capture de touche restée armée** après fermeture du menu → la touche suivante (Z) est réaffectée et le
joueur ne peut plus avancer. Annuler la capture à la fermeture.

**G6. Changer de personnage pendant une fenêtre** → la fenêtre agit avec l'autre corps (« hors de portée »).

**G7. « Je ne peux pas cliquer sur Nouvelle partie »** (ordinateur) — le pointeur est resté verrouillé à
l'écran de fin ; et pendant le jeu, un bouton du HUD sans touche est inaccessible tant que le pointeur est
verrouillé. Libérer le pointeur à la fin ; une touche par bouton.
Interdire.

## H. Serveur, réseau, parties

**H1. Un 5ᵉ appareil vide la salle d'attente pleine** — nettoyage `offlineFor(pid) >= 0` vrai pour les
connectés. Toujours tester « pas connecté » d'abord.

**H2. Connexion zombie à la reconnexion** — l'ancienne WebSocket continue d'émettre : faux « connexion
perdue », actions annoncées perdues, sons en double. Ignorer les événements d'une connexion remplacée.

**H3. Identifiants hérités** (`__proto__`) → pollution de prototype. Refuser.

**H4. Mise en ligne pendant une partie** — redémarrer le serveur ne doit pas perdre la partie : état sur
disque, reprise en pause, message ; dire aux joueurs « rechargez puis Reprendre ».

**H5. Gyroscope perdu à chaque rechargement** — mémoriser et réactiver au premier geste.

**H6. Joueur « fantôme » toujours en ligne** — un téléphone perd le réseau sans fermer la WebSocket : le
serveur le croit connecté de longues minutes (pas de pause automatique, personnage non reprenable). Le
client envoie `ping` toutes les ~4 s ; `tick()` ferme les connexions muettes depuis ~20 s.

**H7. Serveur planté par une trame géante** — une trame > `maxPayload` sans écouteur `error` sur la
connexion fait tomber le processus pour tout le monde. Écouteur `error` sur chaque connexion.

**H8. N'importe qui peut vider la partie** — API de remise à zéro « protégée » par le mot public `RESET`.
Jeton secret ou requête locale uniquement.

**H9. Tests de simulation qui échouent au premier lancement** — horloge avancée de plusieurs minutes d'un
coup (pause automatique déclenchée, événements ratés) ou connexions factices fermées faute de `ping`.
Avancer seconde par seconde avec `tick()` et faire « pinger » les connexions factices.

## I. Contenu et information

**I1. « Une grosse boule beige sur tous les chiffres »** (vidéo d'un code tapé) — le masque était deux
ellipses ; illisible et pris pour un bug. Dessiner une main reconnaissable (doigts, ongles, pouce, manche)
et vérifier au pixel que les chiffres censés être cachés le sont et que les autres sont nets.

**I2. Messages muets** — un refus sans explication est vécu comme un bug ; chaque refus dit pourquoi.

**I3. Information sur un seul canal** — un joueur sans son ou daltonien bloque ; doubler.

## J. Pièges de vérification (le contrôle qui ment)

- Rayon tiré depuis la **base** d'un objet un peu enfoncé : il traverse le plateau (faces arrière ignorées)
  et touche le sol → faux « flotte de 70 cm ». Tirer depuis le dessus.
- Matrices pas à jour après une animation forcée → on mesure l'ancienne position.
- Visibilité testée avant d'avoir déplacé la caméra → faux « caché ».
- Compilation vers le mauvais dossier (`$PWD` dans un sous-shell) → on teste l'ancienne version.
- Arguments mal découpés par le shell (zsh ne coupe pas `$cmd`) → tests « réussis » sans avoir tourné.
- Firefox de Playwright peut refuser de démarrer sur certaines machines : le dire, tester WebKit + Chromium.
- Un contrôle vert ne prouve pas qu'on **voit** : toujours regarder les captures.
- Joueur placé contre un meuble puis joystick poussé vers lui → faux « le joystick ne fait plus avancer ».
  Tester le joystick dans un espace dégagé (`audit-tap` le fait désormais).
- Caisse posée au sol près d'un mur prise pour un objet mural → faux « décollé du mur ». Marquer `wall:
  true/false` dans le plan ; `audit-float` ne devine plus « mural » pour un objet qui repose sur un support.
- Zone de toucher invisible plus grande que l'objet comptée dans sa boîte → faux « enfoncé ». Les zones de
  toucher sont `visible = false` (ou `material.visible = false`) et les contrôles ne mesurent que le visible.
- Un contrôle « réussi » sans avoir testé une partie (glisser tactile sous WebKit) doit le dire dans son
  verdict, sinon on croit l'examen 3D validé au doigt.
