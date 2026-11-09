# escape-game-3d — un skill pour faire générer des escape games 3D jouables

Un **skill pour Claude** (Claude Code, claude.ai, Agent SDK) qui guide un modèle de bout en bout pour
**concevoir, construire, tester et mettre en ligne un escape game 3D multijoueur jouable dans le
navigateur** : sur téléphone, tablette et ordinateur, de 1 à 4 joueurs, sur n'importe quel thème
(enquête, science-fiction, aventure, fantastique, horreur, musée, famille…).

L'objectif n'est pas seulement d'obtenir du code qui tourne. Il faut aussi que **chaque objet soit visible,
atteignable et fonctionnel** quand de vrais joueurs prennent la manette.

> 🇬🇧 *A Claude skill that walks a model through designing, building, testing and shipping a playable
> multiplayer 3D escape room in the browser (Three.js + authoritative Node server), on phones, tablets and
> desktops. It ships a catalogue of real bugs found in playtests and 8 Playwright audit scripts that check
> every object can be seen, reached and used. Docs are in French.*

---

## Pourquoi ce skill

Un escape game 3D peut passer tous ses tests et rester injouable. Voici des exemples réels :
- un objet clé caché derrière un meuble ;
- une porte qui pivote au milieu de l'embrasure ;
- la moitié gauche de l'écran intouchable sur tablette ;
- un escalier qui bloque à la troisième marche ;
- des objets qui lévitent de 20 cm ;
- une lampe torche qui éclaire à travers les murs.

Ce skill rassemble ce qu'il faut pour éviter ces pièges dès la conception, puis pour les détecter
automatiquement avant que les joueurs ne tombent dessus.

Il est né de la construction d'un vrai jeu 3D d'1 h 30, joué à plusieurs sur iPad, Android et ordinateur, et
de toutes les corrections faites en direct pendant les parties. Il a ensuite été validé en faisant générer
**un second jeu complet par un autre agent, à partir du seul skill** : une station spatiale tout public. Ce
jeu a été mis en ligne, et le retour de l'agent a servi à combler les manques.

## Ce que contient le skill

```
escape-game-3d/
├── SKILL.md                      déroulé, invariants, méthode de travail, livrables
├── references/
│   ├── bootstrap.md              démarrer de zéro : 3 niveaux de finition, pile technique, schéma du plan, ressources 3D par thème
│   ├── architecture.md           serveur autoritaire, protocole, état, contrat de test window.__game
│   ├── client-skeleton.md        squelette commenté du client : boucle, joystick, visée, collisions, portes
│   ├── world-building.md         murs, portes, objets, éclairage, visibilité par pièce, escaliers
│   ├── interaction-input.md      visée, tactile, souris, inventaire, fenêtres d'énigmes, examen 3D, accessibilité
│   ├── puzzle-design.md          énigmes, coopération, indices, fins, tons (famille, horreur, enquête…)
│   ├── pitfalls.md               catalogue de bugs réels : symptôme, cause, détection, correction
│   ├── testing-and-qa.md         simulation du moteur, parties complètes en navigateur, relectures
│   └── deployment.md             mise en ligne (HTTPS, WebSocket, sauvegarde avant déploiement)
└── scripts/                      8 contrôles Playwright prêts à l'emploi + lib.cjs
```

### Les contrôles automatiques (`scripts/`)

Ils jouent « comme un joueur » dans de vrais navigateurs : WebKit pour Safari iOS, Chromium pour Android et
ordinateur.

| Script | Ce qu'il vérifie |
|---|---|
| `audit-float.cjs` | aucun objet posé ne flotte, ne s'enfonce, ni ne se décolle de son mur |
| `audit-reach.cjs` | chaque cible se vise depuis le sol, debout ou accroupi, sans traverser de mur |
| `audit-walk.cjs` | chaque porte ouverte se franchit dans les deux sens |
| `audit-stairs.cjs` | les escaliers se montent et se descendent, sans vide visible pendant la montée |
| `audit-tour.cjs` | planche photo de chaque pièce sous deux angles (à regarder) |
| `audit-tap.cjs` | un toucher dans la zone du joystick agit ; le joystick fait toujours avancer |
| `audit-inspect.cjs` | l'examen 3D tourne au glisser et aux boutons, et se ferme sur un toucher court |
| `audit-shots.cjs` | captures « vue joueur » d'objets précis (avant/après une correction) |

