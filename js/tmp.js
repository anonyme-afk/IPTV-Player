/* ══════════════════════════════════════════
   FAMELACK — CHARGEMENT DYNAMIQUE PAYS
══════════════════════════════════════════ */
let _famelackCountriesLoaded = false;

async function loadFamelackCountriesTab() {
  if (_famelackCountriesLoaded) return;
  const grid = document.getElementById('presets-grid-countries');
  if (!grid) return;

  grid.innerHTML = '<div class="preset-loading"><i data-lucide="loader" class="spin"></i> Chargement des pays...</div>';
  if (window.lucide) lucide.createIcons({ nodes: [grid] });

  try {
    // Tentative 1 : index famelack via GitHub API
    let countries = [];
    try {
      countries = await Parser.fetchFamelackCountries();
    } catch(e) {
      console.warn('[Famelack] GitHub API echouee, fallback iptv-org', e);
    }

    // Construction de la grille : famelack en premier, puis complement iptv-org
    const famelackCodes = new Set(countries.map(c => c.code));
    const iptvOrgExtra  = IPTV_ORG_COUNTRIES.filter(c => !famelackCodes.has(c.code));

    let html = '';

    // Section famelack (streams valides)
    if (countries.length) {
      html += '<div class="preset-section-title">Sources validees (famelack)</div>';
      html += countries.map(c => presetBtnHtml({
        icon:      'globe',
        label:     `${c.flag} ${c.name}`,
        sub:       c.code,
        css:       'preset-btn--validated',
        onclick:   `App.loadFamelackSource('${c.url}','${escHtml(c.flag + ' ' + c.name)}')`
      })).join('');
    }

    // Section iptv-org par continent
    const byContinent = groupByContinent(iptvOrgExtra);
    for (const [continent, list] of Object.entries(byContinent)) {
      html += `<div class="continent-sep">${continent}</div>`;
      html += list.map(c => presetBtnHtml({
        icon:    'tv',
        label:   `${c.flag} ${c.name}`,
        sub:     c.code,
        onclick: `App.usePreset('${c.url}','${escHtml(c.name)}')`
      })).join('');
    }

    grid.innerHTML = html;
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
    _famelackCountriesLoaded = true;

  } catch(e) {
    grid.innerHTML = `<div class="preset-error">
      <i data-lucide="alert-triangle"></i> Erreur : ${e.message}
    </div>`;
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
  }
}

/* ══════════════════════════════════════════
   FAMELACK — CHARGEMENT DYNAMIQUE CATEGORIES
══════════════════════════════════════════ */
let _famelackCategoriesLoaded = false;

async function loadFamelackCategoriesTab() {
  if (_famelackCategoriesLoaded) return;
  const grid = document.getElementById('presets-grid-categories');
  if (!grid) return;

  grid.innerHTML = '<div class="preset-loading"><i data-lucide="loader" class="spin"></i> Chargement...</div>';
  if (window.lucide) lucide.createIcons({ nodes: [grid] });

  try {
    const cats = await Parser.fetchFamelackCategories();

    // Icones par categorie
    const CAT_ICONS = {
      news:'newspaper', sport:'trophy', sports:'trophy', music:'music',
      entertainment:'tv-2', kids:'baby', children:'baby',
      documentary:'film', movies:'clapperboard', films:'clapperboard',
      cooking:'utensils', food:'utensils', travel:'map-pin',
      weather:'cloud', religion:'heart', relax:'sun',
      business:'briefcase', science:'flask-conical', health:'heart-pulse',
      education:'graduation-cap', radio:'radio', general:'layout-grid'
    };

    let html = '<div class="preset-section-title">Categories famelack (validees)</div>';
    html += cats.map(c => {
      const icon = CAT_ICONS[c.slug.toLowerCase()] || 'tv';
      return presetBtnHtml({
        icon,
        label:   c.name,
        sub:     'famelack',
        css:     'preset-btn--validated',
        onclick: `App.loadFamelackSource('${c.url}','${escHtml(c.name)}')`
      });
    }).join('');

    // Complement : categories iptv-org
    html += '<div class="preset-section-title">Categories iptv-org</div>';
    html += IPTV_ORG_CATEGORIES.map(c => presetBtnHtml({
      icon:    CAT_ICONS[c.slug] || 'tv',
      label:   c.name,
      sub:     'iptv-org',
      onclick: `App.usePreset('${c.url}','${escHtml(c.name)}')`
    })).join('');

    grid.innerHTML = html;
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
    _famelackCategoriesLoaded = true;

  } catch(e) {
    // Fallback : categories iptv-org uniquement
    const CAT_ICONS = {
      news:'newspaper', sports:'trophy', music:'music',
      entertainment:'tv-2', kids:'baby', documentary:'film',
      movies:'clapperboard', cooking:'utensils', travel:'map-pin',
      weather:'cloud', business:'briefcase', education:'graduation-cap',
      religion:'heart', general:'layout-grid'
    };
    let html = '<div class="preset-section-title">Categories iptv-org</div>';
    html += IPTV_ORG_CATEGORIES.map(c => presetBtnHtml({
      icon:    CAT_ICONS[c.slug] || 'tv',
      label:   c.name,
      sub:     'iptv-org',
      onclick: `App.usePreset('${c.url}','${escHtml(c.name)}')`
    })).join('');
    grid.innerHTML = html;
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
    _famelackCategoriesLoaded = true;
  }
}

