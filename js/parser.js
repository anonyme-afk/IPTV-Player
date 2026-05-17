// ── LOGO RESOLVER ──
const LogoResolver = {
  /**
   * Tente de resoudre un logo si manquant
   */
  resolve(name, id) {
    if (!name && !id) return '';
    const cleanName = (name || '').trim();
    if (!cleanName && !id) return '';

    // 1. iptv-org assets (fiable)
    if (id && !id.includes(' ')) {
      return `https://iptv-org.github.io/vi-assets/images/channels/${id.toLowerCase()}.png`;
    }

    // 2. fanmingming assets (populaire pour chaines chinoises et mondiales)
    const slug = cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    if (slug) {
      // On prefere retourner une URL probable
      return `https://raw.githubusercontent.com/fanmingming/live/main/tv/logo/${cleanName}.png`;
    }

    return '';
  },

  /**
   * Fallbacks additionnels pour les images cassees (utilises par onerror)
   */
  getFallback(name, id, attempt = 1) {
    const cleanName = (name || '').trim();
    
    if (attempt === 1) {
      // Tenter picons
      return `https://raw.githubusercontent.com/picons/picons/master/build-source/logos/${cleanName.toLowerCase()}.png`;
    }
    if (attempt === 2) {
      // Tenter iptv-pro
      return `https://iptv-pro.github.io/logos/${cleanName.toLowerCase()}.png`;
    }
    if (attempt === 3) {
      // Tenter LyngSat
      return `https://www.lyngsat.com/logo/${cleanName.toLowerCase().replace(/\s+/g, '')}.png`;
    }
    return '';
  }
};

