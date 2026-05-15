# IPTV Player - Lecteur de playlists M3U

> **Acces direct** : [https://anonyme-afk.github.io/IPTV-channe/](https://anonyme-afk.github.io/IPTV-channe/)

Une application web moderne, rapide et elegante pour lire des playlists IPTV (M3U/M3U8). Concue pour fonctionner partout : du smartphone a la Smart TV, en passant par le desktop et la tablette.

> **Remerciements speciaux** : Les playlists integrees proviennent du projet **[iptv-org/iptv](https://github.com/iptv-org/iptv)** qui maintient la plus grande collection mondiale de chaines IPTV publiques. Un grand merci a eux pour leur travail colossal !

---

## Fonctionnalites

| Fonctionnalite | Detail |
|---|---|
| Playlists M3U | Charge depuis URL, fichier local ou texte brut |
| Navigation 2D TV | Pilotable au clavier, a la manette (Gamepad API) ou a la telecommande virtuelle |
| i18n | Interface en francais, anglais, espagnol, allemand, arabe, portugais |
| Responsive | Smartphone, tablette, desktop, TV 4K (1920px+) |
| Presets integres | 80+ playlists iptv-org en 1 clic (categories, pays, langues, regions) |
| Persistance | Derniere playlist, favoris et historique sauvegardes automatiquement |
| Recherche | Filtre instantane par nom ou categorie |
| Proxy CORS | 5 proxys de secours pour les playlists et les flux |
| Son de focus | Feedback audio subtil sur la navigation |
| Telecommande tactile | D-Pad virtuel (touche R ou 3 doigts) |

---

## Utilisation rapide

### Option 1 - Serveur local (recommande)

```bash
# Cloner le depot
git clone https://github.com/anonyme-afk/IPTV-channe.git
cd IPTV-channe

# Lancer le serveur (necessite Node.js)
node server.js

# Ouvrir dans le navigateur
http://localhost:8080
```

### Option 2 - Sans serveur (limite)

Ouvrir `index.html` dans un navigateur.  
**Attention** : depuis `file://`, les requetes fetch vers des URLs externes sont bloquees.  
Utilise plutot le serveur local.

---

## Navigation

| Touche | Action |
|--------|--------|
| `haut` `bas` `gauche` `droite` | Navigation 2D entre les elements |
| `Enter` / `Espace` | Selectionner / Lire |
| `Esc` / `Suppr` | Fermer / Retour |
| `F` | Plein ecran |
| `M` | Muet |
| `R` | Telecommande tactile |
| `PageHaut` / `PageBas` | Chaine precedente / suivante |
| `Home` | Premier element |
| `Tab` | Element suivant |
| `?` | Aide |
| `D` | Mode debug (console) |

### Manette de jeu / Telecommande TV

Le support Gamepad API est automatique : branche une manette et utilise le D-Pad ou le stick gauche.

---

## Playlists integrees

Toutes les playlists proviennent d'**[iptv-org/iptv](https://github.com/iptv-org/iptv)** (licence : domaine public / UFL-1.0).

| Onglet | Contenu |
|--------|---------|
| Populaires | Tout IPTV-org, index, France, USA, UK, Francais |
| Categories | News (940), Sports (332), Films (415), Education, Science, Cuisine... |
| Pays | France, Belgique, Suisse, Canada, USA, Maroc, Algerie, Tunisie... |
| Langues | Francais (422), Anglais (2314), Espagnol (1700), Arabe, Russe... |
| Regions | Europe, Asie, Afrique, Ameriques, Oceanie, Balkans... |

---

## Technologies

- **HTML5 / CSS3** - Variables CSS, Grid, Flexbox, backdrop-filter
- **Vanilla JavaScript** (ES6+) - Aucune dependance lourde
- **[Hls.js](https://github.com/video-dev/hls.js)** - Lecture des flux HLS
- **[Lucide Icons](https://lucide.dev/)** - Iconographie vectorielle
- **Google Fonts** - Rajdhani + Share Tech Mono

## Structure du projet

```
IPTV-channe/
├── index.html          # Page principale
├── server.js           # Serveur local Node.js
├── css/
│   └── style.css       # Styles complets
├── js/
│   ├── app.js          # Logique principale
│   ├── parser.js       # Parseur M3U
│   ├── player.js       # Lecteur video
│   ├── nav.js          # Navigation 2D spatiale
│   ├── i18n.js         # Internationalisation
│   └── storage.js      # Stockage local
└── README.md
```

---

## Licence

Ce projet est libre d'utilisation. Les playlists M3U integrees proviennent d'[iptv-org/iptv](https://github.com/iptv-org/iptv) et sont sous licence [Unlicense](http://unlicense.org/) / domaine public.

*Developpe avec passion pour une experience IPTV sans compromis.*