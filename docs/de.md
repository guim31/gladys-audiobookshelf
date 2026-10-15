# Audiobookshelf

Bringe deinen [Audiobookshelf](https://www.audiobookshelf.org)-Server
(Hörbücher und Podcasts) über dein lokales Netzwerk in Gladys: wer was hört,
der Fortschritt und die Restzeit jedes Buchs, die heute gehörten Minuten, die
letzten Neuzugänge mit ihren Covern auf dem Dashboard, und Szenen, die
reagieren, wenn jemand eine Wiedergabe startet oder beendet, ein Buch zu Ende
hört oder eine neue Podcast-Episode heruntergeladen wird.

Die Integration wurde mit einem echten Audiobookshelf-2.37-Server (dem
offiziellen Docker-Image) getestet, aber noch nicht in einer echten
Gladys-Installation: Rückmeldungen sind im
[Gladys-Forum](https://community.gladysassistant.com) oder in den
[Issues](https://github.com/guim31/gladys-audiobookshelf/issues) willkommen.

## Was du brauchst

- Gladys Assistant 5.1.0 oder neuer.
- Einen **Audiobookshelf**-Server, der von Gladys aus erreichbar ist (gleiches
  Netzwerk).
- Einen **API-Schlüssel eines Administrators**: in Audiobookshelf unter
  **Einstellungen** → **API-Schlüssel** → **Hinzufügen**, für einen Admin
  (Audiobookshelf 2.26 oder neuer). Bei einem älteren Server nimm das API-Token
  eines Admins (**Einstellungen** → **Benutzer** → der Benutzer). Nur ein
  Administrator kann die Wiedergabesitzungen und den Fortschritt aller
  Benutzer lesen.

## Einrichtung

1. Installiere die Integration aus dem Gladys-Katalog.
2. Gib unter **Konfiguration** die **Server-URL** mit Port ein (zum Beispiel
   `http://192.168.1.20:13378`; hinter einem Reverse Proxy
   `https://example.org/audiobookshelf`) und den **API-Schlüssel**.
3. Wähle bei Bedarf, wie oft die Wiedergabesitzungen gelesen werden
   (standardmäßig alle 30 Sekunden), und die Sprache der Namen.
4. Speichere und klicke auf **Verbindung testen**: Es zeigt die Version, die
   Bibliotheken und die gefundenen Benutzer.
5. Füge im Tab **Erkennung** den Server und die Benutzer hinzu, denen du
   folgen willst.

## Geräte

**Audiobookshelf** (der Server):

| Funktion                 | Bedeutung                                             |
| ------------------------ | ----------------------------------------------------- |
| **Online**               | 1, solange die Integration den Server liest           |
| **Laufende Wiedergaben** | Anzahl der Player, die gerade spielen                 |
| **Hörbücher**            | Bücher in den Buchbibliotheken                        |
| **Podcasts**             | Podcasts in den Podcast-Bibliotheken                  |
| **Podcast-Episoden**     | heruntergeladene Episoden in den Podcast-Bibliotheken |
| **Version**              | Version von Audiobookshelf                            |

**Audiobookshelf <Benutzer>** (ein Gerät pro Benutzer des Servers):

| Funktion            | Bedeutung                                                                      |
| ------------------- | ------------------------------------------------------------------------------ |
| **Hört gerade**     | 1, solange ein Player des Benutzers spielt                                     |
| **Aktueller Titel** | das laufende Buch (mit Autor) oder die Episode (mit Podcast), sonst das letzte |
| **Fortschritt**     | Position in diesem Buch oder dieser Episode, in %                              |
| **Restzeit**        | verbleibende Minuten dieses Buchs oder dieser Episode                          |
| **Heute gehört**    | heute gehörte Minuten (Tag des Servers)                                        |

Ein pausierter Player hält seine Sitzung offen: Der Benutzer gilt als hörend,
bis der Player seine Position 90 Sekunden lang nicht gemeldet hat.

## Dashboard

- **Wird gerade gehört**: wer was hört, mit Covern, Fortschritt und einem
  Abzeichen _Läuft_ oder _Pausiert_ (eine pausierte Sitzung bleibt 30 Minuten
  sichtbar), die Anzahl der spielenden Player und die heute gehörten Minuten.
  Alle Benutzer oder der in den Widget-Einstellungen gewählte.
- **Zuletzt hinzugefügt**: ein Raster der zuletzt hinzugefügten Hörbücher und
  Podcast-Episoden mit ihren Covern, die Anzahl der Hörbücher und Podcasts und
  eine Schaltfläche **Episoden suchen** (wie die Szenenaktion unten).

## Szenen

### Auslöser

- **Wiedergabe gestartet**: Ein Benutzer startet oder setzt ein Hörbuch oder
  eine Episode fort. Filter: der Benutzer, der Typ (Hörbuch oder
  Podcast-Episode). Informationen: Benutzer, Titel, Autor, Podcast, Typ,
  Fortschritt.
- **Wiedergabe beendet**: Ein Benutzer pausiert oder hört auf (90 Sekunden
  ohne Fortschritt). Gleiche Filter und Informationen, dazu die in der Sitzung
  gehörten Minuten.
- **Buch oder Episode beendet**: Ein Benutzer erreicht das Ende eines Buchs
  oder einer Episode oder markiert es als beendet. Gleiche Filter.
- **Neue Podcast-Episode heruntergeladen**: Audiobookshelf hat eine neue
  Episode heruntergeladen (automatischer Download oder die Aktion unten).
  Filter: der Titel des Podcasts, genau wie in Audiobookshelf angezeigt.
  Informationen: Podcast, Titel der Episode, Bibliothek, Dauer in Minuten.

### Aktionen

- **Nach neuen Podcast-Episoden suchen**: Audiobookshelf liest den Feed jedes
  Podcasts und lädt die neuen Episoden herunter. Ergebnisse: geprüfte
  Podcasts, gefundene neue Episoden.
- **Vorlesen, wo ich im Hörbuch bin**: ein Satz für eine Benachrichtigung oder
  einen Lautsprecher, zum Beispiel _„alice ist bei 33 % von Quiet Morning von
  Jane Doe, noch 7 min.“_ Wähle den Benutzer; leer: alle, die gerade hören
  oder ein Buch in Arbeit haben. Ergebnisse: der Satz, der Titel, der
  Fortschritt.

### Szenenideen

- **Gutenachtgeschichte**: Bei _Wiedergabe gestartet_ für den Benutzer der
  Kinder nach 20 Uhr das Licht im Kinderzimmer dimmen; bei _Wiedergabe
  beendet_ ausschalten.
- **Morgenpodcast**: Jeden Tag um 6 Uhr _Nach neuen Podcast-Episoden suchen_;
  bei _Neue Podcast-Episode heruntergeladen_ für deine tägliche Sendung eine
  Benachrichtigung mit ihrem Titel senden.
- **Glückwunsch**: Bei _Buch oder Episode beendet_ mit dem Typ Hörbuch eine
  Glückwunschnachricht mit dem Titel des Buchs senden.

## Fehlerbehebung

- **„der Server antwortet nicht“**: Prüfe Adresse und Port vom Gladys-Rechner
  aus. Gladys führt die Integration in einem Container aus: `localhost` ist
  der Container selbst, verwende die IP-Adresse des Rechners.
- **„API-Schlüssel abgelehnt“**: Der Schlüssel wurde gelöscht, deaktiviert
  oder ist abgelaufen; erstelle einen neuen.
- **„dieser API-Schlüssel gehört keinem Administrator“**: Erstelle den
  Schlüssel für einen Benutzer vom Typ admin oder root.
- **„kein Audiobookshelf-Server unter dieser Adresse“** oder **„die Adresse
  leitet um“**: Ein Server hinter einem Reverse Proxy braucht seinen Pfad
  (`https://example.org/audiobookshelf`); eine Anmeldeseite des Proxys
  blockiert die API: Verwende die lokale Adresse.
- **„Zertifikat abgelehnt“**: HTTPS mit einem selbstsignierten Zertifikat wird
  nicht unterstützt; verwende die `http://`-Adresse in deinem Netzwerk.
- Kein Cover: Audiobookshelf hat keines für dieses Buch oder diesen Podcast.
- Die Integration protokolliert nur ihren Lebenszyklus; mit `LOG_LEVEL=debug`
  protokolliert sie auch jedes Wiedergabeereignis mit den Titeln.

## Grenzen

- Die Sitzungen werden alle 15 bis 60 Sekunden gelesen, nicht gepusht: Ein
  Start oder ein Ende erreicht Gladys innerhalb dieses Intervalls (90 Sekunden
  bei einer Pause).
- Bibliotheken, Benutzer, Fortschritt und die heute gehörte Zeit werden alle
  5 Minuten gelesen, und sofort für einen Benutzer, der eine Wiedergabe
  startet oder beendet.
- Bücher, die vor mehr als 24 Stunden beendet, und Episoden, die vor mehr als
  24 Stunden heruntergeladen wurden, werden nicht gemeldet (ein zwei Tage
  gestopptes Gladys spielt sie nicht nach).
- E-Books und ihr Lesefortschritt werden nicht unterstützt.
- Keine Wiedergabesteuerung: Audiobookshelf erlaubt keine Fernsteuerung seiner
  Player.
- Nicht mit dem Audiobookshelf-Projekt verbunden.
