# IPTV Player

> Lecteur IPTV web moderne, rapide et gratuit -- fonctionne partout sans installation

[![Live Demo](https://img.shields.io/badge/Live-Demo-orange)](https://anonyme-afk.github.io/IPTV-channe/)
[![GitHub Pages](https://img.shields.io/badge/Hosted-GitHub%20Pages-blue)](https://anonyme-afk.github.io/IPTV-channe/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Stack-Vanilla%20JS%20ES6%2B-yellow)]()

---

## Fonctionnalites

### Lecture video
- Lecture HLS via Hls.js (compatible tous navigateurs)
- Detection automatique de stall avec recovery (5s sans progression -> tentative de recuperation)
- Configuration optimisee pour les flux IPTV (720p/1080p, 2-5 Mbps)
- Support natif HLS sur iOS Safari
- Picture-in-Picture (PiP) sur navigateurs compatibles
- Plein ecran (avec support webkit pour iOS)
- Controle du volume + mute
- Statistiques en temps reel (resolution, bande passante, buffer)
- Capture d'ecran de la video en cours
- Pre-check URL 3s avant lecture (HEAD request + AbortController)
- Support des DRM / Geoblocages avec detection via banniere informative

### Playlists et Chaines
- Chargement M3U/M3U8 depuis URL, fichier local ou texte colle
- 80+ playlists pre-integrees en onglets (Populaires, Categories, Pays, Langues, Regions, Continents, Sources)
- Listes exhaustives par pays (160+ pays classes par continents)
- Virtual scrolling pour les listes de 100 000+ chaines (seulement 40-60 elements DOM rendus)
- Parsing non-bloquant avec barre de progression (chunks de 2000 lignes)
- Recherche instantanee avec debounce 250ms + index pre-calcule
- Categories automatiques avec barre scrollable et fleches de navigation
- Favoris persistants (localStorage)
- Historique des 100 dernieres chaines lues
- Export des favoris en fichier M3U
- Zapping numerique (taper 1-3 chiffres -> Enter)
- Suggestion de chaines similaires en cas d'echec (meme groupe)

### Geoblocage
La banniere de geoblocage apparait en cas d'impossibilite de lire un flux. Deux raisons principales :
1. Restriction geographique : La chaine est reservee a certains pays. Utilisez un VPN gratuit comme Proton VPN ou Windscribe.
2. Flux protege (DRM) : La chaine bloque les lecteurs tiers. Utilisez l'application officielle requise.

### Interface et UX
- Mode TV specifique : Navigation par cases (grille dynamique) pour grands ecrans (comme YouTube TV)
- Logo vectoriel (SVG) pour l'interface de l'application et la PWA
- Theme sombre / clair (detection automatique systeme + toggle manuel + touche T)
- Responsive : mobile 360px -> desktop 4K -> Smart TV
- Navigation 2D spatiale (clavier, manette Gamepad API, telecommande tactile)
- Barre de categories scrollable avec fleches chevrons et degrades visuels
- i18n : Francais, English, Espanol, Deutsch, Arabe, Portugues
- Detection automatique de la langue du navigateur
- Skeleton loading pendant le parsing
- Raccourcis clavier complets (F, M, T, I, P, S, R, ?)

### Performance
- Virtual scroll : seulement 40-60 elements DOM au lieu de 100 000
- Cache des logos via Service Worker
- Parsing chunke : thread principal jamais bloque
- Optimisations iOS Safari (backdrop-filter desactive, Visual Viewport API)
- Detection appareil lent (deviceMemory < 4, hardwareConcurrency < 4)
- MutationObserver cache invalidation pour navigation fluide

### PWA
- Installable sur ecran d'accueil (mobile + desktop)
- Service Worker avec cache intelligent (network-first)
- Fonctionne hors ligne (interface + derniere playlist)
- Manifest complet (nom, icones vectorielles dynamiques, theme)

---

## Utilisation

### Option 1 -- Serveur local (developpement)
```bash
git clone https://github.com/anonyme-afk/IPTV-channe.git
cd IPTV-channe
npm install
npm run start
# Ouvrir le port 3000 indique
```

### Option 2 -- Auto-chargement via URL
```
http://localhost:3000/?m3u=https://URL_DE_TA_PLAYLIST.m3u
```

---

## Raccourcis clavier

| Touche | Action |
|--------|--------|
| `<-` `->` `^` `v` | Navigation 2D spatiale |
| `Enter` / `Espace` | Selectionner l'element actif |
| `Esc` / `Backspace` | Fermer / Retour |
| `0-9` (3 chiffres max) | Zapping direct (chaine n°X) |
| `PageUp` / `PageDown` | Chaine precedente / suivante |
| `Home` | Premier element |
| `Tab` / `Shift+Tab` | Element suivant / precedent |
| `F` | Plein ecran |
| `M` | Mute / Unmute |
| `T` | Basculer theme clair/sombre |
| `I` | Statistiques du flux |
| `P` | Picture-in-Picture |
| `S` | Capture d'ecran |
| `R` | Telecommande tactile |
| `?` | Aide clavier |
| `D` | Mode debug |

---

## Manette / Telecommande TV

Support complet du Gamepad API :
- D-Pad / Stick gauche : navigation entre les elements
- Bouton A (0) : selectionner / lire
- Bouton B (1) / Back (8) : retour
- LB (4) / RB (5) : chaine precedente / suivante
- Start (9) : plein ecran
- Triggers : stop

---

## Structure du projet

```
IPTV-channe/
  index.html          # Page principale (structure HTML, modale, presets)
  server.js           # Serveur local Node.js (port 3000, dev)
  sw.js               # Service Worker PWA (cache strategique)
  manifest.json       # Manifest PWA (nom, icones, theme)
  assets/
    logo.svg          # Logo de l'application
  css/
    style.css         # CSS, variables CSS, themes clair/sombre, responsive
  js/
    app.js            # Etat global, rendu virtual scroll, parsing chunke, modales geoblocage
    player.js         # Lecteur HLS + stall detection + PiP + stats + error handling
    parser.js         # Parseur M3U/M3U8 robuste
    nav.js            # Navigation 2D spatiale (clavier + manette + tactile)
    i18n.js           # Internationalisation 6 langues
    storage.js        # localStorage wrapper + ThemeManager
  README.md
```

### Structure d'un objet channel
```js
{
  name: "TF1",
  group: "France",
  logo: "https://example.com/logo.png",
  id: "tf1.fr",
  url: "https://stream.example.com/tf1.m3u8"
}
```

---

## Playlists integrees

> Toutes les playlists proviennent d'**[iptv-org/iptv](https://github.com/iptv-org/iptv)**

### Plus de 160 pays par 6 continents :
- Europe
- Afrique
- Moyen-Orient
- Asie
- Ameriques
- Oceanie

### Sources gratuites et legales :
- Free-TV
- Pluto TV
- Plex TV
- Roku
- Tubi TV
- DistroTV

---

## Technologies

| Technologie | Utilisation |
|-------------|-------------|
| HTML5 / CSS3 | Structure, Grid, Flexbox, Variables CSS, animations |
| Vanilla JS ES6+ | Logique (aucune dependance lourde) |
| [Hls.js](https://github.com/video-dev/hls.js) v1.4.12 | Lecture des flux HLS |
| [Lucide Icons](https://lucide.dev/) | Iconographie vectorielle |
| Google Fonts | Rajdhani + Share Tech Mono |
| Service Worker | Cache PWA, logos des chaines |

---

## Compatibilite

| Navigateur | Support |
|------------|---------|
| Chrome 90+ | Complet |
| Firefox 90+ | Complet |
| Safari 14+ | Complet (webkit fullscreen) |
| Edge 90+ | Complet |
| Samsung Internet | Complet |
| iOS Safari | Adapte (no blur, fullscreen webkit, visualViewport) |

### Proxies CORS integres
- Acces direct en premier
- corsproxy.io (fallback 1)
- api.allorigins.win (fallback 2)
- corsproxy.org (fallback 3)
- thingproxy.freeboard.io (fallback 4)

---

## Responsive

- Mobile 360px : layout colonne, sidebar overlay, scroll tactile, telecommande integree
- Tablette 768px : layout mixte avec sidebar reduite
- Desktop 1280px : layout full sidebar + player
- 4K TV 1920px+ : optimise grand ecran, navigation manette, polices agrandies

---

## Vie privee

- **Aucune donnee envoyee** : tout fonctionne cote client
- **Pas de tracking, pas de cookies**
- Les favoris/historique sont stockes uniquement dans votre navigateur (localStorage)
- Les proxies CORS publics voient les URLs des playlists (non les flux video)

---

## Credits

- Playlists : **[iptv-org/iptv](https://github.com/iptv-org/iptv)** (Unlicense / domaine public)
- Lecteur HLS : **[Hls.js](https://github.com/video-dev/hls.js)** (Apache 2.0)
- Icones : **[Lucide](https://lucide.dev/)** (ISC)
- Polices : **[Rajdhani](https://fonts.google.com/specimen/Rajdhani)** et **[Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono)** (SIL Open Font License)

---

## Licence

Ce projet est libre d'utilisation. Les playlists proviennent d'iptv-org sous licence Unlicense.

---

*Developpe avec passion 💖 pour une experience IPTV sans compromis -- depuis n'importe quel navigateur.*