/* Charger une source famelack JSON */
App.loadFamelackSource = async function(url, label) {
  const bg = document.getElementById('modal-bg');
  if (bg) bg.hidden = true;
  App.showStatus('loading', `Chargement : ${label}...`);
  App.showProgress(0, `Connexion a famelack...`);
  try {
    App.showProgress(30, 'Telechargement...');
    const channels = await Parser.fetchFamelack(url);
    App.showProgress(80, 'Traitement...');
    await App._loadChannels(channels, label);
  } catch(e) {
    App.showStatus('error', `Erreur : ${e.message}`);
    App.hideProgress();
  }
};

/* Helper : genere le HTML d'un bouton preset */
function presetBtnHtml({ icon, label, sub, css = '', onclick }) {
  return `<button class="preset-btn ${css}" onclick="${onclick}">
    <i data-lucide="${icon}"></i>
    <span>${escHtml(label)}</span>
    ${sub ? `<small>${escHtml(sub)}</small>` : ''}
  </button>`;
}

/* Regroupe les pays par continent */
function groupByContinent(countries) {
  const CONTINENTS = {
    EU: ['AD','AL','AT','BA','BE','BG','BY','CH','CY','CZ','DE','DK','EE','ES','FI',
         'FR','GB','GR','HR','HU','IE','IS','IT','LI','LT','LU','LV','MC','MD','ME',
         'MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SK','SM','TR','UA',
         'VA','XK'],
    AF: ['AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','DZ','EG','EH',
         'ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','LY','MA','MG',
         'ML','MR','MU','MW','MZ','NA','NE','NG','RW','SC','SD','SL','SN','SO','SS',
         'ST','SZ','TD','TG','TN','TZ','UG','ZA','ZM','ZW'],
    AS: ['AE','AF','AM','AZ','BD','BH','BN','BT','CN','CY','GE','ID','IL','IN','IQ',
         'IR','JP','JO','KG','KH','KP','KR','KW','KZ','LA','LB','LK','MM','MN','MY',
         'NP','OM','PH','PK','PS','QA','SA','SG','SY','TH','TJ','TL','TM','TW',
         'UZ','VN','YE'],
    AM: ['AG','AR','BB','BO','BR','BS','BZ','CA','CL','CO','CR','CU','DM','DO','EC',
         'GD','GT','GY','HN','HT','JM','KN','LC','MX','NI','PA','PE','PY','SR',
         'SV','TT','US','UY','VC','VE'],
    OC: ['AU','FJ','FM','KI','MH','NR','NZ','PG','PW','SB','TO','TV','VU','WS'],
    ME: ['AE','BH','IQ','IL','IR','JO','KW','LB','OM','PS','QA','SA','SY','TR','YE']
  };
  const LABELS = {
    EU:'Europe', AF:'Afrique', AS:'Asie', AM:'Ameriques', OC:'Oceanie', ME:'Moyen-Orient'
  };

  const result = {};
  const placed = new Set();

  // Moyen-Orient en premier pour les pays arabes
  for (const [cont, codes] of Object.entries(CONTINENTS)) {
    const label = LABELS[cont];
    const list  = countries.filter(c => codes.includes(c.code) && !placed.has(c.code));
    if (list.length) {
      result[label] = list;
      list.forEach(c => placed.add(c.code));
    }
  }

  // Reste non classe
  const rest = countries.filter(c => !placed.has(c.code));
  if (rest.length) result['Autres'] = rest;

  return result;
}

let _staticTabsInitialized = false;

function initStaticTabs() {
  if (_staticTabsInitialized) return;
  _staticTabsInitialized = true;

  // --- ONG. POPULAIRES ---
  const gridPop = document.getElementById('presets-grid');
  if (gridPop) {
    gridPop.innerHTML = POPULAR_SOURCES.map(s => presetBtnHtml({
      icon:    s.icon,
      label:   s.label,
      sub:     s.sub,
      css:     s.css,
      onclick: `App.usePreset('${s.url}','${escHtml(s.label)}')`
    })).join('');
    if (window.lucide) lucide.createIcons({ nodes: [gridPop] });
  }

  // --- ONG. LANGUES ---
  const gridLang = document.getElementById('presets-grid-languages');
  if (gridLang) {
    gridLang.innerHTML =
      '<div class="preset-section-title">Langues iptv-org</div>' +
      IPTV_ORG_LANGUAGES.map(l => presetBtnHtml({
        icon:    'languages',
        label:   `${l.flag} ${l.name}`,
        sub:     l.code,
        onclick: `App.usePreset('${l.url}','${escHtml(l.name)}')`
      })).join('');
    if (window.lucide) lucide.createIcons({ nodes: [gridLang] });
  }

  // --- ONG. REGIONS ---
  const gridReg = document.getElementById('presets-grid-regions');
  if (gridReg) {
    gridReg.innerHTML =
      '<div class="preset-section-title">Regions iptv-org</div>' +
      IPTV_ORG_REGIONS.map(r => presetBtnHtml({
        icon:    'map',
        label:   r.name,
        sub:     r.code,
        onclick: `App.usePreset('${r.url}','${escHtml(r.name)}')`
      })).join('');
    if (window.lucide) lucide.createIcons({ nodes: [gridReg] });
  }

  // Declencher aussi les onglets dynamiques
  loadFamelackCountriesTab();
  loadFamelackCategoriesTab();
}
