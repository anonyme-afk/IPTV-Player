# CONTEXT EXPERT - IPTV Player

Ce document est destine a un expert technique pour analyse et conseils sur le projet IPTV Player.

---

## 1. PRESENTATION DU PROJET

**Nom** : IPTV Player  
**Depot** : https://github.com/anonyme-afk/IPTV-channe  
**Site** : https://anonyme-afk.github.io/IPTV-channe/  
**Langage** : Vanilla JavaScript (ES6+), HTML5, CSS3  
**Pas de framework** : Aucune dependance lourde (seulement Hls.js et Lucide Icons en CDN)

**But** : Application web pour lire des playlists IPTV (fichiers M3U/M3U8 contenant des centaines/milliers de chaines TV en streaming).

---

## 2. ARCHITECTURE DU CODE

```
IPTV-channe/
├── index.html          # Page principale (structure HTML)
├── server.js           # Serveur local Node.js (port 8080)
├── sw.js               # Service Worker PWA (cache offline)
├── manifest.json       # Manifest PWA (installation ecran accueil)
├── assets/
│   └── favicon.ico     # Icone du site
├── css/
│   └── style.css       # Styles complets (~1100 lignes)
├── js/
│   ├── app.js          # Logique principale + etat + rendu liste + fetch proxys
│   ├── parser.js       # Parseur M3U (text -> array of channels)
│   ├── player.js       # Lecteur video (HLS + native) avec gestion d'erreurs
│   ├── nav.js          # Navigation spatiale 2D (TV/Keyboard/Gamepad)
│   ├── i18n.js         # Internationalisation (6 langues)
│   └── storage.js      # Wrapper localStorage (favoris, historique, session)
├── README.md
└── CONTEXT_EXPERT.md   # Ce document
```

### Structure des donnees (channels)

Chaque chaine est un objet :
```js
{
  name: "TF1",
  group: "France",
  logo: "https://example.com/logo.png",
  id: "tf1.fr",
  url: "https://stream.example.com/tf1.m3u8"
}
```

Les chaines sont stockees dans `App.state.channels` (array).  
Les chaines filtrees (recherche, categorie, favoris) dans `App.state.filtered`.

---

## 3. CE QUI A ETE FAIT / CORRIGE

### Parser M3U (js/parser.js)
- Parse les tags `#EXTINF:` avec regex flexible
- Gere les guillemets echappes `\"...\"`
- Gere les noms avec virgules (extraction apres la derniere virgule)
- Gere les URLs avec parametres d'auth `|`
- Saute `#KODIPROP`, `#EXTM3U`, `#EXTVLCOPT`
- Fallback si URL sans EXTINF : nomme a partir du nom de fichier

### Player video (js/player.js v3)
- **Timeout 20s** avec 2 tentatives automatiques avant abandon
- **Buffer reduit** pour appareils peu puissants : `maxBufferLength: 15`, `backbufferLength: 30`
- **capLevelToPlayerSize: true** : decode seulement la resolution necessaire a l'ecran
- **Detection de stall** : si le flux se fige >8s, tentative de recovery
- **Nettoyage memoire** complet entre chaque chaine : `hls.stopLoad()`, `vid.srcObject = null`, `vid.load()`
- **Proxys CORS** pour flux : direct -> corsproxy.io -> corsproxy.org -> thingproxy.freeboard.io
- **HLS Worker desactive sur mobile** (iOS/Android plantent parfois avec Worker)
- `preload='none'`, `autoplay=false`
- `requestAnimationFrame` pour chargement natif

### Navigation 2D TV (js/nav.js v2)
- Algorithme nearest-neighbor avec detection de colonne/ligne (overlap check)
- Wrap-around aux bords de l'ecran
- Fallback `_findClosestAny` si rien trouve
- Gamepad API : D-Pad, stick gauche, boutons A/B/Start/LB/RB
- Telecommande tactile : touche `R` ou 3 doigts
- Cache des elements navigables (invalide sur mutation DOM)
- Throttle 120fps
- Son de focus (AudioContext)
- Aide interactive avec `?`
- MutationObserver pour refocus apres mise a jour du DOM

