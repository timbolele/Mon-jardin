# Mon Jardin

Application personnelle de gestion des plantes, entièrement locale et responsive. Cette V1 permet de gérer les fiches plantes, photos, objectifs, observations, entretiens, rappels, historique, calendrier, recherche et sauvegardes.

## Lancer l'application

1. Ouvrez un terminal dans ce dossier.
2. Lancez `python3 -m http.server 8000`.
3. Ouvrez <http://localhost:8000> dans votre navigateur.

Aucune installation ni compte n'est nécessaire.

## Données et sauvegardes

Les données (photos comprises) sont enregistrées dans le stockage local du navigateur (`localStorage`), sous la clé `mon-jardin-v1`. Elles restent sur cet appareil et dans ce navigateur.

Utilisez la page **Sauvegarde** pour télécharger une copie JSON complète, la restaurer, ou exporter la liste des plantes au format CSV. Il est recommandé de télécharger régulièrement une sauvegarde et de la conserver dans vos documents ou sur un disque externe.

> Effacer les données du navigateur efface aussi le jardin local. Faites une sauvegarde auparavant.
