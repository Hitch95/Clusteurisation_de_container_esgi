<ul>
    <li>Que faudrait-il modifier pour router /api vers un service et /admin vers un autre ?</li>
    <p>Réponse : Il faut modifier le fichier Ingress pour ajouter deux entrées dans la section `paths`. Une route avec le `path: /api` pointera vers le service de l'API, et l'autre avec `path: /admin` pointera vers le service d'administration.</p>

    <li>Comment ajouteriez-vous HTTPS avec un certificat auto-signé ?</li>
    <p>Réponse : On commence par créer un Secret Kubernetes de type `tls` contenant le certificat (`tls.crt`) et la clé privée. Ensuite, on ajoute une section `tls` dans le fichier Ingress en précisant le nom de ce Secret.</p>

</ul>

## Questions

1. Quelle est la différence entre un **Secret** et un **ConfigMap** ? Dans quels cas utiliser l'un ou l'autre ?
   **Réponse :** Un Secret est utilisé pour stocker des données sensibles (comme des mots de passe) qui sont encodées en base64 pour ne pas être lisibles en clair au premier coup d'œil. Un ConfigMap sert à stocker des paramètres de configuration classiques (ports, noms de bases de données, etc.) qui ne sont pas confidentiels.

2. Pourquoi MySQL ne tourne-t-il qu'avec `replicas: 1` alors que l'application en a `2` ?
   **Réponse :** L'application Node.js est "stateless" (sans état), on peut donc la multiplier facilement. MySQL, en revanche, gère des données sur un disque. Si on lançait plusieurs instances sans configuration complexe, elles risqueraient d'écrire en même temps sur le même stockage et de corrompre les données.

3. Que se passe-t-il si vous supprimez le PVC et que vous recréez le pod MySQL ? Que concluez-vous ?
   **Réponse :** Le pod MySQL va se relancer avec une base de données complètement vide parce qu'on a détruit la "demande de disque dur". Conclusion : le PVC est vital pour sauvegarder les données quand un pod redémarre.

4. Expliquez le rôle de `podAntiAffinity` et ce qui se passerait sans cette règle sur un cluster de production.
   **Réponse :** Ça force Kubernetes à placer nos 2 pods d'application sur deux workers (nœuds) différents. Sans ça, s'il les met tous les deux sur la même machine et qu'elle crashe, toute l'application devient hors ligne !

5. Quelle différence y a-t-il entre un Service de type `ClusterIP`, `NodePort` et `LoadBalancer` ?
   **Réponse :**

- ClusterIP : L'app est accessible uniquement depuis l'intérieur du cluster.
- NodePort : Ça ouvre un port sur toutes les machines pour y accéder depuis l'extérieur.
- LoadBalancer : C'est pour les clouds (AWS, GCP), ça nous donne une vraie IP publique de répartition de charge.

6. Pourquoi `imagePullPolicy: Never` est-il nécessaire ici mais pas en production ?
   **Réponse :** En local, on a buildé l'image directement sur le minikube, donc on dit à Kubernetes "ne la télécharge pas, prends celle que tu as". En prod, l'image est sur un registre distant (Docker Hub) donc on voudra "Always" la télécharger.

7. Quelle est la différence entre un HPA et un **VPA** (Vertical Pod Autoscaler) ?
   **Réponse :** Le HPA rajoute des pods supplémentaires quand ça sature (scalabilité Horizontale). Le VPA lui va rajouter de la RAM et du CPU aux pods qui existent déjà (scalabilité Verticale).

8. Pourquoi le scale down du HPA est-il volontairement plus lent que le scale up ?
   **Réponse :** C'est une sécurité pour éviter "l'effet yoyo". On veut monter en charge très vite en cas de besoin, mais on attend que le trafic se stabilise avant de supprimer des pods, au cas où un nouveau pic arriverait juste après.

9. En quoi le StatefulSet est-il plus adapté qu'un Deployment pour une base de données répliquée ?
   **Réponse :** Le StatefulSet est conçu pour les applications qui ont besoin d'une identité stable. Il garantit que chaque pod a un nom fixe (mysql-0, mysql-1, etc.) et son propre disque persistant attaché, ce qui est obligatoire pour gérer correctement la réplication des données.

---

## Bonus

- ✅ Configurez du **TLS** sur l'Ingress avec un certificat auto-signé via `cert-manager` (fichiers fournis et secret configuré)
- ✅ Remplacez le Deployment MySQL par un **StatefulSet** et observez les différences de comportement
- ✅ Tester **Helm** en créant un chart pour packager l'ensemble de vos manifests
- ✅ Mettez en place un **VPA** (Vertical Pod Autoscaler) sur MySQL et comparez son comportement avec le HPA
- ✅ Ajoutez un second service sur un path différent (`/api`) et configurez l'Ingress pour router vers les deux
