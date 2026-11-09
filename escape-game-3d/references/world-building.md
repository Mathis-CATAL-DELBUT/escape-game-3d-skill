# Construire le monde 3D

Sommaire : 1. Le plan unique · 2. Repère et échelles · 3. Pièces, zones, liaisons · 4. Murs, ouvertures,
dalles, trémies · 5. Escaliers · 6. Portes · 7. Objets (props) · 8. Objets rangés et animés ·
9. Architecture générée · 10. Éclairage · 11. Ressources 3D · 12. Visibilité par pièce · 13. Liste de contrôle

## 1. Le plan unique

Un script (`build/make-layout.js`) écrit `public/<jeu>/data/layout.json`. Tout le monde le lit : serveur
(zones, liaisons), client (rendu, collisions, objets, portes), générateur d'architecture, cuisson Blender.
Avantage décisif : corriger une position = changer une ligne, régénérer, et tout suit. Après chaque
régénération, **comparer l'ancien et le nouveau JSON** (seuls les objets voulus doivent changer).

Écrire le plan avec de petites fonctions déclaratives :

```js
room('cuisine', 'g', [x0, z0, x1, z1], 'Cuisine', [solMat, murMat, plafondMat, lambrisOpt], groupesLumiere, { lm: 512 });
wall('g_w', 'g', x0, z0, x1, z1, [op('door_back', a0, a1, 0, 2.05, 'door'), op('win', a0, a1, 0.95, 2.25, 'window')]);
P('gate_box', 'gate_switch_box', x, y, z, yaw, { col: 'none', t: 'boitier_grille' });   // objet + cible
door('door_kitchen', 'door_panel', 'g_mid', a0, a1, 'g', ['kitchen', 'salon'], 'x+', { state: 'closed' });
```

## 2. Repère et échelles

- Mètres. x vers l'est, y vers le haut, z vers le sud ; origine à un angle ; étages à hauteur fixe
  (ex. cave sol −2,8 / plafond −0,3 ; rez-de-chaussée sol 0 / plafond 3,0).
- Hauteurs de référence (un adulte doit pouvoir tout atteindre debout) : œil 1,60 m (accroupi 0,98) ;
  plan de travail 0,90 ; table 0,75 ; bureau 0,76 ; interrupteur 1,10–1,20 ; boîtier mural 1,30–1,50 ;
  tableau/cadre 1,50–1,70 ; portée de visée ≈ 2,4 m (3,4 m pour les objets en hauteur).
- Portes 0,9 × 2,05 m minimum ; couloirs ≥ 1,2 m ; capsule du joueur ≈ rayon 0,3 m → laisser 0,7 m libres
  autour de tout ce qu'on doit approcher.

## 3. Pièces, zones, liaisons

- **Pièce** (rendu + lumière) : rectangle, matériaux, groupes de lumières, résolution de lightmap.
- **Zone** (règles du serveur) : rectangle où se trouve un personnage (`box1`, `couloir`…). Plusieurs zones
  peuvent partager une pièce (box séparés par des barreaux dans un même chenil).
- **Liaison** `[zoneA, zoneB, comment]` : `'open'` (passage), `'bars'` (on se voit et se passe des objets,
  on ne passe pas), `'glass'` (vitre : on se voit, on ne passe pas, on ne vise pas à travers), ou l'id d'une
  porte (ouverte ou non).
- **Passe-plat** (échanger des objets à travers une vitre ou un mur) : un objet traversant qui appartient
  aux **deux** zones côté serveur (déposer d'un côté, prendre de l'autre). Côté client, chaque face a sa
  propre cible et le tunnel ne doit pas laisser viser la face de l'autre pièce (sinon « hors de portée ») :
  vérifier avec `audit-reach` et une capture. Sert au serveur (passer un objet, voir,
  tolérance de seuil) et au client (visibilité des pièces).
- **Aligner** les limites de zones sur le plan des murs, ou au moins savoir de combien elles débordent.

## 4. Murs, ouvertures, dalles, trémies

- Murs = boîtes alignées sur les axes ; ouvertures (porte, fenêtre, passage) le long de l'axe long. Les
  collisions viennent du plan (murs découpés autour des ouvertures + linteaux), pas des maillages.
- Dalles = sols/plafonds avec **trémies** (escalier, monte-charge). Les collisions sont découpées autour des
  trémies (soustraction de rectangles).
- **Parois de trémie** : ajouter des faces verticales sur toute l'épaisseur du plancher autour de chaque
  trémie (de `y0 − 3 cm` à `y1 + 3 cm`). Sans elles, en montant l'escalier, on voit le vide (bandes de
  couleur de fond) entre le haut des murs du bas et le bas des murs du haut.
- Volumes « de secours » (sol extérieur, marges) : **les découper autour de l'emprise du bâtiment**. Un
  sol extérieur posé sur toute la carte sous le plancher bouchait la trémie : la tête butait à la 3ᵉ
  marche en montant, et on marchait sur du vide en descendant.

## 5. Escaliers

