# Scripts de contrôle

Contrôles « comme un joueur » dans de vrais navigateurs (Playwright : WebKit = Safari iOS, Chromium =
Android/ordinateur). Ils ont trouvé, sur un vrai jeu, des portes infranchissables, des objets cachés ou
flottants, un escalier bloquant, des touchers tactiles perdus, une rotation 3D impossible.

## Installation

Node ≥ 20. Fichiers `.cjs` : ils marchent même si le projet est en `"type": "module"`.

```bash
npm i -D playwright && npx playwright install webkit chromium
```

Si des navigateurs Playwright sont déjà téléchargés (`~/Library/Caches/ms-playwright` sur Mac,
`~/.cache/ms-playwright` sous Linux), installer la version de Playwright qui leur correspond
(`npm i -D playwright@<version>`), sinon `npx playwright install` retélécharge tout. Sans Chromium de
Playwright, le Google Chrome installé est utilisé automatiquement (`PW_CHANNEL=chrome` pour le forcer).

Copier ce dossier dans `test/` du projet (ou lancer depuis ici avec `PLAYWRIGHT=<chemin>/node_modules/playwright`).

## Contrat attendu du jeu

Le jeu doit exposer `window.__game` quand l'URL contient `?dev` (détail dans
`references/architecture.md` §7) : `state`, `layout`, `loaded`, `camera`, `world` (`root`, `props`,
`targets`, `doors`, `anims`, `cameraRoom`, `setDoorAngle`, `updateDoorColliders`, `applyState`, `setAnim`),
`player` (`body.setFeet`, `body.feet`, `yaw`, `pitch`, `wake`, `light`, `hasLamp`), `interact` (`pick`,
`ray`), `overlays` (`inspecting`, `close`), `puzzles.use`, `net.act`. Adapter `lib.cjs` si les noms diffèrent.

Détail complet de ce que lisent les scripts et de ce qu'ils envoient au serveur : `references/architecture.md`
§7. Les scripts téléportent le joueur (`setFeet`) : si le serveur refuse les changements de zone
impossibles, le lancer en local avec un mode qui les accepte (§3 « Zones et téléportation »). Le plan (`layout`, schéma
complet dans `references/bootstrap.md` §4) doit contenir `rooms`, `walls`, `doors` (`a0`, `a1`, `planeX`/`planeZ`, `floor`),
`floors`, `props` (`id`, `model`, `pos`, `yaw`, `col`), `stairs` (`x0`, `x1`, `z0`, `z1`, `y0`, `y1`, `dir`).

## Variables

| Variable | Rôle | Défaut |
|---|---|---|
| `BASE` | serveur local | `http://localhost:3000` |
| `GAME` | chemin du jeu | `/` |
| `RESET_URL` | POST de remise à zéro avant chaque contrôle | (aucun) |
| `RESET_BODY` | corps JSON de cette requête | `{"type":"reset","confirm":"RESET"}` |
| `RESET_HEADERS` | en-têtes JSON en plus (API protégée : `{"x-admin-token":"…"}`) | — |
| `NO_RESET` | `1` = ne pas remettre à zéro (partie avancée exprès) | — |
| `PREP` | code JavaScript (async) exécuté dans la page après l'entrée en jeu (`__game` disponible) | — |
| `IGNORE_MODEL_PREFIX` | préfixes de modèles à ignorer (décalques…), séparés par des virgules | `decal:` |
| `READY_SEL` | bouton « prêt » de la salle d'attente | `#ready` |
| `INTRO_SEL` | boutons de l'introduction | `#intro button` |
| `SHOTS` | dossier des captures et planches | `./shots` |
| `GAME_HOOK` | nom de l'accès de test s'il n'est pas `__game` (alias créé automatiquement) | — |
| `LOADED_PROP` | nom de l'indicateur « chargement terminé » s'il n'est pas `loaded` | — |
| `PW_CHANNEL` | `chrome` pour utiliser Google Chrome installé (repli automatique sinon) | — |
| `PLAYWRIGHT` | chemin du module playwright | `playwright` |

## Contrôles

| Commande | Vérifie | Seuil de réussite |
|---|---|---|
| `node audit-float.cjs [2]` | objets posés : flottent ? s'enfoncent ? muraux décollés ? (drapeau `wall` du plan respecté, zones de toucher invisibles ignorées) | 0 flottant > 2 cm |
| `node audit-reach.cjs [ipad1024] [id,id…]` | chaque cible se vise depuis le sol (debout/accroupi) ; objets révélés plus tard : `PREP` ou `NO_RESET=1` + liste d'ids | 0 inatteignable, 0 cachée injustifiée |
| `node audit-walk.cjs` | chaque porte ouverte se franchit dans les deux sens | toutes (sauf sorties finales) |
| `node audit-stairs.cjs --shots` | escaliers montés/descendus + images de la montée | montée et descente, aucun vide visible |
| `node audit-tour.cjs` | deux vues par pièce (planches) | à regarder |
| `node audit-tap.cjs <cible> [moteur] [appareil]` | toucher dans la zone du joystick ; joystick testé dans un espace dégagé (Chromium) | les deux OK |
| `node audit-inspect.cjs <cible> [chromium] [ipad1024]` | examen 3D : glisser, boutons, fermeture | « examen 3D : bon » (sous WebKit tactile : « bon (boutons et fermeture seulement) », relancer avec chromium pour le glisser) |
| `node audit-shots.cjs id… [--side] [--open]` | captures vue joueur (avant/après correctif) | à regarder |

Lancer les boucles de contrôles avec **bash** (zsh ne découpe pas `$cmd` en arguments). Toujours ouvrir
les planches `shots/sheet-*.png` : un contrôle vert ne prouve pas qu'on voit l'objet.

## À écrire pour chaque jeu (spécifique aux énigmes)

- `engine-sim.js` : partie complète en Node à chaque nombre de joueurs prévu (+ un appareil de trop) et cas limites (voir `testing-and-qa.md` §2).
- `play.js` : partie complète par l'interface (salle d'attente → fin) sur iPhone WebKit et Android.
- `multi.js` : jusqu'au nombre maximal de joueurs (WebKit téléphone, Chromium Android, Chromium ordinateur) :
  avatars, positions, journal partagé (et messagerie), pause commune, recommencer depuis le menu et la pause,
  appareil de trop refusé sans éjection. Entrer avec `enterGame(page, { waitStart: false })` pour chaque
  joueur, puis attendre le début de partie sur toutes les pages.
- `overlays.js` : chaque fenêtre d'énigme s'ouvre, se lit, se ferme sur téléphone.
- `layout.js` : salle d'attente, HUD, menu, indices sur les 8 formats de `lib.cjs`.
