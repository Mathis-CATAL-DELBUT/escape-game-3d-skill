# Squelette du client

Sommaire : 1. Boucle principale · 2. Entrées (clavier, souris, tactile) · 3. Collisions · 4. Visée et
toucher · 5. Portes (charnière ou coulissante) · 6. Accès de test · 7. Ce qu'il reste à écrire

Ce code de départ couvre la partie la plus longue à écrire et celle où se cachent les bugs signalés par
les joueurs (toucher perdu dans la zone du joystick, clic perdu, objet derrière un meuble, visée à travers
un mur). Il est volontairement court : à adapter au jeu, sans retirer les règles marquées « ne pas
retirer », qui viennent chacune d'un bug réel (voir `pitfalls.md`).

## 1. Boucle principale (`main.js`)

```js
import * as THREE from 'three';
import { Input } from './input.js';
import { Body } from './physics.js';
import { Interact } from './interact.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('view'), antialias: !isTouch() });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch() ? 1.5 : 2));
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.05, 80);
const player = { yaw: 0, pitch: 0, crouch: false, eye: () => (player.crouch ? 0.98 : 1.6) };
const body = new Body(layout);               // collisions depuis le plan (voir §3)
const input = new Input(renderer.domElement);
const interact = new Interact(camera, world); // world : cibles, murs (voir §4)
let last = performance.now(), aimT = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;   // dt borné : un onglet en veille ne téléporte pas
  if (canMove()) {                                              // pas pendant une fenêtre, un panneau, la pause
    const look = input.takeLook();                              // radians accumulés depuis la dernière image
    player.yaw -= look.x; player.pitch = THREE.MathUtils.clamp(player.pitch - look.y, -1.4, 1.4);
    const mv = input.move();                                    // {x, z} dans [-1, 1], z < 0 = avancer
    const sp = (player.crouch ? 1.2 : 2.2) * dt;
    const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
    body.move((mv.x * c + mv.z * s) * sp, (-mv.x * s + mv.z * c) * sp);
  }
  const f = body.feet();
  camera.position.set(f.x, f.y + player.eye(), f.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');      // yaw/pitch font foi (les contrôles les modifient)
  if ((aimT += dt) > 1 / 15) { aimT = 0; ui.prompt(interact.pick(0, 0)); }   // invite sous le viseur
  for (const tap of input.takeTaps()) onTap(tap);               // toucher court ou clic = agir
  world.updateVisibility(camera.position);                      // pièce de la caméra + voisines visibles
  net.sendPose(f, player);                                      // 10–15 Hz au plus (limité dans net.js)
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function onTap({ x, y, touch }) {                               // x, y en pixels écran
  const hit = touch ? interact.pickTouch(x, y) : interact.pick(0, 0);
  if (hit) puzzles.use(hit.target);                             // aiguillage cible → fenêtre ou action serveur
}
requestAnimationFrame(frame);
```

## 2. Entrées (`input.js`)

```js
const JOY_ZONE = 0.42;              // part gauche de l'écran réservée au joystick
export class Input {
  constructor(el) {
    this.el = el; this.keys = new Set(); this.look = { x: 0, y: 0 }; this.taps = [];
    this.joy = null; this.lookTouch = null; this.sens = 0.0024;
    // Clavier : event.code = touche physique → ZQSD (AZERTY) et WASD (QWERTY) marchent sans réglage.
    addEventListener('keydown', (e) => { if (!e.repeat) this.keys.add(e.code); this.onKey?.(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.joy = this.lookTouch = null; });   // ne pas retirer
    // Souris : pointeur verrouillé pour regarder.
    el.addEventListener('mousemove', (e) => { if (document.pointerLockElement === el) { this.look.x += e.movementX * this.sens; this.look.y += e.movementY * this.sens; } });
    el.addEventListener('click', (e) => {
      if (document.pointerLockElement === el) { this.taps.push({ x: e.clientX, y: e.clientY, touch: false }); return; }
      // Pointeur libre (après l'inventaire, un panneau, Échap) : AGIR sur ce qui est visé, PUIS recapturer.
      // Ne pas retirer : sinon « quand je clique sur Brancher, ça ne marche pas » (pitfalls F2).
      this.taps.push({ x: e.clientX, y: e.clientY, touch: false });
      el.requestPointerLock?.();
    });
    // Tactile : joystick à gauche, regard à droite ; un toucher court agit PARTOUT (y compris à gauche).
    el.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) this.start(t); e.preventDefault(); }, { passive: false });
    el.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) this.moveT(t); e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', (e) => { for (const t of e.changedTouches) this.end(t, false); });
    el.addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) this.end(t, true); });  // jamais un toucher
  }
  start(t) {
    const rec = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now(), maxd: 0 };
    if (t.clientX < innerWidth * JOY_ZONE && !this.joy) this.joy = rec;   // le joystick apparaît sous le doigt
    else if (!this.lookTouch) this.lookTouch = rec;
  }
  moveT(t) {
    for (const r of [this.joy, this.lookTouch]) if (r && r.id === t.identifier) {
      if (r === this.lookTouch) { this.look.x += (t.clientX - r.x) * this.sens * 1.6; this.look.y += (t.clientY - r.y) * this.sens * 1.6; }
      r.x = t.clientX; r.y = t.clientY; r.maxd = Math.max(r.maxd, Math.hypot(r.x - r.x0, r.y - r.y0));
    }
  }
  end(t, cancel) {
    for (const k of ['joy', 'lookTouch']) {
      const r = this[k]; if (!r || r.id !== t.identifier) continue;
      const short = performance.now() - r.t0 < 500;
      const still = r.maxd < (k === 'joy' ? 18 : 22);          // seuils éprouvés : les doigts bougent un peu
      if (!cancel && short && still) this.taps.push({ x: r.x, y: r.y, touch: true });
      this[k] = null;
    }
  }
  move() {
    const k = this.keys, v = { x: 0, z: 0 };
    if (k.has('KeyW') || k.has('ArrowUp')) v.z -= 1;   // KeyW = Z sur AZERTY (touche physique)
    if (k.has('KeyS') || k.has('ArrowDown')) v.z += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) v.x -= 1;  // KeyA = Q sur AZERTY
    if (k.has('KeyD') || k.has('ArrowRight')) v.x += 1;
    if (this.joy) {
      const dx = this.joy.x - this.joy.x0, dy = this.joy.y - this.joy.y0, R = 60;
      if (Math.hypot(dx, dy) > 8) { v.x += Math.max(-1, Math.min(1, dx / R)); v.z += Math.max(-1, Math.min(1, dy / R)); }
    }
    const n = Math.hypot(v.x, v.z); if (n > 1) { v.x /= n; v.z /= n; }
    return v;
  }
  takeLook() { const l = this.look; this.look = { x: 0, y: 0 }; return l; }
  takeTaps() { const t = this.taps; this.taps = []; return t; }
}
```

