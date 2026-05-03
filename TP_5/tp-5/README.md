# TP-5 — Séparation d'environnements Kubernetes

TP de mise en place de trois environnements Kubernetes séparés avec namespaces, RBAC, quotas, Pod Security Standards et NetworkPolicies.

## Pré-requis

- `kubectl`
- `kustomize` ou `kubectl kustomize`
- Un cluster avec support des NetworkPolicies, par exemple `kind` avec CNI compatible ou `minikube` démarré avec Calico

Exemple avec minikube :

```bash
minikube start --driver=docker --cni=calico
```

## Arborescence

```text
tp-5/
├── k8s/
│   ├── base/
│   │   ├── deployment.yaml
│   │   ├── kustomization.yaml
│   │   └── service.yaml
│   └── overlays/
│       ├── dev/
│       │   ├── configmap.yaml
│       │   ├── kustomization.yaml
│       │   ├── limit-range.yaml
│       │   ├── namespace.yaml
│       │   ├── rbac.yaml
│       │   ├── resource-quota.yaml
│       │   └── serviceaccount.yaml
│       ├── staging/
│       │   ├── configmap.yaml
│       │   ├── kustomization.yaml
│       │   ├── limit-range.yaml
│       │   ├── namespace.yaml
│       │   ├── rbac.yaml
│       │   ├── resource-quota.yaml
│       │   └── serviceaccount.yaml
│       └── prod/
│           ├── configmap.yaml
│           ├── deployment-patch.yaml
│           ├── kustomization.yaml
│           ├── limit-range.yaml
│           ├── namespace.yaml
│           ├── network-policy.yaml
│           ├── rbac.yaml
│           ├── resource-quota.yaml
│           └── serviceaccount.yaml
└── README.md
```

## Déploiement

```bash
kubectl apply -k k8s/overlays/dev/
kubectl apply -k k8s/overlays/staging/
kubectl apply -k k8s/overlays/prod/
```

Vérification des namespaces et des labels :

```bash
kubectl get ns --show-labels
kubectl get ns -l app.kubernetes.io/part-of=demo-app --show-labels
```

Résultat attendu :

```text
app-dev       Active   ...   app.kubernetes.io/part-of=demo-app,environment=dev,owner=platform-team
app-staging   Active   ...   app.kubernetes.io/part-of=demo-app,environment=staging,owner=platform-team
app-prod      Active   ...   app.kubernetes.io/part-of=demo-app,environment=prod,owner=platform-team
```

## Contextes kubectl simulés

Les identités sont simulées avec des ServiceAccounts. Le nom du contexte reste celui demandé par le TP.

```bash
export DEV_TOKEN=$(kubectl create token dev-user -n app-dev)
export QA_TOKEN=$(kubectl create token qa-user -n app-staging)
export PROD_TOKEN=$(kubectl create token prod-deployer -n app-prod)

kubectl config set-credentials dev-user --token="$DEV_TOKEN"
kubectl config set-credentials qa-user --token="$QA_TOKEN"
kubectl config set-credentials prod-deployer --token="$PROD_TOKEN"

kubectl config set-context dev-user@app-cluster --cluster=minikube --user=dev-user
kubectl config set-context qa-user@app-cluster --cluster=minikube --user=qa-user
kubectl config set-context prod-deployer@app-cluster --cluster=minikube --user=prod-deployer
```

Adapte `minikube` si ton cluster porte un autre nom dans kubeconfig.

## Preuves de bon fonctionnement

### 1. Dev user peut déployer en dev

```bash
kubectl --context dev-user@app-cluster auth can-i create deployment -n app-dev
kubectl --context dev-user@app-cluster auth can-i get pods/log -n app-dev
kubectl --context dev-user@app-cluster auth can-i create pods/exec -n app-dev
```

### 2. Dev user peut déployer en staging

```bash
kubectl --context dev-user@app-cluster auth can-i create deployment -n app-staging
kubectl --context dev-user@app-cluster auth can-i get pods/log -n app-staging
```

### 3. QA user a un accès safe en staging

```bash
kubectl --context qa-user@app-cluster auth can-i get pods -n app-staging
kubectl --context qa-user@app-cluster auth can-i get pods/log -n app-staging
kubectl --context qa-user@app-cluster auth can-i patch deployment -n app-staging
```