// ── ROBUST M3U PARSER ──
const Parser = {
  parse(text) {
    const channels = [];
    const lines = text.split(/\r?\n/);
    let meta = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        // Extract tags using a flexible regex that handles escaped quotes too
        const getAllTags = (str) => {
          const tags = {};
          // Match all key="value" patterns, including values with escaped chars
          const tagRe = /([\w-]+)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
          let m;
          while ((m = tagRe.exec(str)) !== null) {
            tags[m[1].toLowerCase()] = m[2].replace(/\\(.)/g, '$1');
          }
          return tags;
        };

        const tags = getAllTags(line);

        // Name: strip all key="value" pairs, then take what's after the last comma
        // Also handle quoted names: #EXTINF:-1, "Name Here", http://...
        let name = 'Unnamed';
        const cleaned = line.replace(/^#EXTINF:\s*-?\d+(\.\d+)?/, '').replace(/[\w-]+="(?:[^"\\]|\\.)*"/g, '').trim();
        const commaIdx = cleaned.indexOf(',');
        if (commaIdx !== -1) {
          name = cleaned.slice(commaIdx + 1).trim();
        }
        name = name.replace(/^"|"$/g, '').trim();
        if (!name) name = 'Unnamed';

        let groupRaw = tags['group-title'] || tags['tvg-group'] || 'General';
        let group = groupRaw.split(/[;,|/]/)[0].trim();
        if (!group) group = 'General';

        const logo = tags['tvg-logo'] || tags['logo'] || '';
        const id = tags['tvg-id'] || tags['tvg-name'] || '';

        meta = {
          name: name,
          group: group,
          logo: logo || LogoResolver.resolve(name, id),
          id: id,
        };
      } else if (line.startsWith('#EXTVLCOPT') || line.startsWith('#EXTGRP')) {
        // Skip VLC options but grab group if present
        if (line.startsWith('#EXTGRP:') && meta) {
          let grp = line.slice(8).trim();
          meta.group = grp ? grp.split(/[;,|/]/)[0].trim() : meta.group;
        }
      } else if (line.startsWith('#KODIPROP') || line.startsWith('#EXTM3U')) {
        // Skip KODI properties and playlist header
        continue;
      } else if (!line.startsWith('#')) {
        // This is a URL line
        const url = line.split('|')[0].trim(); // remove potential auth params after |
        if (meta) {
          channels.push({ ...meta, url });
          meta = null;
        } else {
          // URL without preceding EXTINF — add with minimal info
          channels.push({
            name: url.split('/').pop().split('?')[0].split('.')[0] || 'Stream',
            group: 'General',
            logo: '',
            id: '',
            url: url,
          });
        }
      }
    }

    return channels;
  },

  /**
   * Detecte si une URL pointe vers un JSON famelack
   */
  isFamelackJSON(url) {
    if (!url) return false;
    const low = url.toLowerCase();
    return low.includes('famelack') ||
           low.endsWith('.json') ||
           low.includes('/ressource/') ||
           low.includes('raw.githubusercontent.com') ||
           low.includes('api.github.com');
  },

  /**
   * Parse un JSON famelack (format channel list)
   * Structure attendue : tableau de { name, url, logo, group, languages, country, ... }
   * ou objet { channels: [...] }
   */
  parseJSON(json, defaultGroup = 'General') {
    console.log('[Parser] Parsing JSON...', json);
    let raw = [];
    if (Array.isArray(json)) {
      raw = json;
    } else if (json && json.channels && Array.isArray(json.channels)) {
      raw = json.channels;
    } else if (json && typeof json === 'object') {
      // Chercher le premier tableau dans l'objet
      console.log('[Parser] JSON is object, looking for arrays...');
      for (const key of Object.keys(json)) {
        if (Array.isArray(json[key])) { 
          console.log(`[Parser] Found array at key: ${key}`);
          raw = json[key]; 
          break; 
        }
      }
    }
    
    if (!raw.length && json && json.name && (json.url || json.stream_url || (json.stream_urls && json.stream_urls.length))) {
      // Cas d'un objet unique (une seule chaine)
      console.log('[Parser] Single channel detected');
      raw = [json];
    }
    
    console.log(`[Parser] Found ${raw.length} channels`);
    
    return raw.filter(ch => {
        if (!ch) return false;
        return (ch.url || ch.stream_url || ch.stream || (ch.stream_urls && ch.stream_urls.length) || ch.link || ch.download_url);
      })
      .map((ch, i) => {
        const url = ch.url || ch.stream_url || ch.stream || (ch.stream_urls && ch.stream_urls[0]) || ch.link || ch.download_url;
        let group = ch.group || ch.category || ch.type || ch.genre || defaultGroup;
        
        // Nettoyage groupe (slug to label)
        if (group && group.length < 30) {
          group = slugToLabel(group.toString());
        }

        const logo = ch.logo || ch.logo_url || ch.icon || ch.thumbnail || '';
        const id = ch.id || ch.tvg_id || ch.nanoid || '';

        return {
          name:     ch.name || ch.channel_name || ch.label || `Channel ${i + 1}`,
          url:      url,
          logo:     logo || LogoResolver.resolve(ch.name || ch.label, id),
          group:    group,
          id:       id,
          country:  ch.country || '',
          language: (Array.isArray(ch.languages) ? ch.languages[0] : (ch.languages || ch.language || '')) || '',
          is_radio: !!(ch.is_radio || ch.radio || (ch.type || '').toLowerCase().includes('radio') || (url && url.toLowerCase().endsWith('.mp3')))
        };
      });
  },

  /**
   * Charge un fichier JSON famelack depuis une URL et retourne les chaines parsees
   * Gere le cas ou le fichier contient une seule chaine ou un tableau
   */
  async fetchFamelack(url, defaultGroup) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    const json = await res.json();
    return Parser.parseJSON(json, defaultGroup);
  },

  /**
   * Charge la liste des pays disponibles dans famelack-data
   * Format retourne : [{ code, name, flag, url }]
   */
  /**
   * Charge la liste des pays disponibles depuis le metadata local ou GitHub
   */
  async fetchFamelackCountries() {
    // Fallback GitHub Raw
    const COMMON_CODES = ['FR','US','UK','DE','IT','ES','CA','BR','MX','AR','BE','CH','DZ','MA','TN','AL','TR','PT','RU','CN','JP','KR'];
    return COMMON_CODES.map(code => ({
      code,
      name: COUNTRY_NAMES[code] || code,
      flag: codeToFlag(code),
      url: `https://raw.githubusercontent.com/famelack/famelack-data/main/tv/raw/countries/${code.toLowerCase()}.json`
    })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  },

  /**
   * Charge la liste des categories disponibles
   */
  async fetchFamelackCategories() {
    const LOCAL_CATS = [
      'all', 'animation', 'auto', 'business', 'classic', 'comedy', 'cooking', 'culture', 
      'documentary', 'education', 'entertainment', 'family', 'general', 
      'kids', 'legislative', 'lifestyle', 'movies', 'music', 'news', 
      'outdoor', 'public', 'relax', 'religious', 'science', 'series', 
      'shop', 'show', 'sports', 'travel', 'weather', 'top-news'
    ];
    
    return LOCAL_CATS.map(slug => ({
      slug,
      name: slugToLabel(slug),
      url: `https://raw.githubusercontent.com/famelack/famelack-data/main/tv/raw/categories/${slug}.json`
    })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
};

/* Convertit un code ISO en drapeau emoji */
function codeToFlag(code) {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

/* Convertit un slug categorie en label lisible */
function slugToLabel(slug) {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/* Table de noms de pays en francais */
const COUNTRY_NAMES = {
  AF:'Afghanistan', AL:'Albanie', DZ:'Algerie', AD:'Andorre', AO:'Angola',
  AG:'Antigua-et-Barbuda', AR:'Argentine', AM:'Armenie', AU:'Australie',
  AT:'Autriche', AZ:'Azerbaidjan', BS:'Bahamas', BH:'Bahrein', BD:'Bangladesh',
  BB:'Barbade', BY:'Bielorussie', BE:'Belgique', BZ:'Belize', BJ:'Benin',
  BT:'Bhoutan', BO:'Bolivie', BA:'Bosnie-Herzegovine', BW:'Botswana',
  BR:'Bresil', BN:'Brunei', BG:'Bulgarie', BF:'Burkina Faso', BI:'Burundi',
  CV:'Cap-Vert', KH:'Cambodge', CM:'Cameroun', CA:'Canada', CF:'Centrafrique',
  TD:'Tchad', CL:'Chili', CN:'Chine', CO:'Colombie', KM:'Comores',
  CG:'Congo', CD:'RD Congo', CR:'Costa Rica', CI:"Cote d'Ivoire",
  HR:'Croatie', CU:'Cuba', CY:'Chypre', CZ:'Republique tcheque',
  DK:'Danemark', DJ:'Djibouti', DM:'Dominique', DO:'Republique dominicaine',
  EC:'Equateur', EG:'Egypte', SV:'El Salvador', GQ:'Guinee equatoriale',
  ER:'Erythree', EE:'Estonie', SZ:'Eswatini', ET:'Ethiopie', FJ:'Fidji',
  FI:'Finlande', FR:'France', GA:'Gabon', GM:'Gambie', GE:'Georgie',
  DE:'Allemagne', GH:'Ghana', GR:'Grece', GD:'Grenade', GT:'Guatemala',
  GN:'Guinee', GW:'Guinee-Bissau', GY:'Guyana', HT:'Haiti', HN:'Honduras',
  HU:'Hongrie', IS:'Islande', IN:'Inde', ID:'Indonesie', IR:'Iran',
  IQ:'Irak', IE:'Irlande', IL:'Israel', IT:'Italie', JM:'Jamaique',
  JP:'Japon', JO:'Jordanie', KZ:'Kazakhstan', KE:'Kenya', KI:'Kiribati',
  KP:'Coree du Nord', KR:'Coree du Sud', KW:'Koweit', KG:'Kirghizistan',
  LA:'Laos', LV:'Lettonie', LB:'Liban', LS:'Lesotho', LR:'Liberia',
  LY:'Libye', LI:'Liechtenstein', LT:'Lituanie', LU:'Luxembourg',
  MG:'Madagascar', MW:'Malawi', MY:'Malaisie', MV:'Maldives', ML:'Mali',
  MT:'Malte', MH:'Iles Marshall', MR:'Mauritanie', MU:'Maurice',
  MX:'Mexique', FM:'Micronesie', MD:'Moldavie', MC:'Monaco', MN:'Mongolie',
  ME:'Montenegro', MA:'Maroc', MZ:'Mozambique', MM:'Myanmar', NA:'Namibie',
  NR:'Nauru', NP:'Nepal', NL:'Pays-Bas', NZ:'Nouvelle-Zelande', NI:'Nicaragua',
  NE:'Niger', NG:'Nigeria', MK:'Macedoine du Nord', NO:'Norvege', OM:'Oman',
  PK:'Pakistan', PW:'Palaos', PA:'Panama', PG:'Papouasie-Nouvelle-Guinee',
  PY:'Paraguay', PE:'Perou', PH:'Philippines', PL:'Pologne', PT:'Portugal',
  QA:'Qatar', RO:'Roumanie', RU:'Russie', RW:'Rwanda', KN:'Saint-Kitts',
  LC:'Sainte-Lucie', VC:'Saint-Vincent', WS:'Samoa', SM:'Saint-Marin',
  ST:'Sao Tome-et-Principe', SA:'Arabie saoudite', SN:'Senegal', RS:'Serbie',
  SC:'Seychelles', SL:'Sierra Leone', SG:'Singapour', SK:'Slovaquie',
  SI:'Slovenie', SB:'Iles Salomon', SO:'Somalie', ZA:'Afrique du Sud',
  SS:'Soudan du Sud', ES:'Espagne', LK:'Sri Lanka', SD:'Soudan',
  SR:'Suriname', SE:'Suede', CH:'Suisse', SY:'Syrie', TW:'Taiwan',
  TJ:'Tadjikistan', TZ:'Tanzanie', TH:'Thailande', TL:'Timor oriental',
  TG:'Togo', TO:'Tonga', TT:'Trinite-et-Tobago', TN:'Tunisie', TR:'Turquie',
  TM:'Turkmenistan', TV:'Tuvalu', UG:'Ouganda', UA:'Ukraine',
  AE:'Emirats arabes unis', GB:'Royaume-Uni', US:'Etats-Unis',
  UY:'Uruguay', UZ:'Ouzbekistan', VU:'Vanuatu', VE:'Venezuela',
  VN:'Vietnam', YE:'Yemen', ZM:'Zambie', ZW:'Zimbabwe',
  // Extras regionaux
  XK:'Kosovo', TF:'Terres australes', PS:'Palestine', EH:'Sahara occidental',
  INT:'International', UN:'Nations Unies'
};