### PWA
- Service Worker (`sw.js`) : cache les assets, strategy network-first
- Manifest (`manifest.json`) : installation sur ecran d'accueil
- Meta tags iOS : `apple-mobile-web-app-capable`
- Enregistrement SW uniquement en HTTPS

### Optimisations generales
- Detection appareil lent : `navigator.deviceMemory`, `navigator.hardwareConcurrency`, userAgent mobile
- `requestIdleCallback` pour initialisation non critique
- Hardware acceleration CSS : `will-change`, `translateZ(0)`, `backface-visibility`
- `content-visibility: auto` + `contain` sur la liste des chaines
- try/catch partout pour ne pas bloquer le rendu
- `loading='lazy'` sur les logos

### Interface
- 80+ playlists iptv-org en 5 onglets (Populaires, Categories, Pays, Langues, Regions)
- Responsive : TV 4K, desktop, tablette, mobile
- 6 langues : francais, anglais, espagnol, allemand, arabe, portugais

---

## 4. PROBLEMES RESTANTS (A SOUMETTRE A L'EXPERT)

### 4.1 FREEZES lors de la lecture (BUG CRITIQUE)

**Symptome** : Quand on clique sur une chaine, parfois :
- Le flux se lance puis freeze apres ~10-30 secondes
- La video devient noire, le son continue ou s'arrete aussi
- L'interface reste responsive mais la video est figee
- Parfois l'icone "LIVE" clignote

**Causes possibles identifiees** :
1. **Buffer overflow** : certain flux HLS envoient des segments trop gros pour le buffer limite
2. **Changement de qualite** : HLS change de niveau automatiquement et le buffer se corrompt
3. **Codec incompatible** : certains flux utilisent AAC non supporte par le navigateur
4. **Stall non detecte** : le serveur arrete d'envoyer des segments mais la connexion est encore "ouverte"

**Question a l'expert** :
- Comment detecter proprement un stall reseau vs un stall buffer ?
- Faut-il implementer un heartbeat (ping regulier) pour verifier si le flux est vivant ?
- Hls.js a-t-il un mode "low-latency" plus stable pour les flux IPTV ?
- Y a-t-il une meilleure facon de gerer le changement de qualite sans freeze ?

### 4.2 PERFORMANCE LISTE 100k+ chaines

**Symptome** : La playlist principale (index.m3u) contient >100 000 chaines. Au chargement :
- `Parser.parse()` bloque le thread principal pendant ~2-3 secondes sur desktop, jusqu'a 10s sur mobile
- `renderList()` genere 100 000 elements HTML -> freeze de 1-2s
- La barre de recherche devient lente (re-filtre 100k elements a chaque frappe)
- Memoire utilisee par les 100 000 objets JS ~50-80 MB

**Solutions envisagees** :
1. **Virtual scrolling** : ne render que les elements visibles (30-50 au lieu de 100k). Il faudrait recrire `renderList` pour utiliser un conteneur avec hauteur fixe et position absolue des elements
2. **Web Worker pour le parsing** : deja commence mais pas finalise (voir section 4.3)
3. **Debounce / Throttle sur la recherche** : attendre 200ms avant de filtrer
4. **Pagination** : limiter a 500 chaines par page avec navigation

**Question a l'expert** :
- Faut-il implementer du virtual scrolling pur (position absolue) ou utiliser un Intersection Observer avec recycling des elements DOM ?
- Quelle lib recommandez-vous pour le virtual scroll en Vanilla JS ? (ou preferez-vous une implementation custom ?)
- `content-visibility: auto` suffit-il ou faut-il vraiment du DOM recycling ?
- Est-ce que `requestAnimationFrame` + chunking pourrait suffire pour le parsing sans Worker ?

