# Taskboard

Application web de gestion de tâches construite avec Node.js, Express et PostgreSQL.

## Prérequis

- **Node.js** v18 ou supérieur
- **PostgreSQL** v14 ou supérieur
- **npm** v9 ou supérieur

## Installation

### 1. Cloner le dépôt

```bash
git clone <url-du-depot>
cd taskboard
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Copiez le fichier d'exemple puis renseignez vos valeurs locales :

```bash
cp .env.example .env
```

Variables disponibles :

| Variable | Description |
|----------|-------------|
| `PORT` | Port du serveur |
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `POSTGRES_USER` | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL |
| `POSTGRES_DB` | Nom de la base PostgreSQL |
| `JWT_SECRET` | Clé secrète pour les tokens JWT |
| `DEFAULT_ADMIN_USERNAME` | Nom d'utilisateur du compte admin initial |
| `DEFAULT_ADMIN_PASSWORD` | Mot de passe du compte admin initial |

### 4. Préparer la base de données

Exemple avec `psql` :

```sql
CREATE USER taskboard WITH PASSWORD '<mot_de_passe_secure>';
CREATE DATABASE taskboard OWNER taskboard;
```

### 5. Lancer l'application

```bash
npm start
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

Au premier démarrage, si `DEFAULT_ADMIN_PASSWORD` est défini, un utilisateur admin initial peut être créé automatiquement.

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm start` | Démarre le serveur |
| `npm run dev` | Démarre le serveur en mode watch |
| `npm test` | Lance les tests |
| `npm run test:coverage` | Lance les tests avec rapport de couverture |
| `npm run lint` | Vérifie le code avec ESLint |

## Gestion des secrets

- Le fichier `.env` est ignoré par Git.
- Le fichier `.env.example` documente les variables attendues sans contenir de valeurs sensibles.
- Dans GitHub, configurez les secrets du dépôt dans **Settings > Secrets and variables > Actions** :
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `DEFAULT_ADMIN_USERNAME`
  - `DEFAULT_ADMIN_PASSWORD`
  - `PORT` si nécessaire

## CI/CD GitHub

Le workflow GitHub Actions situé dans [`.github/workflows/ci.yml`](.github/workflows/ci.yml) exécute les vérifications automatiques à chaque push et pull request.

## API

### Authentification

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/auth/login` | Authentification, retourne un token JWT |

**Corps de la requête :**

```json
{
  "username": "admin",
  "password": "<mot_de_passe_configure>"
}
```

**Réponse :**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "username": "admin" }
}
```

### Tâches

Toutes les routes `/tasks` nécessitent un header `Authorization: Bearer <token>`.

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/tasks` | Lister les tâches (filtre optionnel `?status=todo`) |
| `POST` | `/tasks` | Créer une tâche |
| `PUT` | `/tasks/:id` | Modifier une tâche |
| `DELETE` | `/tasks/:id` | Supprimer une tâche |

**Exemple de création :**

```json
{
  "title": "Ma tâche",
  "description": "Description optionnelle",
  "status": "todo"
}
```

Statuts possibles : `todo`, `in-progress`, `done`

### Monitoring

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/health` | Vérification de l'état de l'application |
| `GET` | `/metrics` | Métriques Prometheus (à implémenter) |

## Structure du projet

```
taskboard/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── db.js
│   ├── routes/
│   ├── models/
│   └── middleware/
├── public/
├── tests/
├── db/
├── package.json
├── .env.example
└── README.md
```

## Technologies

- **Runtime :** Node.js
- **Framework :** Express
- **Base de données :** PostgreSQL
- **Authentification :** JWT (jsonwebtoken)
- **Hash des mots de passe :** bcryptjs
- **Tests :** Jest + Supertest
- **Linter :** ESLint
