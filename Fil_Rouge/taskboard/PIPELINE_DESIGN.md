Quels stages votre pipeline doit-elle comporter ?
- `lint`, `test`, `build`.

Quels jobs dans chaque stage ?
- Un job par stage, respectivement `lint`, `test`, `build`.

Quelles dépendances entre jobs (needs) ?
- `test` dépend de `lint`, `build` dépend de `test`.

Sur quels événements la pipeline se déclenche-t-elle ?
- Sur `push` et `pull_request`.

Certains jobs doivent-ils s'exécuter uniquement sur main ?
- Oui, le job `build` s'exécute seulement sur `main`.