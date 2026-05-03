# Discovery - Dockerisation de Taskboard

## Objectif

Mettre en place une image Docker propre pour l'application Taskboard, avec une base de donnees PostgreSQL en conteneur, tout en appliquant les bonnes pratiques suivantes :

- reduire la taille finale de l'image
- diminuer la surface d'attaque
- executer le processus sans root
- ajouter un healthcheck integre
- eviter de copier les secrets dans l'image
- rendre le build reproductible et exploitable en CI

## 1. Choix de l'image de base

### Comparaison

| Image | Taille / surface d'attaque | Support | Compatibilite | Verdict |
|---|---|---|---|---|
| `node:20` | La plus lourde des options Node, avec shell, gestionnaire de paquets et beaucoup d'outils systeme. Surface d'attaque plus large. | Support officiel Node.js, tres documente. | Excellente compatibilite, utile pour debugger et installer des dependances natives. | Bon choix pour le developpement, pas optimal pour le runtime final. |
| `node:20-alpine` | Tres petite, surface reduite. | Support officiel, largement utilise. | Peut poser des soucis avec les modules natifs ou les differences `musl` / `glibc`. | Interessant si le projet est compatible Alpine, mais plus risque pour la compatibilite. |
| `node:20-slim` | Compromis taille / compatibilite. Plus petite que `node:20`, plus simple que `alpine` pour les dependances natives. | Support officiel Node.js. | Tres bonne compatibilite avec l'ecosysteme Debian / glibc. | Choix pertinent pour l'etape de build. |
| `gcr.io/distroless/nodejs20-debian12:nonroot` | La plus compacte en runtime, sans shell ni gestionnaire de paquets. Surface d'attaque minimale. | Support Distroless / Google, tres utilise en production. | Compatible avec les applis Node pures JavaScript; moins pratique pour le debogage. | Meilleur choix pour le runtime final. |

### Decision

Pour Taskboard, la combinaison retenue est :

- `node:20.19.0-bookworm-slim` pour l'etape de build
- `gcr.io/distroless/nodejs20-debian12:nonroot` pour l'etape runtime

Ce choix fonctionne bien ici parce que l'application n'utilise pas de modules natifs exotiques. Les dependances utilisees (`express`, `pg`, `jsonwebtoken`, `bcryptjs`) passent proprement dans un runtime distroless.

## 2. Strategie de build

### Build en une seule etape

Avantages :

- plus simple a ecrire
- plus simple a comprendre au debut

Inconvenients :

- image plus grosse
- `npm`, le cache et les outils de build restent dans l'image finale
- surface d'attaque plus large
- moins bonne separation entre les dependances de build et d'execution

### Build multi-stage

Avantages :

- image finale beaucoup plus petite
- les `devDependencies` ne partent pas en production
- la chaine de build est plus nette : `deps` puis `runtime`
- plus facile de garder un runtime durci

Inconvenients :

- Dockerfile plus long
- debogage un peu moins direct si on choisit un runtime minimal comme Distroless

### Mise en oeuvre retenue

Le `Dockerfile` utilise deux etapes :

1. `deps` : installation des dependances de production avec `npm ci --omit=dev`
2. `runtime` : copie du resultat dans une image Distroless non-root

On ajoute aussi :

- `COPY package*.json ./` avant l'installation pour profiter du cache Docker
- `.dockerignore` pour eviter de faire entrer `node_modules`, `.git`, `tests`, `README.md`, `.env` et les fichiers Compose dans le contexte

## 3. Securite de l'image

### Execution sans root

Le conteneur final s'execute avec `USER nonroot` via l'image Distroless.

Validation realisee :

```bash
docker inspect --format='{{.Config.User}}' taskboard-app-1
```

Resultat obtenu : `nonroot`.

### Systeme de fichiers en lecture seule

Le service applicatif dans `compose.yml` est declare en `read_only: true`.

Pour les ecritures temporaires, on a monte :

- `/tmp`
- `/var/tmp`

via `tmpfs`.

### Capabilites et durcissement

Le service applique aussi :

- `cap_drop: [ALL]`
- `security_opt: [no-new-privileges:true]`
- `init: true` pour eviter les problemes de recolte des processus zombies

### Healthcheck integre

