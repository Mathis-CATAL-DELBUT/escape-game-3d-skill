# Architecture

Sommaire : 1. Vue d'ensemble · 2. Arborescence · 3. Serveur autoritaire · 4. Protocole temps réel ·
5. État de partie · 6. Client · 7. Accès de test (`window.__game`) · 8. Performances mobiles

## 1. Vue d'ensemble

```
navigateur (Three.js)  ──WebSocket──>  serveur Node (moteur de jeu autoritaire)  ──>  état JSON sur disque
   rendu, visée, UI         actions        règles, zones, chrono, indices, journal       reprise après redémarrage
   <── état (diffusé), poses des autres joueurs, événements (sons, récit)
```

- **Le serveur décide de tout** : portes, objets, inventaires, zones des personnages, chrono, indices, fin.
  Le client n'envoie que des intentions (`use`, `take`, `code`, `give`, `talk`, `hint`, `pause`, `restart`…)
  et la pose de son personnage (position, regard, accroupi, lampe). Tricher côté client ne change rien.
- **Sans dépendances côté serveur** si possible (Node + module WebSocket écrit à la main ou `ws`) : moins de
  surface, déploiement trivial dans un conteneur.
- **Client compilé** (esbuild) en un seul `game.js` ; Three.js importé depuis `node_modules` ; ressources 3D
  compressées (KTX2 + meshopt). Une version de développement non minifiée aide au débogage.
- Plusieurs jeux peuvent partager le même serveur (un dossier par jeu dans `server/games/<jeu>/` et
  `public/<jeu>/`), avec une page d'accueil commune.

## 2. Arborescence type

```
projet/
  server/server.js            HTTP statique (ETag + Cache-Control: no-cache) + routage WebSocket par jeu
  server/ws.js                WebSocket minimal
  server/games/<jeu>/engine.js   moteur : état, actions, tick, vue envoyée aux clients
  server/games/<jeu>/content/    règles, textes serveur, indices (ne jamais les envoyer en entier au client)
  client/<jeu>/*.js           sources du client (modules)
  public/<jeu>/index.html     page du jeu ; css/ ; js/game.js (compilé) ; data/layout.json ; assets/
  build/                      scripts : plan, architecture, ressources, éclairage, client, paquet
  test/                       simulation du moteur + contrôles navigateur (Playwright)
```