Chaque bouton du HUD a aussi sa touche (`onKey` : `KeyE` agir, `KeyX` changer, `KeyJ` journal, `KeyH`
indices, `Escape` menu…). Appeler `document.exitPointerLock()` à l'ouverture d'un panneau, à la pause et à
l'écran de fin. En `?dev`, `move()` doit marcher sans pointeur verrouillé (les contrôles n'en ont pas).

## 3. Collisions (`physics.js`)

**N1, un seul étage** : un cercle (rayon 0,3 m) qui glisse contre les boîtes alignées du plan (murs, objets
`col: 'box'`, battants de porte fermés). Simple, indépendant des maillages, suffisant sans escalier.

```js
export class Body {
  constructor(layout, r = 0.3) { this.r = r; this.p = { x: 0, y: 0, z: 0 }; this.boxes = []; this.rebuild(layout); }
  rebuild(layout, doorBoxes = []) {   // à rappeler quand une porte change d'état (updateDoorColliders)
    this.boxes = [...layout.walls.map((w) => w.box), ...layout.props.filter((p) => p.col === 'box' && p.box).map((p) => p.box), ...doorBoxes];
  }
  setFeet(x, y, z) { this.p = { x, y, z }; }       // utilisé par les contrôles : ne pas renommer
  feet() { return { ...this.p }; }
  move(dx, dz) {                                   // axe par axe → on glisse le long des murs
    for (const [ax, d] of [['x', dx], ['z', dz]]) {
      const n = Math.ceil(Math.abs(d) / 0.1) || 1; // pas ≤ 10 cm : jamais à travers un mur fin
      for (let i = 0; i < n; i++) { this.p[ax] += d / n; this.push(); }
    }
  }
  push() {                                         // sortir de chaque boîte [x0, z0, x1, z1] chevauchée
    for (const [x0, z0, x1, z1] of this.boxes) {
      const cx = Math.max(x0, Math.min(this.p.x, x1)), cz = Math.max(z0, Math.min(this.p.z, z1));
      const dx = this.p.x - cx, dz = this.p.z - cz, d = Math.hypot(dx, dz);
      if (d >= this.r) continue;
      if (d > 1e-6) { this.p.x = cx + dx / d * this.r; this.p.z = cz + dz / d * this.r; }
      else {                                       // centre dans la boîte : sortir par le côté le plus proche
        const opts = [[x0 - this.r - this.p.x, 0], [x1 + this.r - this.p.x, 0], [0, z0 - this.r - this.p.z], [0, z1 + this.r - this.p.z]];
        const [ox, oz] = opts.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))[0];
        this.p.x += ox; this.p.z += oz;
      }
    }
  }
}
```

Les ouvertures des murs sont des trous dans `wall.box` : découper chaque mur en boîtes autour de ses
`openings` (`kind: 'door'`) au chargement, sinon on ne passe pas les embrasures. Contrôle : `audit-walk`.

**Plusieurs étages ou escaliers** : capsule (`three/addons/math/Capsule.js`) contre un `Octree`
(`three/addons/math/Octree.js`) construit depuis les maillages d'architecture et de collision ; gravité,
marche montable ≤ 25 cm, pente ≤ 40°. Pas de volume de collision « de secours » au-dessus d'une trémie
(pitfalls D1). Contrôle : `audit-stairs`.