### 4.3 WEB WORKER POUR LE PARSING (non finalise)

J'ai commence a creer un parser-worker.js mais je ne l'ai pas finalise car le transfert des donnees entre le Worker et le thread principal pose probleme :
- `Parser.parse(text)` renvoie un array de 100k objets
- Le cout de serialisation/deserialisation (postMessage) est presque aussi long que le parsing lui-meme
- Les Workers n'ont pas acces au DOM donc `renderList()` doit rester dans le thread principal

**Question a l'expert** :
- Est-ce que le Web Worker apporte un reel gain vu le cout de postMessage ?
- Strategie : parser en chunks dans le Worker et envoyer les resultats par lots de 1000 ?
- Ou : faire le parsing dans le thread principal mais en plusieurs fois avec `requestIdleCallback` ?
- Ou : utiliser `Transferable objects` (ArrayBuffer) pour eviter la copie ?

### 4.4 CORS / PROXY

**Symptome** : Les flux M3U8 externes sont bloques par CORS. On utilise des proxys publics :
1. Direct (l'URL elle-meme)
2. corsproxy.io
3. corsproxy.org
4. thingproxy.freeboard.io

**Problemes connus** :
- Les proxys publics sont lents (ajoutent 200-500ms de latence)
- Ils ont des limites de bande passante
- Certains flux sont en HTTP et les proxys en HTTPS cassent le melange de contenu
- Allorigins.win et cors-anywhere.herokuapp.com sont morts (supprimes)

**Question a l'expert** :
- Quelle est la meilleure strategie proxy pour un lecteur IPTV en 2026 ?
- Faut-il un proxy backend dedie (personnel) ? Si oui, quelle stack (Node.js, Nginx, Cloudflare Worker) ?
- Existe-t-il un service de proxy CORS fiable et gratuit encore actif ?
- Est-ce que l'utilisation de WebRTC ou d'un tunnel pourrait contourner CORS sans proxy ?

### 4.5 GESTION D'ERREURS FLUX

Actuellement, si un flux ne charge pas :
1. Timeout 20s -> tentative avec proxy suivant
2. Si tous les proxys echouent -> message "Flux indisponible"

**Symptome** : L'utilisateur attend 20s par proxy, soit jusqu'a 80s pour savoir qu'un flux est mort.

**Question a l'expert** :
- Est-ce qu'on peut reduire le timeout a 5s pour les proxys (on sait qu'ils sont plus lents que le direct) ?
- Faut-il implementer un pre-check (HEAD request) avant de lancer le flux ?
- Comment detecter rapidement un flux mort (HTTP 404, 403, connection refused) sans attendre le timeout ?
- Faut-il implementer du fallback auto vers une chaine similaire (meme groupe) si la chaine courante est morte ?

### 4.6 HLS CONFIGURATION

Configuration HLS.js actuelle :
```js
{
  enableWorker: !isMobile,
  lowLatencyMode: false,
  backbufferLength: 30,
  maxBufferLength: 15,
  maxMaxBufferLength: 20,
  maxBufferSize: 30 * 1000 * 1000,
  maxBufferHole: 0.5,
  fragLoadingMaxRetry: 2,
  manifestLoadingMaxRetry: 2,
  levelLoadingMaxRetry: 1,
  fragLoadingRetryDelay: 1000,
  fragLoadingTimeOut: 10000,
  startLevel: -1,
  capLevelToPlayerSize: true,
}
```

**Question a l'expert** :
- Ces valeurs sont-elles optimales pour des flux IPTV (souvent du 720p/1080p a ~2-5 Mbps) ?
- `backbufferLength: 30` : 30 secondes dans le buffer arriere, est-ce trop ?
- `maxBufferHole: 0.5` : 500ms de trou, est-ce suffisant ?
- `capLevelToPlayerSize: true` : sur un petit ecran (mobile 360px), est-ce que ca telecharge vraiment la qualite la plus basse ?
- Faut-il forcer `startLevel: 0` (qualite la plus basse) sur les appareils lents plutot que `-1` (auto) ?

