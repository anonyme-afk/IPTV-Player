// ── IPTV Player - Serveur local ──
// Lance avec : node server.js
// Puis ouvre http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.m3u': 'text/plain; charset=utf-8',
    '.m3u8': 'text/plain; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
    // ── SECURITY HEADERS ──
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy (CSP)
    // - Allow HLS.js from cdnjs
    // - Allow icons from unpkg
    // - Allow images from any source (for channel logos)
    // - Allow media from any source (for streams)
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src * data: blob:",
        "media-src * blob:",
        "connect-src *",
        "font-src 'self' https://fonts.gstatic.com",
        "object-src 'none'"
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlParts = req.url.split('?');
    let filePath = urlParts[0] === '/' ? '/index.html' : urlParts[0];
    filePath = path.join(ROOT, decodeURIComponent(filePath));

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404);
            res.end('404 Not Found');
            return;
        }

        const acceptEncoding = req.headers['accept-encoding'] || '';
        const headers = {
            'Content-Type': contentType,
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
        };

        // ── COMPRESSION ──
        // Special case: files in /ressource/compressed are already gzipped
        if (filePath.includes('/ressource/compressed/') && ext === '.json') {
            headers['Content-Encoding'] = 'gzip';
            res.writeHead(200, headers);
            fs.createReadStream(filePath).pipe(res);
            return;
        }

        let stream = fs.createReadStream(filePath);
        if (/\b(gzip)\b/.test(acceptEncoding) && (ext === '.js' || ext === '.css' || ext === '.html' || ext === '.json')) {
            headers['Content-Encoding'] = 'gzip';
            res.writeHead(200, headers);
            stream.pipe(zlib.createGzip()).pipe(res);
        } else {
            headers['Content-Length'] = stats.size;
            res.writeHead(200, headers);
            stream.pipe(res);
        }

        stream.on('error', () => {
            if (!res.headersSent) {
                res.writeHead(500);
                res.end('500 Internal Server Error');
            }
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║       [TV] IPTV Player Server        ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Local   : http://localhost:${PORT}     ║`);
    console.log('║                                      ║');
    console.log('║  Appuie sur Ctrl+C pour arrêter      ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
});
