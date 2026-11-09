# Démarrer de zéro

Sommaire : 1. Trois niveaux de finition · 2. Pile technique et versions · 3. Squelette du projet ·
4. Schéma du plan (`layout.json`) · 5. Code de départ (serveur, moteur, client) · 6. Ressources 3D par
thème · 7. Hébergement · 8. Ordre de travail conseillé

## 1. Trois niveaux de finition (choisir avant de commencer)

| Niveau | Contenu | Quand |
|---|---|---|
| **N1 — jouable** | un étage (ou plusieurs sans escalier : ascenseur/échelle = téléportation), murs générés par code, kit de modèles CC0, lumières dynamiques simples (hémisphère + quelques ponctuelles + panneaux émissifs), pas de lightmap | prototype, petit jeu, délai court |
| **N2 — soigné** | N1 + ressources compressées (KTX2, meshopt), visibilité par pièce, sons, examen 3D, indices, mise en page vérifiée | la plupart des jeux |
| **N3 — haut de gamme** | N2 + lightmaps cuites dans Blender (un canal par groupe de lumières), escaliers, plusieurs étages, réalité augmentée | grand jeu d'1 h 30 |

**Les lightmaps sont une optimisation d'apparence, pas un prérequis.** Tout le reste du skill (portes,
visibilité, toucher, contrôles) s'applique dès N1. Ne jamais sauter les contrôles de `scripts/`.

## 2. Pile technique et versions

- Node ≥ 20 (fetch natif, `node --check`).
- `three` récent (≥ r160) ; modules annexes : `three/addons/math/Octree.js`, `three/addons/math/Capsule.js`,
  `three/addons/loaders/GLTFLoader.js`, `KTX2Loader.js` (copier `basis_transcoder.js/.wasm` dans
  `public/<jeu>/vendor/basis/`), `three/addons/libs/meshopt_decoder.module.js`.