- Collision : un plan incliné plein (coin) sous les marches, plus confortable que des marches.
  Pente ≤ 40° ; vérifier la limite de pente du contrôleur et la garde au plafond (tête + 0,1 m) sur toute
  la montée.
- Visuel : marches modélisées ; matériau distinct ; éclairage cuit dans la cage.
- Visibilité : pendant la montée, la caméra passe d'un étage à l'autre ; vérifier image par image
  (`scripts/audit-stairs.cjs` + captures) qu'aucun vide n'apparaît et que les pièces nécessaires sont
  affichées des deux côtés.

## 6. Portes

- Modèle avec un nœud `door` (ou `leaf_l`/`leaf_r` pour une double porte) et un cadre. **Vérifier
  l'origine du battant** : si elle est au centre (fréquent dans les modèles téléchargés), insérer un groupe
  pivot sur le bord des gonds (bord gauche pour un battant normal, bord droit pour le battant droit), et y
  rattacher le battant et sa boîte de collision. Sinon la porte tourne sur elle-même au milieu de
  l'embrasure et bloque le passage.
- Sens d'ouverture par porte (`front`/`back`), angle (80–100°), animation adoucie.
- **Porte coulissante** (station, magasin, ascenseur, japonais) : `kind: 'slide'`, le battant glisse dans le
  mur (ou devant) d'au moins toute la largeur de l'embrasure ; `open` ∈ [0, 1] commande une translation au
  lieu d'une rotation, le reste du contrat (`setDoorAngle`, collision qui suit le battant, `audit-walk`) est
  identique. Prévoir un logement dans le mur ou un battant devant le mur, jamais à travers un meuble.
- Collision : une boîte par battant, liée au battant, mise à jour à la fin de l'animation.
- Affichage : la porte appartient aux deux pièces qu'elle sépare (groupe à part, visible si l'une des deux
  pièces l'est). Rangée dans une seule pièce, une porte fermée disparaît vue de l'autre côté.
- Contrôle obligatoire : `scripts/audit-walk.cjs` (chaque porte ouverte se franchit dans les deux sens) et
  une capture de chaque porte ouverte.

## 7. Objets (props)

- Chaque objet : `id`, `model`, `pos`, `yaw`, collision (`box`, `cyl`, `none`, `bars`), cible `t`
  (interaction), options (`light`, `dyn`, `hiddenUntil`, `attach`, `scale`, `face` pour un texte).
- **Pièce d'un objet** : celle qui le contient ; sinon (objet mural dans l'épaisseur) celle vers laquelle
  il est tourné ; sinon la plus proche. Jamais « la première trouvée avec une marge ».
- **Poser** chaque objet sur son support (sol, table, étagère) au centimètre : lancer `audit-float.cjs`
  après chaque modification du plan ; il mesure l'écart entre la base de l'objet et la surface en dessous
  (en tirant depuis le **dessus** de l'objet, sinon un objet un peu enfoncé fait croire qu'il flotte).
- Vérifier qu'un objet posé sur un meuble est **sur** le meuble (empreinte dans le plateau), pas à côté :
  un objet à 30 cm du bord d'un bureau flotte au-dessus du sol.
- Objets interactifs : jamais derrière un meuble, sous un plateau, dans un angle mort ou à plus de 1,8 m
  de haut ; vérifier avec `audit-reach.cjs` (visée réelle depuis un endroit libre du sol) **et** avec une
  capture « vue du joueur ».
- Objets muraux : dos contre le mur (≤ 3 cm d'écart), à hauteur d'yeux pour ce qu'on doit lire.
- Personnages non joueurs : choisir une pose cohérente avec l'histoire et la garder visible après un
  changement d'état (ne pas faire disparaître quelqu'un « qui vous suit » sans le montrer).

## 8. Objets rangés et pièces animées

- Animations déclaratives par modèle : `{ partie: { t: [dx,dy,dz], r: [rx,ry,rz], when: (s) => ..., speed,
  via: { t, r, at }, hinge: 'z-' } }`. `via` = étape intermédiaire (la pierre sort du mur puis tombe).