### 4.7 NAVIGATION 2D TV

**Probleme potentiel** : Quand la liste des chaines est grande (100k elements), la navigation au clavier devient lente car `getElements()` scanne tous les [data-nav] elements.

**Question a l'expert** :
- Faut-il limiter le focus aux seuls elements visibles dans le viewport ?
- Dans `getElements()`, le `getBoundingClientRect()` est appele sur chaque element. Est-ce un bottleneck ?
- Alternative : utiliser un cache spatial (grid coordinate mapping) plutot que de recalculer a chaque fleche ?

### 4.8 RESPONSIVE MOBILE

**Symptome** : Sur mobile (surtout iOS Safari) :
- Le `backdrop-filter: blur()` degrade les performances (rendu saccade)
- La video HTML5 ne passe pas automatiquement en plein ecran
- Le clavier virtuel pousse la mise en page lors de la recherche

**Question a l'expert** :
- `backdrop-filter: blur()` est connu pour etre lent sur Safari. Faut-il le desactiver sur mobile ?
- Existe-t-il une API pour detecter la faiblesse GPU et desactiver les effets visuels lourds ?
- Pour iOS, comment forcer l'enterprise en fullscreen quand l'utilisateur clique sur une chaine ?
- Comment gerer le clavier virtuel sans casser la mise en page ?

---

## 5. QUESTIONS TECHNIQUES GENERALES

### 5.1 Architecture
- L'architecture actuelle (tout en Vanilla JS, pas de framework) est-elle adaptee a ce type d'application (lecteur video + liste 100k items) ?
- Si on devait passer a un framework (React/Vue/Svelte), quel serait le plus adapte et pourquoi ?
- Le pattern module (IIFE) pour chaque fichier est-il encore adapte ou faudrait-il passer aux ES modules (import/export) ?

### 5.2 Performance
- Comment profiler efficacement les freezes video (ce ne sont pas des freezes JS mais des freezes de rendu media) ?
- Y a-t-il des outils specifiques pour debugger Hls.js (logging, statistiques, timeline) ?
- Comment mesurer le FPS reel de la video (pas celui de l'interface) ?
- `performance.now()` + `requestVideoFrameCallback` ? (API recente)

### 5.3 Securite
- Les proxys publics voient les URLs des flux. Est-ce un probleme de vie privee ?
- Un flux IPTV peut-il injecter du contenu malveillant via HLS (XSS dans les segments ?) ?
- Le localStorage pour les favoris/historique est-il suffisant ou faudrait-il IndexedDB ?

### 5.4 Compatibilite
- Quelle est la liste minimale de navigateurs a supporter ?
- Y a-t-il des regressions connues de Hls.js sur certains navigateurs/versions ?
- Le Service Worker pose-t-il des problemes avec GitHub Pages (pas de HTTPS custom, pas de controle des headers) ?

---

## 6. FONCTIONNALITES SOUHAITEES (ROADMAP)

Si l'expert valide la direction technique, voici les prochaines fonctionnalites envisagees :

1. **Virtual scrolling** pour les listes de 100k+ chaines
2. **EPG** (Electronic Program Guide) - afficher le programme TV des chaines
3. **Timeshift** - pouvoir mettre en pause/reprendre le direct
4. **Recherche vocale** (Web Speech API)
5. **Partage de playlist** (generer un lien avec les chaines favorites)
6. **Edition de playlist** (supprimer, reordonner les chaines)
7. **Support DASH** en plus de HLS (dash.js)
8. **Cache des logos** (les logos des chaines sont re-telecharges a chaque fois)
9. **Screenshot** de la video en cours
10. **Mode picture-in-picture**

---

## 7. CONTACT

Projet cree par https://github.com/anonyme-afk  
Playlists fournies par https://github.com/iptv-org/iptv

Merci a l'expert pour son analyse et ses conseils !