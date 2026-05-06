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
        // Extract tags using a reliable regex
        const getTag = (tag) => {
          const m = line.match(new RegExp(tag + '="([^"]*)"', 'i'));
          return m ? m[1].trim() : '';
        };

        // Name is after the last comma
        const commaIdx = line.lastIndexOf(',');
        const name = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : 'Unnamed';

        meta = {
          name:  name || 'Unnamed',
          group: getTag('group-title') || getTag('tvg-group') || 'General',
          logo:  getTag('tvg-logo')   || getTag('logo')       || '',
          id:    getTag('tvg-id')     || getTag('tvg-name')   || '',
        };
      } else if (line.startsWith('#EXTVLCOPT') || line.startsWith('#EXTGRP')) {
        // Skip VLC options but grab group if present
        if (line.startsWith('#EXTGRP:') && meta) {
          meta.group = line.slice(8).trim() || meta.group;
        }
      } else if (!line.startsWith('#')) {
        // This is a URL line
        if (meta) {
          channels.push({ ...meta, url: line });
          meta = null;
        } else {
          // URL without preceding EXTINF — add with minimal info
          channels.push({
            name:  line.split('/').pop().split('?')[0] || 'Stream',
            group: 'General',
            logo:  '',
            id:    '',
            url:   line,
          });
        }
      }
    }

    return channels;
  }
};