Modules client qui ont fait leurs preuves : `main.js` (application, transitions d'état, boucle),
`net.js` (connexion, reconnexion, accusés), `world.js` (scène, pièces, portes, objets, animations,
visibilité), `physics.js` (capsule du joueur, octree de collisions), `player.js` (caméra, lampe),
`interact.js` (visée, portée, toucher), `input.js` (clavier, souris, tactile, joystick, gyroscope),
`ui.js` (HUD, salle d'attente, menu, pause, fin), `overlays.js` (fenêtres d'énigmes, examen 3D),
`puzzles.js` (aiguillage cible → fenêtre ou action), `content.js` (textes, objets, animations),
`assets.js` (chargement, matériaux, cache), `audio.js`, `avatars.js` (autres joueurs).

## 3. Serveur autoritaire

- `act(player, message)` : point d'entrée unique ; renvoie `{ ok, msg?, data?, changed? }`.
  `data` sert à demander au client d'ouvrir une fenêtre (`{ code: 'cadenas' }`, `{ dialog: true }`…) :
  **chaque type de `data` doit être géré côté client** (bug réel : le serveur répondait « ouvrir le
  dialogue » quand on cliquait directement sur un personnage, le client ignorait la réponse → rien ne
  se passait).
- Vérifier la **zone** du personnage pour toute action (`need(ctx, ['cuisine'])`), avec une tolérance au
  seuil d'une zone reliée par une porte ouverte ou un passage (60 cm), jamais à travers des barreaux ou
  une porte fermée. Raison : le client laisse viser un objet depuis l'embrasure ; sans tolérance le
  serveur répond « Hors de portée » alors que le joueur touche l'objet.
- Garder les rectangles de zones alignés sur le plan des murs (ou documenter l'écart) : une zone qui
  déborde de 20 cm dans la pièce voisine crée exactement ce genre de refus.
- Valider tout identifiant reçu : refuser ceux qui sont des propriétés héritées
  (`if (typeof v === 'string' && v in Object.prototype) refuser`), utiliser `Object.hasOwn`.
- Limiter le débit des actions par connexion ; envelopper `handle()` et `tick()` dans `try/catch` : un bug
  ne doit jamais tuer le serveur.
- **Chrono** : temps de jeu = maintenant − début − pauses. Mettre en pause automatiquement si plus personne
  n'est connecté ou si l'horloge du serveur saute (machine en veille), et au redémarrage du serveur
  (« Le serveur a redémarré : appuyez sur Reprendre »).
- **Persistance** : écrire l'état sur disque (débounce), le valider au chargement (une sauvegarde abîmée ne
  doit jamais empêcher de démarrer), l'écrire immédiatement à l'arrêt.
- **Salle d'attente** : la partie démarre quand tous les joueurs connectés sont prêts ; un joueur parti
  libère sa place après ~30 s ; un appareil de plus que le maximum reçoit « partie complète » — il ne doit
  **jamais** déclencher le nettoyage des joueurs connectés (bug réel : `prune(0)` supprimait tout le
  monde car « hors ligne depuis ≥ 0 ms » était vrai pour les connectés).
- **Recommencer** : action `restart` ; sans confirmation seulement depuis l'écran de fin ; en cours de
  partie, exiger `confirm: 'RESTART'`. Conserver joueurs, prénoms et apparence, tout le reste repart de zéro ; noter qui a recommencé pour l'afficher en salle
  d'attente ; une seconde confirmation simultanée ne casse rien.
- **Réinitialisation administrateur** séparée (HTTP), qui ferme les connexions. La protéger par un **jeton
  secret** (variable d'environnement, en-tête `x-admin-token`) ou n'accepter que les requêtes locales
  (`127.0.0.1`/`::1`, sans en-tête `x-forwarded-for` posé par un proxy). Le mot `RESET` n'est qu'une
  confirmation contre les erreurs, pas une protection.
- **Connexions muettes** : le client envoie `ping` toutes les ~4 s ; le serveur note la date du dernier
  message de chaque connexion et ferme (`terminate()`) celles qui se taisent depuis ~20 s, dans `tick()`.
  Sans cela, un téléphone qui perd le réseau reste « en ligne » plusieurs minutes. Mettre aussi une taille
  maximale de message (`maxPayload` ~64 Ko) **et** un écouteur `error` sur chaque connexion : une trame trop
  grosse sans écouteur fait planter le processus.
- **Zones et téléportation** : si le serveur refuse les changements de zone impossibles (anti-triche : on
  ne passe d'une zone à l'autre que par une liaison ouverte), les contrôles qui téléportent le corps
  (`setFeet`) à travers les murs verront leurs poses refusées puis leurs actions « hors de portée ».
  Deux solutions : le serveur accepte toute pose quand il tourne en local avec `DEV_TELEPORT=1` (jamais
  en production), ou les scripts ne téléportent qu'en passant par des portes ouvertes.
- **Communication à distance** : action `say {text}` → entrée du journal visible par tous (longueur
  ≤ 200, débit limité, texte échappé à l'affichage, jamais interprété comme HTML).
- **Solo** : un joueur incarne deux personnages (bouton « Changer ») ; un joueur arrivant en cours de
  partie peut reprendre le second personnage (de préférence s'il n'est pas actif).
- **Personnages et joueurs** : les personnages ont un nom fixe (celui que citent les documents, indices et
  fins) ; le joueur garde son prénom, affiché à côté du nom du personnage dans le HUD et le journal. Ne
  pas demander « le prénom du second personnage » : les textes du jeu deviendraient incohérents.
- Personnage d'un joueur déconnecté depuis longtemps : orphelin, reprenable par un autre (avec ses objets).

## 4. Protocole temps réel

Messages client → serveur : `hello {token, name, look}`, `pose {b, p, yaw, pitch, c, l, a}`,
`act {id, kind, ...}` (dont `say {text}` pour la messagerie), `ping` (toutes les ~4 s). Serveur → client : `welcome {pid, token, s}`, `state {s}` (diffusé, différé de
~40 ms pour regrouper), `poses {b: {...}}` (10–15 Hz), `event {e}` (sons localisés, récit), `ack {id, ok,
msg, data}`, `full {msg}`, `pong`.

- Côté client, `act()` renvoie une promesse résolue par l'accusé, avec délai maximal (~9 s → « Le serveur
  ne répond pas »).
- **Reconnexion** : au retour de veille (`visibilitychange`, `online`, `pageshow`), vérifier la
  connexion ; une connexion muette depuis > 10 s est fermée et rouverte. En ouvrant une nouvelle connexion,
  **abandonner l'ancienne** et ignorer ses événements (`if (ws !== this.ws) return;` dans
  `onopen/onmessage/onclose`). Sinon : faux bandeau « Connexion perdue », actions réussies annoncées
  perdues, événements et sons en double.
- Code de fermeture dédié (ex. 4000) pour « partie réinitialisée » → le client recharge la page.

## 5. État de partie (exemple de schéma)

```js
{ version, phase: 'lobby'|'play'|'end', players: {pid: {name, look, ready, bodies, active, token}},
  order: [pid], bodies: {bid: {owner, side, p, yaw, zone, light, anim}},
  items: {id: {at: 'world'|'inv'|'placed'|'used', holder, place}},
  obj: { doors: {id: 'locked'|'closed'|'open'}, ...drapeaux d'énigmes },
  startedAt, pausedAt, pausedMs, endedAt, hints, penaltyMin, log: [...], result, restarted }
```

`view()` construit ce qui est envoyé : jamais les solutions, seulement l'état visible ; ajouter tout champ
que le client lit (contrôle : comparer les champs lus par le client à ceux de `view()`).

## 6. Client

- **Transitions d'état** : passage de `play`/`end` à `lobby` → `location.reload()` (décor, objets,
  animations neufs ; les fichiers 3D sont revalidés par ETag, pas retéléchargés). Les nouveaux venus en
  cours de chargement doivent recevoir l'état final.
