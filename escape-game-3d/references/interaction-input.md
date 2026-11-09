# Interactions et commandes

Sommaire : 1. Visée et portée · 2. Tactile (téléphone, tablette) · 3. Ordinateur · 4. Inventaire ·
5. Fenêtres d'énigmes · 6. Examen 3D · 7. Interface (HUD, menu, pause, salle d'attente, fin) ·
8. Accessibilité · 9. Liste de contrôle

## 1. Visée et portée

- Un rayon depuis la caméra : centre de l'écran (ordinateur, viseur) ou point touché (tactile). Ne garder
  que les maillages des cibles visibles (tous les ancêtres `visible`), premier impact qui a une cible.
- Portée ≈ 2,4 m ; 3,4 m pour les objets en hauteur (trophées, tableaux, étagères hautes).
- **Jamais à travers un mur** : rayon dans l'octree d'occlusion ; refuser si un mur est plus proche que la
  cible (avec 8 cm de marge).
- **Objet derrière le bord d'un meuble** : si le premier impact est un meuble et qu'un objet à prendre est
  touché moins de 15 cm plus loin sur le même rayon, préférer l'objet (fond de tiroir, coffre ouvert).
- **Zones de toucher invisibles** pour les petits objets (voir `world-building.md` §8).
- Invite sous le viseur (« Prendre : Fusible 10 A », « Ouvrir le tiroir »…) calculée côté client depuis
  l'état ; elle doit refléter l'objet en main (« Brancher le téléphone » quand on tient le téléphone).
- Toute cible visée doit mener quelque part : fenêtre, action serveur, ou texte « rien de spécial ». Faire
  un contrôle croisé : cibles du plan ↔ cas client ↔ cas serveur (voir `testing-and-qa.md`).

## 2. Tactile (téléphone, tablette)

