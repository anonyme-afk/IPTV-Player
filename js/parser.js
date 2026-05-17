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

        meta = {
          name: name,
          group: group,
          logo: tags['tvg-logo'] || tags['logo'] || '',
          id: tags['tvg-id'] || tags['tvg-name'] || '',
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
    return url.includes('famelack') ||
           url.includes('raw.githubusercontent.com') && url.endsWith('.json');
  },

  /**
   * Parse un JSON famelack (format channel list)
   * Structure attendue : tableau de { name, url, logo, group, languages, country, ... }
   * ou objet { channels: [...] }
   */
  parseJSON(json) {
    let raw = [];
    if (Array.isArray(json)) {
      raw = json;
    } else if (json.channels && Array.isArray(json.channels)) {
      raw = json.channels;
    } else if (typeof json === 'object') {
      // Chercher le premier tableau dans l'objet
      for (const key of Object.keys(json)) {
        if (Array.isArray(json[key])) { raw = json[key]; break; }
      }
    }

    return raw
      .filter(ch => ch && (ch.url || ch.stream_url || ch.stream))
      .map((ch, i) => ({
        name:     ch.name || ch.channel_name || `Channel ${i + 1}`,
        url:      ch.url  || ch.stream_url   || ch.stream,
        logo:     ch.logo || ch.logo_url     || ch.icon || '',
        group:    ch.group || ch.category    || ch.type || 'General',
        id:       ch.id   || ch.tvg_id       || '',
        country:  ch.country || '',
        language: (ch.languages || ch.language || [''])[0] || '',
        is_radio: !!(ch.is_radio || ch.radio || (ch.type || '').toLowerCase().includes('radio'))
      }));
  },

  /**
   * Charge un fichier JSON famelack depuis une URL et retourne les chaines parsees
   * Gere le cas ou le fichier contient une seule chaine ou un tableau
   */
  async fetchFamelack(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    const json = await res.json();
    return Parser.parseJSON(json);
  },

  /**
   * Charge la liste des pays disponibles dans famelack-data
   * Format retourne : [{ code, name, flag, url }]
   */
  async fetchFamelackCountries() {
    // Index des pays disponibles dans famelack
    // Source : https://github.com/famelack/famelack-data/tree/main/tv/raw/countries
    const INDEX_URL = 'https://api.github.com/repos/famelack/famelack-data/contents/tv/raw/countries';
    const res = await fetch(INDEX_URL);
    if (!res.ok) throw new Error(`GitHub API : HTTP ${res.status}`);
    const files = await res.json();
    return files
      .filter(f => f.name.endsWith('.json'))
      .map(f => {
        const code = f.name.replace('.json', '').toUpperCase();
        return {
          code,
          name: COUNTRY_NAMES[code] || code,
          flag: codeToFlag(code),
          url:  f.download_url
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  },

  /**
   * Charge la liste des categories disponibles dans famelack-data
   */
  async fetchFamelackCategories() {
    const INDEX_URL = 'https://api.github.com/repos/famelack/famelack-data/contents/tv/raw/categories';
    const res = await fetch(INDEX_URL);
    if (!res.ok) throw new Error(`GitHub API : HTTP ${res.status}`);
    const files = await res.json();
    return files
      .filter(f => f.name.endsWith('.json'))
      .map(f => ({
        slug: f.name.replace('.json', ''),
        name: slugToLabel(f.name.replace('.json', '')),
        url:  f.download_url
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
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