Le `Dockerfile` declare un `HEALTHCHECK` qui execute `healthcheck.js`.

Le script appelle `GET /health` sur l'application locale, puis verifie que la reponse JSON contient `status: "ok"`.

Le endpoint `/health` de l'application execute aussi un `SELECT 1` sur PostgreSQL, donc le signal de sante couvre bien la chaine application + base.

Validation realisee :

```bash
docker inspect --format='{{.State.Health.Status}}' taskboard-app-1
```

Resultat obtenu : `healthy`.

### Epinglage des versions

Les images et versions ont ete fixees autant que possible :

- Node.js : `20.19.0`
- PostgreSQL : `18.3`
- l'image runtime utilise Distroless Node 20 sur Debian 12

Pour une production tres stricte, l'etape suivante serait de figer aussi les digests d'image.

## 4. Gestion des dependances

### `npm install` vs `npm ci`

`npm ci` a ete retenu dans l'image de build.

Pourquoi :

- installation reproductible basee sur `package-lock.json`
- suppression automatique de `node_modules` avant reinstallation
- comportement plus previsible en CI et en build Docker

`npm install` reste utile en developpement, mais il peut resoudre le graphe de dependances de maniere moins deterministe.

### `devDependencies`

Dans l'image finale, les `devDependencies` ne sont pas incluses.

Elles restent utilisees :

- en local pour le developpement
- en CI pour les tests et le lint

La publication Docker ne contient que les dependances d'execution.

### Cache Docker

Le build copie d'abord `package*.json`, puis execute `npm ci`.

Consequences : si le code applicatif change sans modifier les dependances, Docker reutilise le cache sur l'installation npm.

## 5. Mise en place realisee

### Fichiers crees ou mis a jour

- `Dockerfile`
- `compose.yml`
- `healthcheck.js`
- `.dockerignore`
- `.env.example`

### Comportement de `compose.yml`

Le fichier Compose demarre deux services :

- `db` : PostgreSQL 18.3
- `app` : Taskboard

Points importants :

- la base est stockee dans un volume nomme `db_data`
- le montage est fait sur `/var/lib/postgresql` pour respecter le comportement attendu par PostgreSQL 18+
- l'application attend que le service `db` soit `healthy` avant de demarrer
- `DATABASE_URL` pointe vers le service `db`, pas vers `localhost`
- les secrets sont passes au runtime via les variables d'environnement

### Variables d'environnement attendues

Le fichier `.env.example` documente les variables suivantes :

