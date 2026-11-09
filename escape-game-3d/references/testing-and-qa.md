# Tests et contrôle qualité

Sommaire : 1. Pyramide de contrôles · 2. Simulation du moteur · 3. Contrôles navigateur (scripts) ·
4. Appareils et formats · 5. Relectures par agents · 6. Critères de sortie · 7. Compte rendu

## 1. Pyramide de contrôles

1. **Simulation du moteur** (Node, quelques secondes) : la partie entière à chaque nombre de joueurs prévu
   + cas limites.
2. **Contrôles du monde** (navigateur, minutes) : flottants, portée, portes, escalier, visite photo.
3. **Contrôles d'interaction** : toucher tactile, examen 3D, fenêtres, recommencer, menu.
4. **Parties complètes dans le navigateur** : solo iPhone (WebKit), duo Android, synchronisation à 3.
5. **Regard humain** sur les planches de captures, puis jeu réel par l'utilisateur.

Relancer 1 à chaque modification du serveur, 2 à chaque modification du plan, tout avant chaque mise en
ligne (ou au moins la partie complète + les contrôles liés au changement quand on corrige en direct).

## 2. Simulation du moteur (`test/engine.js`)

- Charger `engine.js` dans le même processus, remplacer `Date.now` par une horloge simulée, déclencher les
  diffusions différées à la main, connexions factices (`send` stocke les messages, `act()` renvoie l'accusé).
- **Faire avancer le temps seconde par seconde** en appelant `tick()` à chaque pas (boucle `for`), jamais
  d'un bloc de plusieurs minutes : un saut d'horloge déclenche la pause automatique (« machine en veille »)
  et les événements scénarisés ne se produisent pas. Pendant ces boucles, faire envoyer `ping` aux
  connexions factices, sinon la coupure des connexions muettes les ferme toutes.
- Scénarios : partie complète à chaque nombre de joueurs prévu, de 1 au maximum (chaque étape vérifiée :
  refus attendus et réussites) ;
  pause/reprise (chrono figé) ; recommencer sans confirmation (refusé) puis avec (tout remis à zéro,
  joueurs gardés, message « X a recommencé ») ; double confirmation simultanée ; arrivée en cours de partie ;
  départ (personnage orphelin repris) ; appareil de trop (maximum + 1 : « complet », personne éjecté) ;
  connexion muette fermée après le délai ; message trop gros sans plantage ; reconnexion par jeton ;
  persistance (sauvegarde, rechargement, reprise en pause) ; événements scénarisés aux bonnes minutes ;
  tolérance de seuil (embrasure, porte fermée, barreaux) ; identifiants hérités refusés.
- Viser 150 à plusieurs centaines de vérifications selon la taille du jeu ; sortie `N/N vérifications
  réussies` et code de retour.

## 3. Contrôles navigateur (`scripts/`)

Fichiers `.cjs` (marchent même dans un projet en modules ES). Tous s'appuient sur Playwright (WebKit, Chromium) et sur l'accès de test `window.__game` (`?dev`).
Variables : `BASE` (URL du serveur local), `GAME` (chemin du jeu, ex. `/mon-jeu/`). Voir `scripts/README.md`.

| Script | Ce qu'il prouve |
|---|---|
| `audit-float.cjs` | aucun objet posé ne flotte ni ne s'enfonce ; objets muraux collés au mur |
| `audit-reach.cjs` | chaque cible se vise (vrai code de visée, occlusion comprise) depuis un endroit libre, debout ; liste « cachées » et « accroupi seulement » |
| `audit-walk.cjs` | chaque porte ouverte se franchit dans les deux sens en marchant |
| `audit-stairs.cjs` | escalier monté et descendu ; option captures image par image |
| `audit-tour.cjs` | deux vues par pièce, lumières allumées et de nuit, planche contact |
| `audit-tap.cjs` | toucher dans la zone du joystick agit ; joystick fait avancer (testé en espace dégagé) |
| `audit-inspect.cjs` | examen 3D : glisser tourne sans fermer, boutons, toucher court ferme |
| `audit-shots.cjs` | captures « vue joueur » d'une liste d'objets (avant/après un correctif) |

À écrire pour chaque jeu (spécifique) : partie complète par l'interface (`play.js` : salle d'attente,
introduction, chaque action via `puzzles.use()` ou clics), multijoueur (`multi.js` : avatars vus, positions
synchronisées, journal partagé, pause commune), fenêtres d'énigmes (`overlays.js` : chaque fenêtre s'ouvre,
se lit, se ferme, sur téléphone), recommencer (`restart.js` : menu et pause, à 3 joueurs), mise en page
(`layout.js` : salle d'attente, HUD, menu, indices sur les 8 formats de `DEVICES`).

Pour `multi.js`, appeler `enterGame(page, { waitStart: false })` pour chaque joueur (chacun se déclare prêt
une seule fois), puis attendre le début de partie sur toutes les pages. Un joueur qui arrive en cours de
partie n'a pas de salle d'attente : `enterGame` le détecte et n'attend pas le bouton « prêt ».

**Objets révélés plus tard** (contenu d'un casier, d'un tiroir fermé) : `audit-reach` les signale « cachés »
au départ, ce qui est normal. Pour les contrôler une fois révélés : variable `PREP` (code JavaScript
exécuté dans la page après l'entrée en jeu, par ex. des `await __game.net.act(...)` qui résolvent les
énigmes nécessaires, ou un état forcé) et `NO_RESET=1` si la partie a été avancée par un autre moyen, puis
`node audit-reach.cjs ipad1024 id1,id2`.

Bonnes pratiques :
- Remettre la partie à zéro (API d'administration) au début de chaque script ; reprendre la pause si la
  machine est lente (l'horloge du serveur peut sauter et déclencher la pause automatique).
- Forcer un état côté client pour tester (porte ouverte, tiroir ouvert) en **neutralisant `applyState`**
  pendant la mesure, sinon le prochain état serveur annule le forçage.
- Après toute transformation forcée : `world.root.updateMatrixWorld(true)` avant de mesurer.
- Lancer les scripts avec **bash** (pas zsh) quand on boucle sur des commandes stockées dans des variables.
- Toujours **regarder** les planches de captures produites.

## 4. Appareils et formats

| Nom | Moteur | Taille | Tactile |
|---|---|---|---|
| iPhone paysage | WebKit | 844×390 @3 | oui |
| iPhone portrait | WebKit | 390×844 @3 | oui |
| iPad portrait | WebKit | 768×1024 @2 | oui |
| iPad paysage | WebKit | 1024×768 @2 | oui |
| Tablette Android | Chromium | 1180×820 @2 | oui |
| Android téléphone | Chromium | 915×412 @2,6 | oui |
| Ordinateur | Chromium | 1280×800 | non |
| Grand écran | Chromium | 1440×900 | non |

Le vrai Safari iOS dans le simulateur Xcode est un bon complément (WebGL, son, gestes). Les appareils
physiques restent la référence : le dire s'ils n'ont pas été testés.

## 5. Relectures par agents

Lancer en parallèle trois relectures indépendantes, chacune avec un brief précis et sans lui donner nos
conclusions : (1) orthographe et typographie de tous les textes visibles ; (2) cohérence récit/énigmes/
indices/fins ; (3) bugs (plantages, désynchronisations client/serveur, blocages, commandes coincées,
réseau). Exiger pour chaque constat : fichier:ligne, scénario concret, gravité, correction minimale — et
vérifier soi-même chaque constat avant de corriger (une simulation de 10 lignes suffit souvent).

## 6. Critères de sortie (avant mise en ligne)

- Simulation : 100 % ; parties complètes navigateur : solo + chaque nombre de joueurs prévu OK.
- `audit-float` : 0 flottant > 2 cm ; `audit-reach` : 0 inatteignable, 0 cachée ; `audit-walk` : toutes les
  portes intérieures franchissables ; `audit-stairs` : montée et descente.
- Toucher tablette, examen 3D, recommencer, fenêtres : OK sur WebKit et Chromium.
- Mise en page OK sur les 8 formats ; aucune erreur dans la console.
- Planches de captures regardées (visite, portes, tiroirs, couvercles, escalier).

## 7. Compte rendu à l'utilisateur

Dire ce qui a été vérifié et comment (navigateurs, formats, nombre de vérifications), ce qui ne l'a pas été
(appareils physiques, Firefox…), les limites connues (poids du premier chargement). Si l'utilisateur joue :
aucun détail d'énigme. Demander de recharger la page (et « Reprendre ») après une mise en ligne.