- **Introduction** affichée une fois par partie (clé `intro_<startedAt>` en stockage local).
- **Pause** : écran commun « Partie en pause » avec Reprendre et Recommencer ; `exitPointerLock()` quand la
  pause arrive (lancée par un autre joueur aussi).
- **Panneaux** (journal, indices, menu) : les redessiner quand leur contenu change ; lire l'état au moment
  du clic (pas une valeur capturée à l'ouverture) ; fermer un panneau annule une capture de touche en cours.
- **Changer de personnage** : interdit pendant une fenêtre de gros plan, un panneau ou la pause.
- **Stockage local** : prénom, apparence, réglages (volume, sensibilité, inversion, gyroscope, qualité,
  touches) ; réactiver le gyroscope au premier toucher s'il était activé (iOS exige un geste).

## 7. Accès de test : `window.__game`

Avec `?dev` dans l'URL, exposer l'application pour les contrôles automatiques (les scripts de `scripts/`
s'appuient sur ce contrat ; l'adapter si les noms diffèrent) :

```js
window.__game = {
  state, layout, loaded,                 // état serveur reçu, plan, chargement terminé (tous étages)
  camera, renderer,
  world: { root, props, targets /* Map cible → [mesh] */, doors, anims, roomGroups,
           cameraRoom(pos), roomAt(pos, yaw), setDoorAngle(door) /* applique door.open */, updateDoorColliders(id),
           applyState(s, instant), setAnim(a), items },
  player: { body: { setFeet(x, y, z), feet() }, yaw, pitch, wake, crouch, light, hasLamp },
  interact: { pick(ndcX, ndcY), ray, shown(obj), targetOf(obj) },
  overlays: { inspecting, trophy?, close() }, puzzles: { use(target) },
  net: { act(kind, params), pid }, switchBody(), myBody()
};
```

Ce que les scripts lisent précisément (à respecter pour qu'ils marchent tels quels) :
- `world.doors[id]` = `{ def /* entrée du plan */, group, open, target, leaves }` ; `open` va de 0 (fermée)
  à 1 (ouverte) et `setDoorAngle(door)` l'applique : rotation sur la charnière **ou** translation dans le
  rail pour une porte coulissante (`def.kind: 'slide'`) — le nom est historique, le contrat est le même ; `world.anims[]` =
  `{ id, propId, node, when(s), target, k }` ; `world.setAnim(a)` applique `a.k` (0 → 1).
- `interact.pick(ndcX, ndcY)` renvoie `{ target, dist, point }` ou `null` ; `interact.ray` est un
  `THREE.Raycaster`.
- `overlays.inspecting` = `{ pivot }` pendant l'examen 3D, `null` sinon ; boutons `.insp-btn[title="Tourner à droite"]`.
- `player.yaw/pitch` modifiables (ils font foi pour la caméra) ; `player.wake` = 0 désactive l'animation de
  réveil d'intro ; `player.hasLamp` est une fonction ; `player.light.on`.
- `state.phase`, `state.pausedAt`, `state.obj`, `state.items` ; action `pause {on: false}` acceptée.
- Sélecteurs masqués pendant les captures : `#hud`, `#touch`, `#toasts`, `.toast`, `#prompt` ; fenêtres
  `.ov`/`.card`/`.dialog` ; invite active `#prompt.on`.
- En `?dev`, les touches de déplacement marchent sans pointeur verrouillé.
- Props du plan : `wall: true` sur un objet fixé au mur (tableau, boîtier, étagère murale), `wall: false`
  pour forcer « posé » ; lu par `audit-float` (sinon il devine). Les zones de toucher invisibles des petits
  objets doivent être `visible = false` ou `material.visible = false` (les contrôles les ignorent pour
  mesurer l'objet).

Ce que les scripts envoient au serveur (pour régler les règles de zone en conséquence) : la remise à zéro
(`RESET_URL`), les poses de la boucle normale après chaque `setFeet` (téléportations, voir §3 « Zones et
téléportation »), `pause {on: false}`, et les actions que déclenchent `puzzles.use(cible)` (audit-inspect)
ou un toucher réel (audit-tap). `audit-float`, `audit-reach`, `audit-walk`, `audit-stairs`, `audit-tour` et
`audit-shots` n'agissent pas sur la partie (hors poses et pause) ; `audit-walk` force les portes côté client
en neutralisant `applyState`.
- `world.override` (facultatif) : forcer l'éclairage d'une pièce pour les captures.

Ne jamais l'activer sans `?dev`.

## 8. Performances mobiles

- (Niveau N3) lightmaps cuites (un canal par groupe de lumières) plutôt que des dizaines de lumières dynamiques ; en
  N1/N2, hémisphère + quelques ponctuelles + matériaux émissifs suffisent ; un
  petit « pool » de lumières ponctuelles pour les effets ; une seule ombre dynamique : la lampe du joueur.
- N'afficher que la pièce de la caméra et celles visibles par une ouverture ou une porte ouverte (BFS sur
  les liaisons, profondeur 2). Voir les pièges de visibilité dans `pitfalls.md`.
- Ratio de pixels plafonné (1 à 1,5 sur mobile), antialiasing coupé sur mobile, qualité « auto / basse /
  haute » dans le menu. Mais **ne jamais couper les ombres de la lampe du joueur** (s'il en a une) pour
  gagner du temps : sans elles la lumière traverse les murs.
- Chargement en deux temps (première zone jouable, puis le reste en arrière-plan) ; viser < 50–80 Mo au
  total, et signaler le poids aux joueurs (Wi-Fi conseillé).
- Cache des matériaux par **promesse** (pas par résultat) : deux demandes simultanées du même matériau
  doivent attendre la même promesse, sinon des surfaces restent blanches au hasard.
