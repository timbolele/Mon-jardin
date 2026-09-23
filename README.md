# Mon Jardin

Application personnelle de gestion des plantes, responsive et installable en PWA.

## V2 en préparation

La branche `v2-pwa-weather` ajoute :

- installation sur l'écran d'accueil (PWA) ;
- fonctionnement hors ligne pour l'interface ;
- stockage IndexedDB avec migration depuis le stockage local existant ;
- météo locale à la demande via la localisation du navigateur ;
- alertes froid/chaleur basées uniquement sur les seuils renseignés par l'utilisateur ;
- fiches plantes enrichies : exposition, substrat, dernier rempotage, dimensions du pot et seuils météo ;
- correction du jour affiché sur l'accueil.

La météo utilise Open-Meteo. La position est transmise directement depuis le navigateur au service météo lors de la demande et n'est pas enregistrée dans le dépôt GitHub.

## Données

Une copie de secours reste enregistrée dans `localStorage` sous la clé `mon-jardin-v1` pendant la migration. La source principale de la V2 est IndexedDB.

Les exports JSON et CSV existants restent disponibles depuis la page **Sauvegarde**.

> Avant tout changement important, conserver une sauvegarde JSON reste recommandé.