- Moitié gauche (≈ 42 % de la largeur) : joystick qui apparaît sous le doigt ; moitié droite : glisser
  pour regarder. Boutons ronds à droite selon le jeu (lampe, s'accroupir, sauter, changer de personnage…).
- **Toucher court sans glisser = interagir, partout à l'écran**, y compris dans la zone du joystick
  (déplacement < 18 px et < 500 ms). Sans ça, sur tablette, tout ce qui est dans la moitié gauche est
  intouchable : c'était la cause n° 1 de « j'ai du mal à atteindre certaines choses ».
- Seuil de « toucher » côté regard : déplacement cumulé < 22 px, < 500 ms (les doigts bougent un peu).
- **Tolérance autour du doigt** : point exact, puis deux couronnes de 8 rayons à 14 et 28 px ; garder
  l'impact le plus proche. À défaut, si le doigt est près du centre (20 % du petit côté), prendre la cible
  sous le viseur.
- Petite tolérance autour du viseur aussi (4 rayons à ~10 px) pour que l'invite apparaisse facilement.
- **L'invite se touche** : toucher « Prendre : … » agit sur la cible du viseur.
- Ignorer `touchcancel` comme toucher (rotation de l'écran, notification).
- Paysage conseillé : petite bulle « tournez le téléphone » en portrait, qu'on peut fermer définitivement.
- Gyroscope optionnel (autorisation iOS dans un geste) ; le réactiver au premier toucher après un
  rechargement si le joueur l'avait activé.
- Plein écran sur Android/iPad (pas iPhone) ; zones sûres (`env(safe-area-inset-*)`).

## 3. Ordinateur (clavier, souris, pavé tactile)

- Pointeur verrouillé pour regarder ; Échap le libère ; invite « Cliquez pour jouer ».
- **Clic avec le pointeur libre** (après avoir choisi un objet dans l'inventaire, ouvert un panneau, Échap) :
  agir tout de suite sur l'objet cliqué ou visé (même logique que le toucher) **puis** recapturer. Avant,
  ce clic ne servait qu'à recapturer : « quand je clique sur Brancher, ça ne marche pas ».
- Touches modifiables (ZQSD/WASD + flèches, E interagir, F lampe, C s'accroupir, Maj courir, I inventaire,
  J journal, H indices, X changer, Échap menu). Lire `event.code` (touche physique) pour que ZQSD/WASD marchent
  sur AZERTY et QWERTY sans réglage.
- **Pointeur verrouillé = aucun bouton cliquable** : chaque bouton du HUD a une touche, affichée dans son
  infobulle et dans l'aide. Libérer le pointeur (`exitPointerLock`) dès qu'un panneau ou une fenêtre
  s'ouvre, à la pause **et à l'écran de fin** (sinon « Nouvelle partie » est inaccessible à la souris). La capture d'une nouvelle touche s'annule si l'on ferme le
  panneau ; affecter une touche déjà utilisée libère l'autre action (prévenir).
- Molette : zoom dans l'examen 3D ; clic droit : inventaire.
- Perte de focus (`blur`) : relâcher toutes les touches et le joystick.

## 4. Inventaire

- Barre en bas, objets en icônes (rendu 3D miniature), sélection = « objet en main » (bandeau « X en main :
  visez ce sur quoi vous voulez l'utiliser »), menu d'objet (Examiner, Donner à…, Combiner…).
- Donner un objet : seulement à un personnage proche ou visible à travers des barreaux (règle serveur).
- Désélectionner automatiquement après un usage qui le consomme.

## 5. Fenêtres d'énigmes

- Une fenêtre à la fois ; pendant qu'elle est ouverte, le jeu ne bouge pas (commandes désactivées,
  pointeur libéré) ; bouton ×, et toucher le fond ferme (sauf examen 3D, voir §6).
- Types utiles et génériques : cadenas à molettes (boutons ▲▼ + glisser vertical), clavier à code (avec
  blocage temporaire après plusieurs erreurs), cadran de coffre (glisser circulaire, « retenez puis
  tournez »), tableau électrique (emplacements, fusibles), radio (canaux), répondeur (messages), document
  (texte manuscrit), dialogue (choix), vidéo (canvas animé + son), trompe/instrument (appui long = note).
- Tout ce qui se fait au glisser a aussi des boutons. Cibles de toucher ≥ 44 px.
- Le texte nécessaire est **écrit** dans la fenêtre (les joueurs sur petit écran ne lisent pas une
  texture de 2 cm).
- Image qui doit cacher une information (vidéo où une main masque le code) : dessiner quelque chose de
  reconnaissable (une vraie main, pas une « boule beige ») et **vérifier au pixel** que l'information est
  bien masquée — et que celle qui doit rester visible l'est.

## 6. Examen 3D (objets, trophées)

- Scène dédiée rendue par-dessus le jeu ; carte d'information en bas à gauche (nom, description, texte
  gravé) ; rotation au glisser (souris et doigt), zoom (molette, pincement).
- La surface de glisser est le fond de la fenêtre : **ne pas** fermer la fenêtre au `pointerdown` sur le
  fond (sinon elle se ferme au premier contact et la rotation ne démarre jamais). Fermer seulement sur un
  toucher court sans glisser.
- `touch-action: none` sur la fenêtre (pas de défilement qui couperait le geste) ; la carte, elle, peut
  défiler (`max-height`, `overflow-y: auto`).
- **Boutons** sous la carte : tourner ⟲ ⟳, pencher ▲ ▼, rapprocher +, éloigner − ; maintenir = continuer.
  Indispensable dès qu'une énigme demande d'observer un détail (compter des cors, lire un dos).
- Si une énigme dépend de l'examen 3D, le dire clairement (indice) et le tester au doigt et à la souris.

## 7. Interface

- **HUD** : nom de la pièce, chrono (temps restant ou heure du récit), joueurs et leur pièce, boutons
  Indices / Journal (avec la messagerie si les joueurs peuvent être à distance) / Menu, inventaire, invite, notifications (toasts) — courts, empilés, jamais plus de 4.
- **Menu** : Mettre en pause (pour tous), Recommencer la partie (pour tous, en deux appuis avec
  confirmation qui s'annule seule après 5 s), réglages (volume, sensibilité, inversion, gyroscope, plein
  écran, qualité), touches, aide. Lire l'état au moment du clic.
- **Pause** : écran commun avec Reprendre et Recommencer.
- **Salle d'attente** : prénom, apparence (couleurs exclusives), personnage choisi ou attribué (nom fixe du
  récit), conseil « appelez-vous » si les joueurs sont à distance,
  liste des joueurs (prêt / en attente / déconnecté), message « X a recommencé la partie » le cas échéant,
  bouton « C'est bon pour moi », rappel du public visé et du son.
- **Fin** : texte de fin selon les choix, score, temps, indices, bouton « Nouvelle partie » (deux appuis).
- Mise en page vérifiée sur tous les formats `DEVICES` de `scripts/lib.cjs` (même liste que `testing-and-qa.md` §4).

## 8. Accessibilité (ce qui a fait la différence)

- Deux canaux pour toute information nécessaire (son → aussi un indice visuel ou textuel ; couleur → aussi
  une forme ou un mot).
- Textes ≥ 15 px, contraste suffisant, typographie française (espaces insécables avant `: ; ! ?`).
- Boutons ≥ 44 px ; rien d'indispensable en survol seul ; tout au clavier sur ordinateur.
- Indices à trois niveaux, pénalité affichée, confirmation avant de consommer.
- Recommencer facile ; pause pour tous ; reprise après déconnexion avec ses objets.

## 9. Liste de contrôle des interactions

- `audit-tap.cjs` : toucher dans la zone du joystick à 20 px à côté d'un objet → l'action a lieu ; le
  joystick fait toujours avancer.
- `audit-inspect.cjs` : glisser fait tourner sans fermer ; boutons ; toucher court ferme.
- Parcours complet automatisé (actions par l'interface, pas seulement par l'API).
- Relecture : pause lancée par un autre joueur, capture de touche annulée, changer de personnage interdit
  pendant une fenêtre, panneaux à jour, reconnexion sans doublon.