## 4. Visée et toucher (`interact.js`)

```js
import * as THREE from 'three';
export class Interact {
  constructor(camera, world) { this.cam = camera; this.world = world; this.ray = new THREE.Raycaster(); }
  // Cibles visibles seulement (tous les ancêtres visibles) ; les zones de toucher invisibles en font partie.
  meshes() { const out = []; for (const [, ms] of this.world.targets) for (const m of ms) if (this.world.shown(m)) out.push(m); return out; }
  pick(nx, ny) {                                    // coordonnées normalisées (-1..1) ; lit la CAMÉRA, pas le joueur
    this.ray.setFromCamera({ x: nx, y: ny }, this.cam);
    this.ray.far = 3.4;
    const hits = this.ray.intersectObjects(this.meshes(), false);
    if (!hits.length) return null;
    let h = hits[0];
    // Objet à prendre juste derrière le bord d'un meuble (fond de tiroir, coffre ouvert) : le préférer.
    const item = hits.find((x) => this.world.targetOf(x.object)?.startsWith('item:') && x.distance - h.distance < 0.15);
    if (item) h = item;
    const target = this.world.targetOf(h.object);
    const high = h.point.y - this.cam.position.y > 0.3;
    if (h.distance > (high ? 3.4 : 2.4)) return null; // portée : 2,4 m, 3,4 m pour ce qui est en hauteur
    // Jamais à travers un mur : rayon contre les maillages d'occlusion (murs, portes fermées, vitres).
    const wall = this.ray.intersectObjects(this.world.occluders, false)[0];
    if (wall && wall.distance < h.distance - 0.08) return null;
    return { target, dist: h.distance, point: h.point };
  }
  // Tactile : point exact, puis deux couronnes de 8 rayons à 14 et 28 px ; le plus proche gagne ; repli au viseur.
  pickTouch(px, py) {
    const W = innerWidth, H = innerHeight, cand = [[px, py]];
    for (const r of [14, 28]) for (let k = 0; k < 8; k++) cand.push([px + Math.cos(k * Math.PI / 4) * r, py + Math.sin(k * Math.PI / 4) * r]);
    let best = null;
    for (const [x, y] of cand) { const h = this.pick(x / W * 2 - 1, -(y / H) * 2 + 1); if (h && (!best || h.dist < best.dist)) best = h; }
    if (!best && Math.hypot(px - W / 2, py - H / 2) < Math.min(W, H) * 0.2) best = this.pick(0, 0);
    return best;
  }
}
```

L'invite (« Prendre : … ») se touche aussi : `prompt.onclick = () => { const h = interact.pick(0, 0); if (h)
puzzles.use(h.target); }`. Les petits objets reçoivent une zone de toucher invisible (`visible = false`
ou `material.visible = false`, ≥ 7 cm) enregistrée dans `world.targets` ; `Raycaster` la touche quand
même si on la teste explicitement (ne pas filtrer `material.visible` dans `meshes()`).

## 5. Portes : charnière ou coulissante (`world.js`)

```js
// door = { def, group, leaves: [{ node, pivot, closed }], open /* 0..1 */, target /* 0 ou 1 */ }
export function setDoorAngle(door) {
  const k = door.open;
  for (const leaf of door.leaves) {
    if (door.def.kind === 'slide') {
      // translation le long du mur, de toute la largeur de l'embrasure (a1 - a0)
      const w = (door.def.a1 - door.def.a0) / (door.def.double ? 2 : 1);
      leaf.node.position.copy(leaf.closed).addScaledVector(leaf.axis, k * w);   // leaf.axis : vecteur unitaire du rail
    } else {
      // rotation autour du PIVOT placé sur les gonds (jamais l'origine du modèle si elle est au centre)
      leaf.pivot.rotation.y = leaf.sign * k * THREE.MathUtils.degToRad(door.def.openDeg || 95);
    }
  }
}
// À chaque image : door.open += (door.target - door.open) * Math.min(1, dt * 4) ; puis setDoorAngle(door) ;
// en fin d'animation : updateDoorColliders(door.def.id) (boîte du battant ouverte, ou aucune).
```

## 6. Accès de test

```js
if (new URLSearchParams(location.search).has('dev')) {
  window.__game = { get state() { return app.state; }, layout, get loaded() { return app.loaded; }, camera, renderer,
    world, player: Object.assign(player, { body, hasLamp: () => false, wake: 0 }), interact, overlays, puzzles, net,
    switchBody: app.switchBody, myBody: app.myBody };
}
```

Contrat complet attendu par les scripts : `architecture.md` §7.

## 7. Ce qu'il reste à écrire

`net.js` (connexion, accusés, reconnexion qui abandonne l'ancienne WebSocket, `ping` toutes les 4 s),
`world.js` (scène depuis le plan, pièces, matériaux par face, visibilité BFS, animations), `ui.js`
(salle d'attente, HUD, journal + messagerie, menu, pause, fin), `overlays.js` (fenêtres d'énigmes, examen
3D avec boutons), `puzzles.js`, `audio.js`, `avatars.js`. Les règles de chacun sont dans
`interaction-input.md`, `world-building.md` et `architecture.md`.
