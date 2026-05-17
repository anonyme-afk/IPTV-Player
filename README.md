# IPTV Player

![GitHub Pages](https://img.shields.io/badge/Hebergement-GitHub%20Pages-181717?style=flat)
![License](https://img.shields.io/badge/Licence-MIT-blue?style=flat)
![HLS.js](https://img.shields.io/badge/Lecteur-HLS.js%201.4-orange?style=flat)
![Responsive](https://img.shields.io/badge/Responsive-PC%20%2F%20TV%20%2F%20Mobile-green?style=flat)

Lecteur IPTV web complet, deploye sur GitHub Pages, sans backend,
sans installation, gratuit. Fonctionne sur PC, smart TV, mobile et tablette.
Lit les playlists au format M3U, M3U8 et JSON (famelack).

---

## Acces rapide

Le site est disponible a l'adresse :
https://anonyme-afk.github.io/IPTV-channe/

---

## Fonctionnalites

### Lecture video
- Lecture HLS adaptative via HLS.js (pas de plugin requis)
- Lecture native HLS sur iOS / Safari (fallback automatique)
- Picture-in-Picture (raccourci P ou bouton controles)
- Mode plein ecran (raccourci F ou bouton controles)
- Capture d'image (raccourci S) — enregistre un PNG
- Statistiques temps reel : resolution, bande passante, buffer, FPS (raccourci I)
- Detection et recuperation automatique des gels de flux (stall recovery)

### Sources de chaines
- Chargement via URL directe (M3U, M3U8, JSON)
- Chargement depuis un fichier local
- Chargement par copier-coller du contenu M3U
- Sources preconfigureees organisees en cinq onglets :
  - Populaires : Pluto TV, Plex TV, Roku Channel, Samsung TV Plus, DistroTV, freecasthub...
  - Categories : documentaire, sport, musique, enfants, news... (iptv-org + famelack)
  - Pays : environ 190 pays organises par continent (iptv-org + famelack)
  - Langues : 25 langues avec codes ISO 639-3
  - Regions : 21 zones mondiales (Europe, Afrique, Asie, MENA, Amerique latine...)

### Interface
- Theme sombre par defaut, theme clair disponible via bouton ou raccourci T
- Le theme revient toujours au sombre au rechargement (pas de sauvegarde)
- Barre de categories avec scroll horizontal et fleches de navigation
- Recherche en temps reel avec debounce 250 ms
- Favoris sauvegardes en localStorage
- Historique des 50 dernieres chaines vues
- Zapping numerique : taper un numero de chaine + attente 1,4 s
- Indicateur equalizer sur la chaine en lecture
- Banniere d'avertissement automatique sur les chaines geobloquees ou protegees

### Support Smart / Android TV
- Navigation 2D optimisee via telecommande (D-pad)
- Controle de lecture : Play / Pause avec bouton Media
- Navigation rapide : bouton GAUCHE/DROITE pour chaine precedente/suivante
- Interface adaptee automatiquement (focus visuel, cursor masqué)

### Progressive Web App
- Installable sur mobile et bureau via le navigateur
- Service Worker : cache des assets statiques, logos en stale-while-revalidate
- Fonctionne hors ligne pour l'interface (les flux video restent en ligne requis)

---

## Raccourcis clavier

| Touche       | Action                          |
|--------------|---------------------------------|
| F            | Plein ecran                     |
| M            | Mute / Unmute                   |
| T            | Basculer theme sombre / clair   |
| P            | Picture-in-Picture              |
| S            | Capturer une image              |
| I            | Statistiques temps reel         |
| Fleche gauche / PageUp   | Chaine precedente   |
| Fleche droite / PageDown | Chaine suivante     |
| 0 a 9        | Zapping numerique               |
| Echap / Backspace | Fermer modal / sidebar     |
| Media Play/Pause | Lecture / Pause (TV)        |

---

## Geoblocage et flux proteges

Certaines chaines apparaissent dans les playlists publiques mais ne sont pas
accessibles depuis tous les pays. Deux situations principales :

1. Restriction geographique : la chaine diffuse uniquement dans certains pays.
   Solution : utiliser un VPN regle sur le pays cible.
   VPN gratuits recommandes : Proton VPN (protonvpn.com), Windscribe (windscribe.com).

2. Flux protege par DRM (Widevine) : la chaine exige son application officielle.
   Exemples : TF1+, M6+, France.tv, Canal+. Ces chaines ne peuvent pas etre
   lues dans un lecteur web tiers, meme avec un VPN.

Le lecteur affiche une banniere d'information quand une chaine echoue
pour l'une de ces raisons.

---

## Sources de donnees

| Source          | Type          | Description                                        |
|-----------------|---------------|----------------------------------------------------|
| iptv-org        | M3U           | Collection mondiale open source, ~100 000 chaines  |
| famelack-data   | JSON valide   | Streams actifs par pays et categorie, valides auto  |
| Pluto TV        | M3U (FAST)    | 100+ chaines gratuites avec publicites             |
| Plex TV         | M3U (FAST)    | Films, series, news en acces libre                 |
| Roku Channel    | M3U (FAST)    | Chaines gratuites Roku                             |
| Samsung TV Plus | M3U (FAST)    | Chaines gratuites Samsung                          |
| DistroTV        | M3U           | 200+ chaines independantes                         |
| freecasthub     | M3U           | Diffuseurs publics officiels, zero geoblocage      |

---

## Compatibilite

| Navigateur     | Version minimum | Notes                               |
|----------------|-----------------|-------------------------------------|
| Chrome         | 80+             | Reference                           |
| Firefox        | 78+             | Complet                             |
| Safari (iOS)   | 14+             | HLS natif, PiP supporte             |
| Edge           | 80+             | Complet                             |
| Samsung Browser| 13+             | Optimise pour smart TV              |
| Opera          | 70+             | Complet                             |

---

## Structure du projet

```
IPTV-channe/
├── index.html        Interface principale, structure HTML
├── sw.js             Service Worker (cache, offline)
├── manifest.json     Configuration PWA
├── assets/
│   └── favicon.ico
├── css/
│   └── style.css     Design system complet, themes sombre/clair
└── js/
    ├── app.js        Orchestrateur principal, etat, rendu
    ├── data.js       Donnees statiques (pays, categories, langues, regions)
    ├── parser.js     Parseur M3U et JSON famelack
    ├── player.js     Lecteur HLS, gestion erreurs, stall recovery
    ├── nav.js        Navigation clavier et gamepad
    ├── storage.js    Favoris, historique, session (localStorage)
    └── i18n.js       Internationalisation
```

---

## Technologies utilisees

- HLS.js 1.4 — lecture HLS dans tous les navigateurs
- Lucide Icons — icones SVG legeres via CDN
- Space Grotesk + JetBrains Mono — polices via Google Fonts
- Vanilla JS ES6+, HTML5, CSS3 — pas de framework, pas de bundler
- GitHub Pages — hebergement statique gratuit, HTTPS automatique

---

## Licence

MIT — libre d'utilisation, modification et redistribution.
Voir le fichier LICENSE pour les details.
