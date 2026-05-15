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
        let name = '';
        const cleaned = line.replace(/[\w-]+="(?:[^"\\]|\\.)*"/g, '').trim();
        const commaIdx = cleaned.lastIndexOf(',');
        if (commaIdx !== -1) {
          name = cleaned.slice(commaIdx + 1).trim().replace(/^"|"$/g, '').trim();
        }
        if (!name) name = 'Unnamed';

        meta = {
          name: name,
          group: tags['group-title'] || tags['tvg-group'] || 'General',
          logo: tags['tvg-logo'] || tags['logo'] || '',
          id: tags['tvg-id'] || tags['tvg-name'] || '',
        };
      } else if (line.startsWith('#EXTVLCOPT') || line.startsWith('#EXTGRP')) {
        // Skip VLC options but grab group if present
        if (line.startsWith('#EXTGRP:') && meta) {
          meta.group = line.slice(8).trim() || meta.group;
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
  }
};
