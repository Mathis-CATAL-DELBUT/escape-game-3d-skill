# Paquet et mise en ligne

## Principes

- Cible type : une instance Node unique avec volume persistant, derrière HTTPS/WSS (voir `bootstrap.md` §7).
  Les étapes ci-dessous décrivent un serveur à soi (SSH + Docker) ; sur Railway/Fly/Render, remplacer par
  leur déploiement, en gardant la sauvegarde des données avant chaque mise en ligne.

- **Sauvegarde d'abord**, à chaque mise en ligne : archive des sources servies, des données (états de
  partie) et des scripts de pilotage, horodatée, sur le serveur. L'ancienne version reste dans un dossier
  `web.old-<date>` jusqu'à validation (les supprimer seulement avec l'accord de l'utilisateur).
- Ne jamais afficher de secrets ; respecter les consignes de l'utilisateur (fichiers à ne pas lire,
  protections à ne pas rajouter).
- **Livraison locale** (l'utilisateur ne veut pas d'hébergement, ou le déploiement est interdit) : mêmes
  étapes de paquet et de contrôle ; le livrable est le dossier + `npm install && npm run build && npm start`
  + l'adresse à ouvrir sur les autres appareils du réseau (voir `bootstrap.md` §7). Pas de sauvegarde
  serveur à faire, mais ne jamais écraser une partie en cours sur la machine sans accord.
- Mettre en ligne est une action visible publiquement : la faire quand l'utilisateur l'a demandée (ou a
  donné un accord durable, ex. « mets en ligne à chaque correctif »).

## Paquet de production (`build/package.sh`)

1. Compiler le client en mode production (minifié) ; vérifier le manifeste des ressources (aucun modèle
   manquant), la présence de l'architecture de chaque pièce (et de ses lightmaps si elles sont cuites).
2. `node --check` sur le serveur et le moteur ; présence des fichiers indispensables.
3. Archive : `package.json`, `Dockerfile`, `.dockerignore`, `server/`, `public/` (sans `.map`, sans
   `client/` source, sans données de test, sans dossiers d'outils).
4. Contrôler le contenu de l'archive (liste interdite) et sa taille.

## Déploiement (script exécuté sur le serveur, ex. `ssh ... 'bash -s' < deploy.sh`)

1. Sauvegarde horodatée (sources + données + scripts).
2. Extraire la nouvelle version dans `web.new`, vérifier les fichiers clés, basculer
   (`web` → `web.old-<date>`, `web.new` → `web`).
3. Reconstruire et relancer le conteneur ; attendre l'état « healthy ».
4. Vérifier toutes les URL (200), le WebSocket (101), et le résumé de chaque jeu (phase, nombre de joueurs).
5. Vérifier depuis l'extérieur (CDN, Cloudflare) : la page, `game.js` contient bien la nouvelle version
   (chercher une chaîne propre au correctif ; attention, la minification retire les espaces).

## Mises à jour pendant qu'on joue

- Le redémarrage du serveur met la partie en pause et la conserve (état sur disque, reprise en pause).
- Dire aux joueurs : « Rechargez la page sur chaque appareil, puis appuyez sur Reprendre. »
- Corriger par petits lots, mettre en ligne vite quand l'utilisateur attend pour avancer ; garder les
  correctifs risqués pour plus tard, ou les tester d'abord sur une partie complète.
- Les fichiers statiques sont servis avec `ETag` + `Cache-Control: no-cache` : un rechargement récupère la
  nouvelle version sans retélécharger les 80 Mo de ressources inchangées.

## Après la mise en ligne

- Résumer : ce qui a changé, ce qui a été vérifié, comment recharger ; ce qui reste (appareils physiques,
  dossiers `web.old-*` à supprimer après validation).
