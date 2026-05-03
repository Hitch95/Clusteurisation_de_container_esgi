# API minimale

API Node.js / TypeScript exposant deux routes JSON stables.

## Routes

- `GET /` : renvoie le hostname du conteneur.
- `GET /health` : renvoie un statut OK exploitable pour les probes.

## Lancement local

```bash
npm install
npm run build
npm start
```

## Configuration

- `PORT` : port d'écoute, par défaut `3000`.

## Contrat JSON

- `GET /` → `{ "hostname": "..." }`
- `GET /health` → `{ "status": "ok" }`


## C1 — Choix du registre et stratégie de tags

L’image est publiée dans GitHub Container Registry (`ghcr.io`).

Stratégie de tags retenue:

- `SHA` du commit comme tag principal et immuable pour les déploiements.
- `semver` pour les releases taguées `vX.Y.Z` si nécessaire.
- `latest` seulement comme alias de confort sur la branche principale, jamais comme référence de déploiement.

Pourquoi le tag immuable est préférable:

- Il garantit que le même tag pointe toujours vers la même image.
- Il rend les déploiements reproductibles.
- Il simplifie les rollback.
- Il évite les surprises liées à un tag réécrit.

## D1 — Accès distant au cluster Swarm

Approche retenue: Docker context via SSH.

Architecture simple:

GitHub Actions runner -> SSH -> manager Swarm -> Docker Engine -> pull de l’image depuis GHCR

Mécanisme d’authentification:

- clé SSH dédiée, stockée dans les GitHub Secrets,
- compte Linux dédié sur le manager,
- `GITHUB_TOKEN` utilisé par le workflow pour publier l’image dans GHCR,
- `docker stack deploy --with-registry-auth` pour transmettre l’auth GHCR au Swarm.

Secrets GitHub requis:

- `SWARM_HOST` : adresse du manager Swarm,
- `SWARM_USER` : utilisateur SSH dédié,
- `SWARM_SSH_KEY` : clé privée SSH au format OpenSSH.

Ports:

- `22/tcp` pour SSH entre GitHub Actions et le manager Swarm,
- `443/tcp` en sortie vers `ghcr.io` pour pousser et tirer les images,
- aucun port Docker TCP `2375/2376` exposé.

Risques et mitigations:

- secret SSH volé: utilisateur dédié, clé dédiée, révocation immédiate en supprimant la clé,
- accès trop large: pas de mot de passe, pas de `root`, pare-feu limité,
- fuite de secrets: aucun secret dans le dépôt, uniquement dans GitHub Secrets,
- dépendance au registre privé: accès révoqué rapidement en supprimant le secret ou les droits du package.

## CI/CD

Le workflow GitHub Actions:

- build l’image,
- la pousse dans GHCR avec un tag SHA,
- déploie ensuite la stack sur le manager Swarm via le contexte Docker SSH.

## Fichiers à ignorer

Le dépôt doit ignorer `node_modules`, `dist`, les logs, `.env`, `.env.*` et les dossiers d’éditeur comme `.vscode` pour éviter d’embarquer des artefacts de développement ou des secrets.

## Vérification de l’image finale

Pour vérifier qu’aucun artefact de développement n’est présent dans l’image finale, lance un conteneur depuis l’image runtime puis contrôle qu’il ne contient ni `node_modules` ni fichiers TypeScript dans `dist`. C’est la bonne preuve que l’image finale ne contient pas les dépendances de build.