- **Charnières** : couvercles (congélateur, coffre, caisse, sac) et portes de meubles (frigo, armoire)
  pivotent sur un bord. Si l'origine du nœud est au centre, insérer un pivot sur le bord indiqué
  (`hinge: 'z-'` = arrière ; pour un couvercle, l'articulation est sur le **bord inférieur** arrière ;
  porte de meuble : bord gauche/droit selon le sens d'ouverture). Vérifier en capture : rien ne doit
  flotter, ni passer à travers le meuble.
- **Objets dans un tiroir** : le nœud du tiroir a souvent une échelle interne (≈ 0,3 avec la quantification
  glTF). Un objet rattaché sans compensation fait 1 cm et sa position locale part au fond du tiroir, sous
  le plateau. Placer l'objet en coordonnées monde (au fond, à ~20 cm de la façade côté pièce), convertir
  en local, et compenser l'échelle (`obj.scale = 1 / échelleMondeDuParent`). Mettre à jour les matrices
  (`updateMatrixWorld`) avant toute mesure.
- **Zone de toucher invisible** pour tout petit objet à prendre (boîte un peu plus grande que l'objet,
  au moins 7 cm, matériau `visible: false`, enregistrée comme la même cible) : câble enroulé, bague, clé.
- **Objet caché jusqu'à une action** (`hiddenUntil`/`reveal`) : vérifier qu'il apparaît là où on regarde
  quand le meuble s'ouvre, et qu'il est atteignable à ce moment-là.

## 9. Architecture générée

`build/make-arch.js` produit un GLB par pièce depuis le plan : sols, plafonds, murs (faces intérieures,
découpées autour des ouvertures et des pièces imbriquées), embrasures, plinthes/lambris. UV0 en
coordonnées monde / taille de la texture (raccords parfaits) ; UV1 = atlas de lightmap déterministe.
- Pièce imbriquée dans une autre (palier dans un vestibule) : soustraire ses intervalles des murs et sols de
  la pièce englobante, sinon géométrie en double (scintillement, sol par-dessus une trémie).
- **Matériau de chaque face de mur** : celui de la pièce vers laquelle la face est tournée. Un mur du plan
  qui longe plusieurs pièces doit être **découpé aux limites des pièces** avant d'attribuer les matériaux
  (même quand les murs sont construits à l'exécution plutôt qu'en GLB) ; sinon le segment à cheval reçoit
  le matériau « extérieur » ou celui de la mauvaise pièce (murs à moitié noirs, visibles seulement en
  capture).
- Comparer les GLB produits aux précédents (`cmp`) et ne copier que ceux qui ont changé.

## 10. Éclairage

Niveau N1/N2 : hémisphère faible + lumières ponctuelles près des luminaires + matériaux émissifs (écrans,
néons) ; ombres seulement pour la lampe du joueur. Niveau N3 : cuisson ci-dessous.

- Lightmaps cuites dans Blender (Cycles) par pièce, **un canal par groupe de lumières** (ex. r = plafonnier,
  g = lune, b = feu), pour pouvoir allumer/éteindre chaque groupe en jeu (uniformes par pièce). Les meubles
  fixes bloquent la lumière pendant la cuisson ; ignorer les objets dynamiques ou rattachés.
- Les lampes du plan doivent être **dans** leur luminaire (pas enfermées dans le verre ni à côté), et tout
  luminaire visible doit avoir une lumière (sinon une pièce s'éclaire « sans lampe »).
- Exposition et gains par pièce à régler en regardant la visite photographique, de nuit (lampe torche
  seule) comme lumières allumées : sombre et lisible, jamais noir complet sur un endroit où il faut agir.
- La lampe du joueur : projecteur avec ombre (carte 512 sur mobile, 1024 sinon), ombre mise à jour
  seulement lampe allumée ; **les murs et sols projettent l'ombre** (`castShadow = true`). Sans cela elle
  éclaire les pièces voisines à travers les murs.

## 11. Ressources 3D

- Sources par thème : voir `bootstrap.md` §6. Modèles et textures **CC0** de préférence, ou générés en code.
  Noter auteur et licence. Modèles génériques réutilisables de toutes thématiques : meubles, lampes,
  portes, coffres, cadenas, claviers, boîtiers, papiers (générés en canvas pour le texte).
- Pipeline (`build/build-assets.js`) : simplification, dédoublonnage des textures, KTX2 (basisu) en 1k
  max, géométrie meshopt, paquets de modèles, manifeste. Vérifier les modèles manquants avant de publier.
- Textes lisibles sur des objets (étiquettes, notes, plaques) : textures générées (canvas) appliquées sur
  un nœud `*_face` ; le texte est aussi affiché dans la fenêtre d'examen.
- `MODEL_FIX` par modèle (rotation, échelle, origine) pour les modèles mal orientés ; le vérifier en
  capture plutôt que de deviner.

## 12. Visibilité par pièce

- N'afficher que la pièce de la caméra et ses voisines par les liaisons ouvertes (profondeur 2).
- Pièges : porte rangée dans une seule pièce (disparaît d'un côté) ; objet mural rangé dans la mauvaise
  pièce (disparaît selon la position) ; caméra entre deux étages (escalier) ; pièce imbriquée. Le contrôle
  `audit-reach.cjs` signale les cibles « cachées » vues depuis leur propre pièce : c'est presque toujours
  l'un de ces pièges.

## 13. Liste de contrôle du monde (à refaire après chaque changement du plan)

1. `audit-float.cjs` : aucun objet posé ne flotte (> 2 cm) ni ne s'enfonce visiblement.
2. `audit-reach.cjs` : chaque cible se vise debout depuis au moins 3 endroits libres ; aucune « cachée ».
3. `audit-walk.cjs` : chaque porte se franchit dans les deux sens (sauf les sorties qui terminent la partie).
4. `audit-stairs.cjs` : montée et descente complètes, plus captures image par image.
5. `audit-tour.cjs` : deux vues par pièce, lumières allumées et de nuit — à regarder.
6. Captures de chaque porte, couvercle et tiroir ouverts.
