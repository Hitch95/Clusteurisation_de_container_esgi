## Mini compte rendu de TP

L’image du Dockerfile classic est plus lourde que celle du multistage, car elle embarque plus de dépendances et de fichiers.
Le multistage réduit le poids en séparant la phase de build et la phase d’exécution.
Première raison : les dépendances de développement ne sont pas conservées dans l’image finale.
Deuxième raison : le runtime ne copie que les fichiers utiles, comme `server.js` et `public`.
Amélioration possible en production : Ajouter un `.dockerignore` pour éviter de copier les fichiers inutiles.