- `PORT`
- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_SECRET`
- `DEFAULT_ADMIN_USERNAME`
- `DEFAULT_ADMIN_PASSWORD`

## 6. Validation executee

### Demarrage

Commande utilisee :

```bash
docker compose up -d --build
```

Resultat :

- le service PostgreSQL est passe `healthy`
- le conteneur applicatif a demarre correctement

### Taille de l'image

Commande utilisee :

```bash
docker image inspect taskboard-app:latest --format='{{.Size}}'
```

Resultat : `45727648` octets, soit environ `43.6 MiB`.

Objectif valide : l'image est tres en dessous de la limite de `300 Mo`.

### Sante du conteneur

Commande utilisee :

```bash
docker inspect --format='{{.State.Health.Status}}' taskboard-app-1
```

Resultat : `healthy`.

### Execution sans root

Commande utilisee :

```bash
docker inspect --format='{{.Config.User}}' taskboard-app-1
```

Resultat : `nonroot`.

## 7. Scan de securite local

### Outil choisi

L'outil retenu est **Trivy**.

Raison :

- simple a lancer localement
- bien adapte au scan d'images Docker
- fournit un resultat lisible pour les vulnerabilites OS et dependances Node

### Commande utilisee

```bash
docker save taskboard-app:latest -o taskboard-app.tar
docker run --rm -v "$PWD:/scan" aquasec/trivy:0.60.0 image --input /scan/taskboard-app.tar --scanners vuln --severity HIGH,CRITICAL --no-progress
```

### Resultat observe sur l'image finale

- vulnerabilites OS : `2 HIGH`, `0 CRITICAL`
- vulnerabilites Node : `0`

Les deux alertes restantes viennent de `libc6` :

- `CVE-2026-0861` : HIGH
- `CVE-2026-4046` : HIGH

Interpretation : le runtime Distroless a fortement reduit la surface d'attaque par rapport a l'image Node complete, mais on reste dependant des correctifs du socle Debian 12.

### Comparaison avec la premiere image runtime testee

Avant le passage en Distroless, le scan remontait beaucoup plus de problemes :

- `20 HIGH`
- `1 CRITICAL`

Le passage en runtime Distroless a donc apporte un gain de securite net.

## 8. Conclusion

La configuration actuelle repond aux criteres demandes :

- `docker compose up` demarre une stack fonctionnelle
- l'image finale fait largement moins de `300 Mo`
- le processus ne tourne pas en root
- le healthcheck est operationnel
- les secrets ne sont pas embarques dans l'image

Le compromis retenu est volontairement oriente production : build sur Debian slim, runtime Distroless, execution non-root, filesystem read-only, et scan local avec Trivy.





- Qu'est-ce que la pyramide des tests ? Quels types de tests existent ?
- Test unitaire, test d'intégration, test end-to-end
  
- Quelle différence entre un test unitaire, un test d'intégration et un test end-to-end ?
- Un test unitaire vérifie le comportement d'une fonction ou d'un module isolé, sans dépendances externes. 
  Un test d'intégration vérifie l'interaction entre plusieurs composants ou modules, souvent avec des dépendances réelles (ex: base de données). 
  Un test end-to-end simule le comportement d'un utilisateur final en testant l'application dans son ensemble, du frontend au backend.

- Qu'est-ce que la couverture de code ? Est-ce un indicateur suffisant de la qualité des tests ?
- La couverture de code mesure le pourcentage de lignes de code exécutées par les tests. 
  Ce n'est pas un indicateur suffisant de la qualité des tests, car il ne garantit pas que les tests vérifient correctement les comportements attendus ou les cas limites. 
  Une couverture élevée peut être trompeuse si les tests sont mal conçus.

- Comment tester une API REST ? Quels outils existent pour ça ?
- On peut tester une API REST en écrivant des tests d'intégration qui envoient des requêtes HTTP à l'API et vérifient les réponses. 
  Des outils comme Postman, Insomnia, ou des bibliothèques de test comme Supertest (pour Node.js) peuvent être utilisés pour faciliter ce processus.

- Quelle est la différence entre CI (Intégration Continue) et CD (Déploiement Continu) ?
- CI (Intégration Continue) est une pratique de développement où les développeurs intègrent fréquemment leur code dans un dépôt partagé, avec 
  des builds et des tests automatisés pour détecter rapidement les problèmes.
  CD (Déploiement Continu) est une extension de CI où les changements validés sont automatiquement déployés en production ou dans un environnement de staging, assurant que le code est toujours dans un état déployable.

- Qu'est-ce qu'un runner GitHub Actions ? Où s'exécute-t-il ?
- Un runner GitHub Actions est une machine virtuelle ou un conteneur qui exécute les workflows définis dans un dépôt GitHub. 
  Les runners peuvent être hébergés par GitHub (GitHub-hosted runners) ou auto-hébergés par les utilisateurs (self-hosted runners). 
  Les GitHub-hosted runners s'exécutent dans l'infrastructure de GitHub, tandis que les self-hosted runners peuvent être exécutés sur des serveurs locaux, des machines virtuelles ou des conteneurs gérés par les utilisateurs.

- Qu'est-ce qu'un artefact de pipeline ? Dans quels cas est-il utile ?
- Un artefact de pipeline est un fichier ou un ensemble de fichiers générés lors de l'exécution d'un workflow GitHub Actions. Il peut s'agir d'une image Docker, d'un binaire compilé, ou d'autres ressources produites par le pipeline. Les artefacts sont utiles pour stocker et partager les résultats de construction ou de test entre différentes étapes du pipeline ou pour les déployer dans un environnement de production.

- Comment les jobs peuvent-ils dépendre les uns des autres ?
- Dans GitHub Actions, les jobs peuvent dépendre les uns des autres en utilisant la clé `needs`. Un job qui a une dépendance sur un autre job ne s'exécutera que si le job dont il dépend a réussi.

- Comment GitHub Actions peut-il se connecter à une machine locale derrière un NAT ?
- En pratique, GitHub Actions ne se connecte pas directement à la machine locale : on ouvre un tunnel SSH inverse ou TCP depuis la machine locale vers un service public, puis le runner se connecte à ce point d'entrée public. Cela permet de traverser le NAT sans exposer directement le port SSH sur Internet.

- Qu'est-ce qu'un tunnel SSH ? Comment fonctionne le port forwarding inversé (`R`) ?
- Un tunnel SSH est une connexion chiffrée qui transporte du trafic réseau à travers SSH. Avec `-R`, on fait du port forwarding inversé : la machine distante ouvre un port et redirige ce port vers un service qui écoute sur la machine locale. C'est utile quand la machine locale est derrière un NAT ou un pare-feu.

- Qu'est-ce qu'un déploiement **idempotent** ? Pourquoi est-ce important ?
- Un déploiement idempotent est un déploiement qu'on peut relancer plusieurs fois sans provoquer d'effets indésirables ni casser l'état attendu. C'est important parce qu'un job CI/CD peut échouer puis être rejoué, ou être lancé plusieurs fois, et il doit toujours aboutir au même résultat stable.

- Qu'est-ce qu'un healthcheck post-déploiement ? Que doit-il vérifier ?
- Un healthcheck post-déploiement est une vérification exécutée après le lancement de l'application pour confirmer qu'elle fonctionne vraiment. Il doit au minimum vérifier que le service répond, que l'endpoint de santé est accessible, et idéalement que les dépendances critiques comme la base de données sont aussi joignables.

## 9. Étape 5 — Déploiement local via SSH

### Choix du tunnel

Pour le tunnel public, j'ai retenu **Pinggy TCP**.

Pourquoi ce choix :

- il expose directement un endpoint TCP utilisable par SSH
- le format `host:port` est facile à injecter dans les secrets GitHub Actions
- il évite l'ambiguïté des solutions orientées HTTP/TLS comme localhost.run

### Architecture retenue

L'architecture mise en place suit cette logique :

1. le runner GitHub Actions se connecte en SSH vers un tunnel public
2. le tunnel Pinggy pointe vers un conteneur `ssh-server` local
3. le conteneur SSH a accès au socket Docker de l'hôte
4. le script distant arrête puis relance la stack de production locale
5. le script vérifie ensuite le healthcheck applicatif sur `/health`

### Fichiers ajoutés

- `compose.deploy.yml` pour lancer le conteneur SSH local
- `deploy/ssh-server/Dockerfile` pour construire l'image du serveur SSH
- `deploy/ssh-server/entrypoint.sh` pour injecter la clé publique et démarrer `sshd`
- `deploy/ssh-server/sshd_config` pour durcir la configuration SSH
- `deploy/ssh-server/deploy-taskboard.sh` pour exécuter le déploiement idempotent
- `scripts/open-pinggy-ssh.sh` pour ouvrir le tunnel TCP et récupérer `DEPLOY_TUNNEL_HOST` / `DEPLOY_TUNNEL_PORT`

### Séquence d'utilisation

1. Renseigner `DEPLOY_PUBLIC_KEY` dans le fichier `.env` local.
2. Démarrer le conteneur serveur SSH avec `docker compose -f compose.deploy.yml up -d --build`.
3. Lancer `bash scripts/open-pinggy-ssh.sh` pour ouvrir le tunnel et lire l'hôte et le port publics.
4. Reporter ces valeurs dans les secrets GitHub `DEPLOY_TUNNEL_HOST` et `DEPLOY_TUNNEL_PORT`.
5. Ajouter la clé privée correspondante dans `DEPLOY_SSH_PRIVATE_KEY`.
6. Pousser sur `main` pour déclencher le job de déploiement.

### Vérifications attendues

- la connexion SSH doit se faire par clé
- le script de déploiement doit être relançable sans effet de bord
- le conteneur applicatif doit finir en état `healthy`
- `GET /health` doit retourner `{"status":"ok", ...}`

### Secrets utilisés

- `DEPLOY_PUBLIC_KEY` en local pour autoriser le serveur SSH
- `DEPLOY_TUNNEL_HOST` et `DEPLOY_TUNNEL_PORT` dans GitHub Actions
- `DEPLOY_SSH_PRIVATE_KEY` dans GitHub Actions
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD` pour la stack de production locale
