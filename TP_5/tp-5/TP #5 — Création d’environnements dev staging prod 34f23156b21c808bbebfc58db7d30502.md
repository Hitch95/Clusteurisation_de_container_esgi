# TP #5 — Création d’environnements dev/staging/prod avec namespaces & RBAC

## Contexte

Votre équipe doit déployer une application “demo-app” avec 3 environnements : **dev**, **staging**, **prod**. L’objectif est de reproduire un contexte pro : séparation forte, droits minimaux, et garde-fous pour éviter qu’un test en dev impacte la prod.

## Objectifs

- Mettre en place une séparation **dev/staging/prod** via des **namespaces**.
- Appliquer le principe du **moindre privilège** avec **RBAC**.
- Mettre en place des garde-fous : **quotas**, **requests/limits**, **Pod Security Standards**, **NetworkPolicies**.

## Livrables attendus (à rendre)

- Un dossier `tp-5` dans le dépôt Git contenant :
    - `/k8s/base/`
    - `/k8s/overlays/dev/`
    - `/k8s/overlays/staging/`
    - `/k8s/overlays/prod/`
- Les manifests YAML de : namespaces, RBAC, quotas/limits, policies, déploiement de l’app.
- Un `README.md` avec :
    - commandes d’installation
    - commandes de test (preuves)
    - un tableau “qui a le droit de faire quoi” (RBAC) (format texte suffit)

## Critères de réussite

- Les 3 namespaces existent et sont **labellisés**.
- `dev-user` peut déployer en **dev** et **staging**.
- `dev-user` est **bloqué** en **prod**.
- En prod : des pods non conformes (sécurité/ressources) sont refusés.
- En prod : une NetworkPolicy empêche par défaut les flux non autorisés.

---

## Étape 1 — Créer les namespaces (dev/staging/prod)

Objectif : isoler logiquement les ressources et préparer RBAC/policies.

1) Créez les namespaces :

- `app-dev`
- `app-staging`
- `app-prod`

2) Ajoutez des labels standard (bonnes pratiques) :

- `app.kubernetes.io/part-of=demo-app`
- `environment=dev|staging|prod`
- `owner=platform-team`

Validation

- `kubectl get ns --show-labels` affiche les labels.

---

## Étape 2 — Définir les personas

Objectif : clarifier les rôles avant d’écrire RBAC.

Personas

- `platform-admin` : admin cluster (vous)
- `dev-user` : déploie et debug en dev/staging
- `qa-user` : debug “safe” en staging (lecture + logs + rollout restart)
- `prod-deployer` : déploiement en prod (typiquement CI)

<aside>

En entreprise, les users viennent souvent d’un SSO (OIDC). Dans ce TP, vous **simulez** les identités.

</aside>

---

## Étape 3 — Simuler des utilisateurs (contexts kubectl)

- Créer des contexts kubectl :
    - `dev-user@app-cluster`
    - `qa-user@app-cluster`
- `kubectl --context dev-user@app-cluster auth can-i get pods -n app-dev` répond (probablement `no` au départ).

---

## Étape 4 — RBAC pour dev/staging

Objectif : donner aux devs juste ce qu’il faut sur dev/staging.

### 4.1 Créer un Role `developer-role` (namespace-scoped)

Dans `app-dev` et `app-staging`, autorisez au minimum :

- Lecture : `get/list/watch` sur pods, deploy, svc, ing, cm
- Debug : `pods/log`, `pods/exec`
- Écriture : `create/update/patch/delete` sur deployments/services/ingress (à ajuster)

Point important

- **Secrets** : éviter d’accorder `get/list` sur secrets aux devs en prod (voire même en staging). Réfléchissez à la stratégie.

### 4.2 RoleBinding pour `dev-user`

- Lie `dev-user` à `developer-role` dans `app-dev` et `app-staging`.

Validation

- `kubectl --context dev-user@app-cluster auth can-i create deployment -n app-dev`
- `kubectl --context dev-user@app-cluster auth can-i get pods/log -n app-staging`

---

## Étape 5 — RBAC “prod verrouillée” + identité de déploiement

Objectif : empêcher les actions humaines non contrôlées en prod.

1) Aucun droit pour `dev-user` dans `app-prod`.

2) Créez un Role `prod-deployer-role` (dans `app-prod`) pour une CI/service account :

- `get/list/watch` sur pods + `pods/log`
- `get/update/patch` sur deployments (rolling update)
- gestion des services/ingress nécessaires

3) RoleBinding vers `prod-deployer`.

Validation

- `kubectl --context dev-user@app-cluster auth can-i get pods -n app-prod` => `no`
- `kubectl --context prod-deployer@app-cluster auth can-i patch deployment -n app-prod` => `yes`

---

## Étape 6 — Déployer l’app dans les 3 environnements

Objectif : avoir une application identique mais configurée différemment.

Au minimum

- 1 Deployment + 1 Service par environnement
- Config par environnement via ConfigMap :
    - `ENV_NAME=dev|staging|prod`
    - `LOG_LEVEL=debug|info|warn`
- Probes : readiness + liveness
- RollingUpdate

Bonne pratique attendue

- Utiliser **Kustomize** (ou Helm) :
    - `base/` pour les manifests communs
    - `overlays/dev|staging|prod` pour les différences

Validation

- Une requête HTTP (ou logs) indique clairement l’environnement.

---

## Étape 7 — Garde-fous ressources (ResourceQuota + LimitRange)

But : éviter qu’un environnement dev/staging “casse” le cluster.

1) `app-dev`

- ResourceQuota : CPU/RAM totaux + nombre de pods
- LimitRange : requests/limits par défaut

2) `app-staging`

- Quota plus élevé (proche prod)

3) `app-prod`

- Requests/limits obligatoires et cohérents

Validation

- Un déploiement qui dépasse le quota en dev est refusé.

---

## Étape 8 — Sécurité des pods (Pod Security Standards = PSS)

But : imposer un socle de sécurité, surtout en prod.

1) Appliquez PSS via labels namespace :

- `app-dev` : `baseline`
- `app-staging` : `baseline` (ou `restricted`)
- `app-prod` : `restricted`

2) Rendez vos pods compatibles `restricted` :

- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- capabilities : drop
- `readOnlyRootFilesystem: true` (si possible)

Validation

- Un manifest volontairement non conforme est refusé en prod.

---

## Étape 9 — NetworkPolicies (isolation réseau)

But : réduire la latéralisation et contrôler les flux.

1) En `app-prod` : politique “default deny” (ingress + egress)

2) Autoriser explicitement :

- ingress depuis l’ingress controller (ex : `ingress-nginx`)
- egress vers ce qui est nécessaire (DNS, DB, etc.)

Pré-requis technique

- Les NetworkPolicies fonctionnent uniquement si le CNI les supporte.

Validation

- Un pod en dev ne peut pas appeler un service en prod (sauf autorisation explicite).

---

## Étape 10 — Rédiger le mémo “bonnes pratiques” (1 page)

Dans le README, faites une checklist :

- séparation env (namespaces, labels)
- RBAC (qui fait quoi)
- secrets (stratégie + limites)
- quotas/limits
- PSS
- network policies
- stratégie de release + rollback
- politique images (registry privé, scan, signature)

---