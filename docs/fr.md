# Audiobookshelf

Intégrez votre serveur [Audiobookshelf](https://www.audiobookshelf.org) (livres
audio et podcasts) à Gladys, sur votre réseau local : qui écoute quoi, la
progression et le temps restant de chaque livre, les minutes écoutées
aujourd'hui, les derniers ajouts avec leurs couvertures sur le tableau de bord,
et des scènes qui réagissent quand quelqu'un lance ou arrête une écoute,
termine un livre, ou quand un nouvel épisode de podcast est téléchargé.

L'intégration a été testée avec un vrai serveur Audiobookshelf 2.37 (l'image
Docker officielle), pas encore dans une vraie installation de Gladys : vos
retours sont les bienvenus sur le [forum Gladys](https://community.gladysassistant.com)
ou dans les [issues](https://github.com/guim31/gladys-audiobookshelf/issues).

## Ce qu'il vous faut

- Gladys Assistant 5.1.0 ou plus récent.
- Un serveur **Audiobookshelf** joignable depuis Gladys (même réseau).
- Une **clé d'API d'administrateur** : dans Audiobookshelf, **Paramètres** →
  **Clés API** → **Ajouter**, pour un utilisateur admin (Audiobookshelf 2.26 ou
  plus récent). Sur un serveur plus ancien, utilisez le jeton d'API d'un
  utilisateur admin (**Paramètres** → **Utilisateurs** → l'utilisateur). Seul
  un administrateur peut lire les sessions d'écoute et la progression de tous
  les utilisateurs.

## Mise en place

1. Installez l'intégration depuis le catalogue de Gladys.
2. Dans **Configuration**, saisissez l'**URL du serveur** avec son port (par
   exemple `http://192.168.1.20:13378` ; derrière un reverse proxy,
   `https://example.org/audiobookshelf`) et la **clé d'API**.
3. Si vous le souhaitez, choisissez la fréquence de lecture des sessions
   d'écoute (toutes les 30 secondes par défaut) et la langue des noms.
4. Enregistrez, puis cliquez sur **Tester la connexion** : elle affiche la
   version, les bibliothèques et les utilisateurs trouvés.
5. Dans l'onglet **Découverte**, ajoutez le serveur et les utilisateurs à
   suivre.

## Appareils

**Audiobookshelf** (le serveur) :

| Fonctionnalité           | Signification                                           |
| ------------------------ | ------------------------------------------------------- |
| **En ligne**             | 1 tant que l'intégration lit le serveur                 |
| **Écoutes en cours**     | nombre de lecteurs en train de jouer                    |
| **Livres audio**         | livres des bibliothèques de livres                      |
| **Podcasts**             | podcasts des bibliothèques de podcasts                  |
| **Épisodes de podcasts** | épisodes téléchargés dans les bibliothèques de podcasts |
| **Version**              | version d'Audiobookshelf                                |

**Audiobookshelf <utilisateur>** (un appareil par utilisateur du serveur) :

| Fonctionnalité         | Signification                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **En écoute**          | 1 tant qu'un lecteur de l'utilisateur joue                                              |
| **Titre en cours**     | le livre (avec son auteur) ou l'épisode (avec son podcast) en lecture, sinon le dernier |
| **Progression**        | position dans ce livre ou cet épisode, en %                                             |
| **Temps restant**      | minutes restantes de ce livre ou de cet épisode                                         |
| **Écouté aujourd'hui** | minutes écoutées aujourd'hui (jour du serveur)                                          |

Un lecteur en pause garde sa session ouverte : l'utilisateur compte comme en
écoute jusqu'à ce que le lecteur n'ait plus signalé sa position depuis 90
secondes.

## Tableau de bord

- **En cours d'écoute** : qui écoute quoi, avec les couvertures, la
  progression et un badge _En écoute_ ou _En pause_ (une session en pause reste
  affichée 30 minutes), le nombre de lecteurs en train de jouer et les minutes
  écoutées aujourd'hui. Tous les utilisateurs, ou celui choisi dans les
  réglages du widget.
- **Derniers ajouts** : une grille des derniers livres audio et épisodes de
  podcast ajoutés, avec leurs couvertures, le nombre de livres audio et de
  podcasts, et un bouton **Chercher des épisodes** (le même que l'action de
  scène ci-dessous).

## Scènes

### Déclencheurs

- **Écoute démarrée** : un utilisateur lance ou reprend un livre audio ou un
  épisode. Filtres : l'utilisateur, le type (livre audio ou épisode de
  podcast). Informations : utilisateur, titre, auteur, podcast, type,
  progression.
- **Écoute arrêtée** : un utilisateur met en pause ou arrête (90 secondes sans
  progression). Mêmes filtres et informations, plus les minutes écoutées dans
  la session.
- **Livre ou épisode terminé** : un utilisateur arrive au bout d'un livre ou
  d'un épisode, ou le marque comme terminé. Mêmes filtres.
- **Nouvel épisode de podcast téléchargé** : Audiobookshelf a téléchargé un
  nouvel épisode (téléchargement automatique, ou l'action ci-dessous). Filtre :
  le titre du podcast, exactement comme dans Audiobookshelf. Informations :
  podcast, titre de l'épisode, bibliothèque, durée en minutes.

### Actions

- **Chercher de nouveaux épisodes de podcast** : Audiobookshelf lit le flux de
  chaque podcast et télécharge les nouveaux épisodes. Résultats : podcasts
  vérifiés, nouveaux épisodes trouvés.
- **Lire où j'en suis de mon livre audio** : une phrase pour une notification
  ou une enceinte, par exemple _« alice en est à 33 % de Quiet Morning de Jane
  Doe, reste 7 min. »_ Choisissez l'utilisateur ; vide, tous ceux qui écoutent
  ou ont un livre en cours. Résultats : la phrase, le titre, la progression.

### Idées de scènes

- **Histoire du soir** : quand _Écoute démarrée_ pour l'utilisateur des enfants
  après 20 h, baisser la lumière de la chambre ; quand _Écoute arrêtée_,
  l'éteindre.
- **Podcast du matin** : chaque jour à 6 h, _Chercher de nouveaux épisodes de
  podcast_ ; quand _Nouvel épisode de podcast téléchargé_ pour votre émission
  quotidienne, envoyer une notification avec son titre.
- **Félicitations** : quand _Livre ou épisode terminé_ avec le type livre
  audio, envoyer un message de félicitations avec le titre du livre.

## Dépannage

- **« le serveur ne répond pas »** : vérifiez l'adresse et le port depuis la
  machine de Gladys. Gladys fait tourner l'intégration dans un conteneur :
  `localhost` est le conteneur lui-même, utilisez l'adresse IP de la machine.
- **« clé d'API refusée »** : la clé a été supprimée, désactivée ou a expiré ;
  créez-en une nouvelle.
- **« cette clé d'API n'est pas celle d'un administrateur »** : créez la clé
  pour un utilisateur de type admin ou root.
- **« aucun serveur Audiobookshelf à cette adresse »** ou **« l'adresse
  redirige »** : un serveur derrière un reverse proxy demande son chemin
  (`https://example.org/audiobookshelf`) ; une page de connexion du proxy
  bloque l'API : utilisez l'adresse locale.
- **« certificat refusé »** : le HTTPS avec un certificat auto-signé n'est pas
  pris en charge ; utilisez l'adresse en `http://` de votre réseau.
- Pas de couverture : Audiobookshelf n'en a pas pour ce livre ou ce podcast.
- L'intégration ne journalise que son cycle de vie ; avec `LOG_LEVEL=debug`,
  elle journalise aussi chaque événement d'écoute, avec les titres.

## Limites

- Les sessions sont lues toutes les 15 à 60 secondes, pas poussées : un
  démarrage ou un arrêt arrive dans Gladys dans cet intervalle (90 secondes
  pour une pause).
- Les bibliothèques, les utilisateurs, la progression et le temps écouté
  aujourd'hui sont lus toutes les 5 minutes, et aussitôt pour un utilisateur
  qui lance ou arrête une écoute.
- Les livres terminés et les épisodes téléchargés depuis plus de 24 heures ne
  sont pas annoncés (un Gladys arrêté deux jours ne les rejoue pas).
- Les livres numériques et leur progression de lecture ne sont pas pris en
  charge.
- Pas de commande de lecture : Audiobookshelf ne permet pas de piloter ses
  lecteurs à distance.
- Sans lien avec le projet Audiobookshelf.
