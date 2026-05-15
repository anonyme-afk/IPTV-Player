# 📺 IPTV Player — Lecteur de playlists M3U

Une application web moderne, rapide et élégante pour lire des playlists IPTV (M3U/M3U8). Conçue pour fonctionner partout : du smartphone à la Smart TV, en passant par le desktop et la tablette.

> **Remerciements spéciaux** : Les playlists intégrées proviennent du projet **[iptv-org/iptv](https://github.com/iptv-org/iptv)** qui maintient la plus grande collection mondiale de chaînes IPTV publiques. Un grand merci à eux pour leur travail colossal ! 🙏

---

## ✨ Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| **📺 Playlists M3U** | Charge depuis URL, fichier local ou texte brut |
| **🎮 Navigation 2D TV** | Pilotable au clavier, à la manette (Gamepad API) ou à la télécommande virtuelle |
| **🌍 i18n** | Interface en français, anglais, espagnol, allemand, arabe, portugais |
| **📱 Responsive** | Smartphone, tablette, desktop, TV 4K (1920px+) |
| **🎯 Presets intégrés** | 80+ playlists iptv-org en 1 clic (catégories, pays, langues, régions) |
| **💾 Persistance** | Dernière playlist, favoris et historique sauvegardés automatiquement |
| **🔍 Recherche** | Filtre instantané par nom ou catégorie |
| **🔄 Proxy CORS** | 5 proxys de secours pour les playlists et les flux |
| **🔊 Son de focus** | Feedback audio subtil sur la navigation |
| **🎮 Télécommande tactile** | D-Pad virtuel (touche `R` ou 3 doigts) |

---

## 🚀 Utilisation rapide

### Option 1 — Serveur local (recommandé)

```bash
# Cloner le dépôt
git clone https://github.com/anonyme-afk/IPTV-channe.git
cd IPTV-channe

# Lancer le serveur (nécessite Node.js)
node server.js

# Ouvrir dans le navigateur
http://localhost:8080
```

### Option 2 — Sans serveur (limité)

Ouvrir `index.html` dans un navigateur.  
⚠️ **Attention** : depuis `file://`, les requêtes fetch vers des URLs externes sont bloquées.  
→ Utilise plutôt le serveur local.

---

## 🎮 Navigation

| Touche | Action |
|--------|--------|
| `↑ ↓ ← →` | Navigation 2D entre les éléments |
| `Enter` / `␣` | Sélectionner / Lire |
| `Esc` / `⌫` | Fermer / Retour |
| `F` | Plein écran |
| `M` | Muet |
| `R` | Télécommande tactile |
| `Pg↑` / `Pg↓` | Chaîne précédente / suivante |
| `Home` | Premier élément |
| `Tab` | Élément suivant |
| `?` | Aide |
| `D` | Mode debug (console) |

### Manette de jeu / Télécommande TV

Le support Gamepad API est automatique : branche une manette et utilise le D-Pad ou le stick gauche.

---

## 📦 Playlists intégrées

Toutes les playlists proviennent d'**[iptv-org/iptv](https://github.com/iptv-org/iptv)** (licence : domaine public / UFL-1.0).

| Onglet | Contenu |
|--------|---------|
| **Populaires** | Tout IPTV-org, index, France, USA, UK, Français |
| **Catégories** | News (940), Sports (332), Films (415), Éducation, Science, Cuisine… |
| **Pays** | France, Belgique, Suisse, Canada, USA, Maroc, Algérie, Tunisie… |
| **Langues** | Français (422), Anglais (2314), Espagnol (1700), Arabe, Russe… |
| **Régions** | Europe, Asie, Afrique, Amériques, Océanie, Balkans… |

---

## 🛠️ Technologies

- **HTML5 / CSS3** — Variables CSS, Grid, Flexbox, backdrop-filter
- **Vanilla JavaScript** (ES6+) — Aucune dépendance lourde
- **[Hls.js](https://github.com/video-dev/hls.js)** — Lecture des flux HLS
- **[Lucide Icons](https://lucide.dev/)** — Iconographie vectorielle
- **Google Fonts** — Rajdhani + Share Tech Mono

## 📂 Structure du projet

```
📁 IPTV-channe/
├── index.html          # Page principale
├── server.js           # Serveur local Node.js
├── css/
│   └── style.css       # Styles complets
├── js/
│   ├── app.js          # Logique principale
│   ├── parser.js       # Parseur M3U
│   ├── player.js       # Lecteur vidéo
│   ├── nav.js          # Navigation 2D spatiale
│   ├── i18n.js         # Internationalisation
│   └── storage.js      # Stockage local
└── README.md
```

---

## 📝 Licence

Ce projet est libre d'utilisation. Les playlists M3U intégrées proviennent d'[iptv-org/iptv](https://github.com/iptv-org/iptv) et sont sous licence [Unlicense](http://unlicense.org/) / domaine public.

*Développé avec ❤️ pour une expérience IPTV sans compromis.*