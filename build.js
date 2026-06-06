// build.js — copia archivos fuente → www/ con minificación básica
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const WWW  = path.join(ROOT, 'www');

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

// ── Minificación CSS ──────────────────────────────────────────────────────
// Elimina comentarios, colapsa espacios y saltos redundantes.
// No modifica valores de strings ni URLs.
function minifyCSS(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')       // eliminar /* comentarios */
    .replace(/[ \t]*\n[ \t]*/g, '\n')       // trim espacios alrededor de saltos
    .replace(/\n{2,}/g, '\n')               // colapsar líneas vacías
    .replace(/[ \t]+/g, ' ')                // colapsar espacios múltiples en una línea
    .replace(/\s*\{\s*/g, '{')              // sin espacio alrededor de {
    .replace(/\s*}\s*/g, '}')              // sin espacio alrededor de }
    .replace(/\s*:\s*/g, ':')              // sin espacio alrededor de :
    .replace(/\s*;\s*/g, ';')              // sin espacio alrededor de ;
    .replace(/\s*,\s*/g, ',')              // sin espacio alrededor de ,
    .replace(/;}/g, '}')                    // eliminar ; antes de }
    .trim();
}

// ── Limpieza JS (no modifica código) ────────────────────────────────────
// Solo elimina líneas en blanco excesivas y comentarios de línea al inicio.
// NO elimina código, NO colapsa strings ni template literals.
function cleanJS(src) {
  return src
    .replace(/\n{3,}/g, '\n\n')            // máximo 2 saltos consecutivos
    .trim();
}

// ── Lectura y escritura de texto ─────────────────────────────────────────
function readText(src) {
  const buf = fs.readFileSync(src);
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.slice(3).toString('utf8');
  }
  const asUtf8 = buf.toString('utf8');
  if (!asUtf8.includes('�')) return asUtf8;
  return buf.toString('latin1');
}

function writeText(dest, content) {
  fs.writeFileSync(dest, content, 'utf8');
}

// ── copyDir con minificación por tipo ────────────────────────────────────
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (/\.css$/i.test(entry.name)) {
      writeText(d, minifyCSS(readText(s)));
    } else if (/\.js$/i.test(entry.name)) {
      writeText(d, cleanJS(readText(s)));
    } else if (/\.(html|json)$/i.test(entry.name)) {
      writeText(d, readText(s));
    } else {
      fs.copyFileSync(s, d);  // binarios: imágenes, fuentes, etc.
    }
  }
}

function copyFile(src, dest) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

function copyTextFile(src, dest) {
  if (fs.existsSync(src)) writeText(dest, readText(src));
}

function copyHtmlWithCapacitor(src, dest) {
  if (!fs.existsSync(src)) return;
  let html = readText(src);

  // Inyectar capacitor.js al inicio del <head>
  if (!html.includes('src="capacitor.js"') && !html.includes("src='capacitor.js'")) {
    html = html.replace(/<head>/i, '<head>\n  <script src="capacitor.js"></script>');
  }

  // Inyectar consent.js antes de unity-ads.js en páginas que lo usen
  if (html.includes('unity-ads.js') && !html.includes('consent.js')) {
    html = html.replace(
      /(<script[^>]+src=["'][^"']*unity-ads\.js["'][^>]*><\/script>)/,
      '<script defer src="js/consent.js"></script>\n  $1'
    );
  }

  writeText(dest, html);
}

// ── Directorios ───────────────────────────────────────────────────────────
for (const dir of ['css', 'js', 'images', 'icons', 'legal']) {
  copyDir(path.join(ROOT, dir), path.join(WWW, dir));
}

// ── Archivos individuales ────────────────────────────────────────────────
copyTextFile(path.join(ROOT, 'firebase-messaging-sw.js'), path.join(WWW, 'firebase-messaging-sw.js'));
copyTextFile(path.join(ROOT, 'sw.js'),                    path.join(WWW, 'sw.js'));
copyTextFile(path.join(ROOT, 'manifest.json'),            path.join(WWW, 'manifest.json'));
copyTextFile(path.join(ROOT, 'app-ads.txt'),              path.join(WWW, 'app-ads.txt'));
copyFile(path.join(ROOT, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js'),
         path.join(WWW, 'capacitor.js'));

// ── HTML de la raíz ───────────────────────────────────────────────────────
for (const f of fs.readdirSync(ROOT)) {
  if (f.endsWith('.html')) {
    copyHtmlWithCapacitor(path.join(ROOT, f), path.join(WWW, f));
  }
}

// Landing page como root
copyHtmlWithCapacitor(path.join(ROOT, 'landing.html'), path.join(WWW, 'index.html'));
copyHtmlWithCapacitor(path.join(ROOT, 'index.html'),   path.join(WWW, 'login.html'));

// ── Reporte de tamaños ───────────────────────────────────────────────────
let totalKB = 0;
function dirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let size = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    size += f.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return size;
}
totalKB = Math.round(dirSize(WWW) / 1024);
console.log(`✅ Build completado → www/ (${totalKB} KB)`);