### 4. Dev user est bloqué en prod

```bash
kubectl --context dev-user@app-cluster auth can-i get pods -n app-prod
kubectl --context dev-user@app-cluster auth can-i create deployment -n app-prod
```

### 5. Prod deployer peut déployer en prod

```bash
kubectl --context prod-deployer@app-cluster auth can-i patch deployment -n app-prod
kubectl --context prod-deployer@app-cluster auth can-i create services -n app-prod
kubectl --context prod-deployer@app-cluster auth can-i get pods/log -n app-prod
```

### 6. L'application affiche l'environnement dans les logs

Le conteneur écrit `ENV_NAME` et `LOG_LEVEL` au démarrage.

```bash
kubectl logs deployment/demo-app -n app-dev
kubectl logs deployment/demo-app -n app-staging
kubectl logs deployment/demo-app -n app-prod
```

### 7. Quotas et limit ranges

```bash
kubectl describe resourcequota -n app-dev
kubectl describe resourcequota -n app-staging
kubectl describe resourcequota -n app-prod

kubectl describe limitrange -n app-dev
kubectl describe limitrange -n app-staging
kubectl describe limitrange -n app-prod
```

### 8. PSS bloque un pod non conforme en prod

```bash
kubectl apply -n app-prod -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pod-non-conforme
spec:
  containers:
    - name: busybox
      image: busybox:1.36
      command: ["sh", "-c", "sleep 3600"]
EOF
```

Le namespace `app-prod` est en `restricted`, donc ce pod doit être refusé.

### 9. NetworkPolicy prod

Le trafic non autorisé vers `app-prod` doit être bloqué par défaut.

```bash
kubectl run curl-test --image=curlimages/curl:8.7.1 --restart=Never -n app-dev -- sleep 3600
kubectl exec -n app-dev curl-test -- curl -m 2 http://demo-app.app-prod.svc.cluster.local
```

La requête doit échouer tant qu'aucune autorisation explicite ne l'autorise.

### 10. Déploiement et rollback

```bash
kubectl rollout status deployment/demo-app -n app-dev
kubectl rollout status deployment/demo-app -n app-staging
kubectl rollout status deployment/demo-app -n app-prod

kubectl rollout undo deployment/demo-app -n app-prod
```

## Tableau RBAC

| Action | dev-user en dev | dev-user en staging | qa-user en staging | dev-user en prod | prod-deployer en prod |
| --- | --- | --- | --- | --- | --- |
| Lire les pods | Oui | Oui | Oui | Non | Oui |
| Lire les logs | Oui | Oui | Oui | Non | Oui |
| Déployer une app | Oui | Oui | Non | Non | Oui |
| Faire un rollout restart | Oui | Oui | Oui | Non | Oui |
| Exécuter un pod shell | Oui | Oui | Non | Non | Non |
| Modifier services et ingress | Oui | Oui | Non | Non | Oui |
| Lire quotas et limitranges | Oui | Oui | Oui | Non | Oui |

`prod-deployer` est un compte de CI/service account. `dev-user` n'a aucun droit en prod.

## Bonnes pratiques retenues

- Séparation nette des environnements avec namespaces `app-dev`, `app-staging`, `app-prod`.
- Labels standard sur les namespaces : `app.kubernetes.io/part-of`, `environment`, `owner`.
- RBAC au moindre privilège avec `dev-user`, `qa-user` et `prod-deployer`.
- ConfigMaps par environnement avec `ENV_NAME` et `LOG_LEVEL`.
- Quotas et LimitRanges pour éviter qu'un environnement ne sature le cluster.
- PSS `baseline` en dev/staging et `restricted` en prod.
- NetworkPolicy en prod avec deny-all et exceptions explicites.
- Déploiement prod en rolling update avec image non-root et contexte de sécurité durci.
- Images à versionner et scanner, idéalement depuis un registre privé signé.

## Nettoyage

```bash
kubectl delete -k k8s/overlays/prod/
kubectl delete -k k8s/overlays/staging/
kubectl delete -k k8s/overlays/dev/
```