# Mini Compte Rendu TP 3 - Docker Hub et Kubernetes

Le Dockerfile utilise un build multi-stage : une étape `deps` installe les dépendances, puis une étape `runner` ne garde que l’essentiel.
`npm ci` rend l’installation reproductible et améliore le cache Docker lors des rebuilds.
L’image finale reste plus légère car elle ne copie que `server.js`, `public/` et `node_modules`.
`ENV NODE_ENV=production` place l’application en mode production.

`imagePullSecrets` sert à authentifier Kubernetes auprès de Docker Hub pour télécharger une image privée.
Ici, le secret `regcred` a été créé dans le namespace `tp-node-k8s` puis référencé dans le Deployment.
Grâce à cela, le cluster peut récupérer `blmundo/tp-docker-hub-app:tagname` sans exposer les identifiants dans le manifeste.