Ils s'appuient sur un petit contrat de test que le jeu expose avec `?dev` (`window.__game`), décrit dans
`references/architecture.md`. Pour un jeu existant qui nomme les choses autrement, utilisez les variables
`GAME_HOOK` et `LOADED_PROP`. Le détail est dans [`scripts/README.md`](escape-game-3d/scripts/README.md).

## Installation

### Claude Code

```bash
git clone https://github.com/Mathis-CATAL-DELBUT/escape-game-3d-skill.git
cp -R escape-game-3d-skill/escape-game-3d ~/.claude/skills/
```

Le skill est alors disponible dans toutes vos sessions. Pour un seul projet, copiez le dossier dans
`.claude/skills/` à la racine du projet.

### claude.ai (application web ou de bureau)

1. Téléchargez `escape-game-3d.skill` depuis la page
   [Releases](https://github.com/Mathis-CATAL-DELBUT/escape-game-3d-skill/releases). Vous pouvez aussi
   zipper le dossier `escape-game-3d/`.
2. Dans *Réglages → Capacités → Skills*, importez le fichier.

### Agent SDK / API

Copiez `escape-game-3d/` dans le dossier de skills de votre agent. Le dossier ne contient que des fichiers
Markdown et des scripts Node, sans aucune dépendance à installer pour le skill lui-même.

## Utilisation

Il suffit de demander un jeu. Le skill se déclenche aussi sans le mot « escape game » (jeu d'énigmes en vue
à la première personne, aventure 3D à explorer pièce par pièce…). Exemples :

- « Crée un escape game 3D jouable dans le navigateur : une station spatiale en panne, 1 à 2 joueurs, tout
  public, environ 20 minutes, sur téléphone et ordinateur. »
- « Fais-moi un jeu d'enquête en 3D dans un musée, à 4 joueurs en ligne, d'environ une heure. »
- « Dans mon jeu, des objets lévitent et on n'arrive pas à attraper certains objets sur iPad : corrige. »

Le skill fait suivre au modèle un déroulé éprouvé :
1. le cadrage ;
2. la conception papier des énigmes ;
3. le moteur et sa simulation complète ;
4. le plan unique du lieu ;
5. le client 3D ;
6. les contrôles automatiques ;
7. des parties complètes en navigateur ;
8. trois relectures indépendantes (orthographe, cohérence, bugs) ;
9. la mise en ligne avec sauvegarde.

### Lancer les contrôles sur votre jeu

```bash
npm i -D playwright && npx playwright install webkit chromium
cp -R escape-game-3d/scripts ./test && cd test
export BASE=http://localhost:3000 GAME=/mon-jeu/ RESET_URL=http://localhost:3000/mon-jeu/api/action
node audit-float.cjs 2
node audit-reach.cjs ipad1024
node audit-walk.cjs
```

Lancez les boucles de contrôles avec **bash** : zsh ne découpe pas une variable en arguments. Regardez
toujours les planches `shots/sheet-*.png`, car un contrôle vert ne prouve pas qu'on voit bien l'objet.

## Pile technique visée

- **Client** : Three.js (≥ r160), compilé par esbuild ou Vite.
- **Serveur** : Node ≥ 20, autoritaire, WebSocket (`ws` ou une implémentation minimale sans dépendance).
- **Tests** : Playwright, avec WebKit et Chromium.
- **Ressources** : modèles CC0 (Kenney, Quaternius, Poly Haven…) ou géométrie procédurale. Blender est
  facultatif et ne sert qu'aux lightmaps du niveau « haut de gamme ».

Trois niveaux de finition sont proposés : **N1 jouable**, **N2 soigné** et **N3 haut de gamme**. Toutes les
règles d'accessibilité, de visibilité et de contrôle s'appliquent dès N1.

## Limites connues

- La documentation est en français.
- Non couverts : les escape rooms physiques, les jeux 2D, Unity, Godot et Unreal.
- Les scripts ont été validés sur macOS, avec WebKit, Chromium et Google Chrome. Firefox (Playwright)
  n'est pas testé.

## Licence

[MIT](LICENSE) © 2026 Mathis CATAL-DELBUT