- Serveur WebSocket : `ws@8` (plus sûr qu'un protocole écrit à la main).
- Compilation client : esbuild (ou Vite) → un seul `game.js`.
- Tests : Playwright (`npx playwright install webkit chromium`). Si des navigateurs Playwright sont déjà
  téléchargés sur la machine, installer **la version de Playwright qui leur correspond**
  (`ls ~/Library/Caches/ms-playwright` ou `~/.cache/ms-playwright`) : sinon tout est retéléchargé. Sans
  navigateur Playwright, `PW_CHANNEL=chrome` utilise le Google Chrome installé.
- Outils de ressources : `@gltf-transform/cli` (`gltf-transform optimize in.glb out.glb --texture-compress ktx2
  --compress meshopt`) ou `gltfpack` ; `basisu` pour les textures seules.
- Blender seulement pour N3 (cuisson) — facultatif.

## 3. Squelette du projet

```
mon-jeu/
  package.json            { "type": "commonjs", "scripts": { "build": "node build/build-client.js", "start": "node server/server.js" } }
  server/server.js        HTTP statique (ETag, Cache-Control: no-cache) + ws sur /<jeu>/ws + /<jeu>/api/action (reset admin)
  server/engine.js        moteur autoritaire (voir §5)
  client/main.js …        modules (voir architecture.md §2)
  public/<jeu>/index.html, css/style.css, js/game.js, data/layout.json, assets/
  build/make-layout.js    écrit data/layout.json (§4)
  build/build-client.js   esbuild client/main.js → public/<jeu>/js/game.js (--dev : non minifié)
  test/engine-sim.js      simulation du moteur ; test/*.cjs : scripts du skill copiés
```

Si le projet est en `"type": "module"`, garder les scripts de contrôle en `.cjs` (ils le sont déjà).

## 4. Schéma du plan (`layout.json`) — ce que lisent le moteur, le client et les scripts

```js
{
  version: 1,
  floors: { main: { y: 0, h: 3 } },                         // obligatoire, même avec un seul étage
  materials: { murBlanc: { tex: 'white_plaster', size: 2.4 } },
  rooms: [ { id, floor, rect: [x0, z0, x1, z1], label, floorMat, wallMat, ceilMat, lights?: {...} } ],
  walls: [ { id, floor, box: [x0, z0, x1, z1], y0, y1,        // boîte au sol (x0<x1, z0<z1), hauteurs absolues
             openings: [ { id, a0, a1, y0, y1, kind: 'door'|'window'|'hole' } ] } ],   // a = abscisse le long de l'axe long du mur
  slabs: [ { id, y0, y1, rect, holes: [[x0, z0, x1, z1]] } ],  // planchers entre étages, trémies
  stairs: [ { id, x0, x1, z0, z1, y0, y1, dir: 'x+'|'x-'|'z+'|'z-', steps } ],
  doors: [ { id, model, wall, floor, a0, a1,                   // même a0/a1 que l'ouverture du mur
             planeX | planeZ,                                  // plan du mur : centre de son épaisseur (calculé depuis wall.box)
             face: 'x+'|'x-'|'z+'|'z-', zones: [zoneA, zoneB], state: 'locked'|'closed'|'open', openDeg: 95, double?,
             kind?: 'hinge'|'slide' /* coulissante : glisse de la largeur de l'embrasure */ } ],
  windows: [ { id, model, wall, floor, a0, a1, y0, y1, outward } ],
  props: [ { id, model, pos: [x, y, z], yaw, col: 'box'|'cyl'|'none'|'bars', t?: cible, attach?: 'porte:ancre',
             light?, dyn?, hiddenUntil?, scale?, face?,
             wall?: true|false /* fixé au mur (true) ou posé (false) : lu par audit-float */ } ],
  lights: [ { id, type: 'point'|'spot'|'area', pos, power, color, group: 'piece.r' } ],
  zones: [ { id, floor, rect, label } ],                       // règles du serveur
  links: [ [zoneA, zoneB, 'open'|'bars'|'glass'|idPorte] ],   // glass : on se voit, on ne passe ni ne vise
  spawns: { A: [[x, y, z, yaw], ...], B: [...] }
}
```

Calculs à faire dans `make-layout.js` (pas à la main) : `planeX/planeZ` = milieu de l'épaisseur du mur ;
`a0/a1` identiques entre l'ouverture et la porte ; `y` d'un objet posé = hauteur du dessus de son support
(puis `audit-float.cjs` le confirme).

## 5. Code de départ

**Serveur** (`server/server.js`, extrait) :
```js
const http = require('http'), fs = require('fs'), path = require('path'), { WebSocketServer } = require('ws');
const engine = require('./engine');
const srv = http.createServer((req, res) => { /* fichiers de public/ avec ETag + Cache-Control: no-cache ;
  POST /<jeu>/api/action → engine.httpAct(json) (reset admin : jeton ADMIN_TOKEN ou requête locale seulement) */ });
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });   // + ws.on('error') dans onSocket
srv.on('upgrade', (req, sock, head) => { if (req.url.startsWith('/mon-jeu/ws')) wss.handleUpgrade(req, sock, head, (ws) => engine.onSocket(ws)); else sock.destroy(); });
setInterval(() => engine.tick(), 1000);
srv.listen(process.env.PORT || 3000);
```

**Moteur** (`server/engine.js`, structure) :
```js
let st = load();                                  // état validé, ou freshState()
function onSocket(ws) { ws.on('message', (t) => { try { handle(ws, JSON.parse(t)); } catch (e) { console.error(e); } }); ws.on('close', ...); }
function handle(ws, m) { /* hello → welcome ; pose → bodies ; act → ack {id, ok, msg, data} puis changed() */ }
function act(p, m) { /* lobby, restart (confirm), pause ; puis use/take/code/give/talk/hint selon la zone (need) */ }
function view() { /* ce que voient les clients : jamais les solutions */ }
function tick() { /* chrono, événements scénarisés, connexions muettes > 20 s fermées, nettoyage salle d'attente
                    (jamais un connecté), pause auto */ }
module.exports = { onSocket, tick, httpAct, summary, _test: { state: () => st } };
```

**Client** : boucle `requestAnimationFrame` → entrées → physique (capsule + Octree des murs/dalles/objets, ou
cercle contre les boîtes du plan en N1 à un seul étage) → caméra → visée (toutes les 1/15 s) → rendu. Code
de départ complet et commenté : `client-skeleton.md`. Exposer `window.__game` avec `?dev` (architecture.md §7). En
mode `?dev`, les touches de déplacement doivent marcher **sans** verrouillage du pointeur (les contrôles
tournent sans écran ni clic).

## 6. Ressources 3D par thème (vérifier la licence de chaque fichier : CC0 de préférence, CC-BY = créditer)

| Thème | Sources |
|---|---|
| Maison, manoir, réaliste | Poly Haven (modèles + textures + HDRI, API publique), ambientCG (textures) |
| Science-fiction, station | Kenney Space Kit / Modular Space Kit, Quaternius Sci-Fi Modular & Ultimate Space Kit, ambientCG (métal, panneaux) |
| Fantastique, médiéval | Quaternius Medieval/Fantasy, Kenney Castle/Dungeon, Poly Haven (bois, pierre) |
| Enfants, cartoon | Kenney (meubles, jouets), Quaternius (stylisé) |
| Personnages / avatars | Quaternius (animés), Kenney Mini Characters |
| Sons | Kenney Audio, freesound (CC0 filtré), synthèse WebAudio (bips de clavier, notes) |
| Textes sur objets | générés en canvas (étiquettes, notes, écrans, plaques) |

Repli universel : géométrie procédurale (boîtes, cylindres, extrusions) + matériaux simples — mieux
vaut un objet simple et lisible qu'un modèle détaillé mal orienté. Corriger orientation, échelle et
origine par modèle (`MODEL_FIX`) en vérifiant par capture.

## 7. Hébergement

- HTTPS + WSS obligatoires (gyroscope iOS, plein écran, presse-papiers) ; proxy qui transmet l'upgrade
  WebSocket (nginx/Caddy/Cloudflare).
- **Une seule instance** (l'état est en mémoire + fichier) avec un volume persistant : VPS + Docker,
  Railway, Fly.io, Render (disque persistant).
- **Livraison locale** (pas d'hébergement) : `npm start` sur une machine, les autres appareils ouvrent
  `http://<IP-de-la-machine>:<port>/<jeu>/` sur le même réseau. Pas de HTTPS : gyroscope iOS et plein écran
  iPhone indisponibles, le dire. Documenter la commande et l'adresse dans le compte rendu.
- Une partie par jeu et par serveur (simple, idéal entre amis) **ou** des salons avec un code à partager
  (`/mon-jeu/?salle=ABCD` → un état par code) si plusieurs groupes jouent en même temps. Le décider au
  cadrage.

## 8. Ordre de travail conseillé

1. Conception papier (puzzle-design.md) → 2. moteur + simulation complète → 3. plan N1 + client minimal
(murs, portes, objets, visée) → 4. contrôles `audit-*` dès qu'on peut marcher → 5. interface complète
(salle d'attente, HUD, menu, fenêtres, fin) → 6. parties complètes navigateur → 7. N2/N3 si souhaité →
8. relectures → 9. mise en ligne avec sauvegarde.
