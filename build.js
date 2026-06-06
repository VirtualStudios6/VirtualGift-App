// build.js — copia archivos fuente → www/ (cross-platform)
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const WWW  = path.join(ROOT, 'www');

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function copyFile(src, dest) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

function copyHtmlWithCapacitor(src, dest) {
  if (!fs.existsSync(src)) return;
  let html = fs.readFileSync(src, 'utf8');
  if (!html.includes('src="capacitor.js"') && !html.includes("src='capacitor.js'")) {
    html = html.replace(/<head>/i, '<head>\n  <script src="capacitor.js"></script>');
  }
  fs.writeFileSync(dest, html, 'utf8');
}

// Directorios
for (const dir of ['css', 'js', 'images', 'icons', 'legal']) {
  copyDir(path.join(ROOT, dir), path.join(WWW, dir));
}

// Archivos individuales
copyFile(path.join(ROOT, 'firebase-messaging-sw.js'), path.join(WWW, 'firebase-messaging-sw.js'));
copyFile(path.join(ROOT, 'sw.js'), path.join(WWW, 'sw.js'));
copyFile(path.join(ROOT, 'manifest.json'), path.join(WWW, 'manifest.json'));
copyFile(path.join(ROOT, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js'), path.join(WWW, 'capacitor.js'));
// Todos los .html de la raíz
for (const f of fs.readdirSync(ROOT)) {
  if (f.endsWith('.html')) {
    copyHtmlWithCapacitor(path.join(ROOT, f), path.join(WWW, f));
  }
}

// Landing page como root: www/index.html = landing, www/login.html = login
copyHtmlWithCapacitor(path.join(ROOT, 'landing.html'), path.join(WWW, 'index.html'));
copyHtmlWithCapacitor(path.join(ROOT, 'index.html'),   path.join(WWW, 'login.html'));

console.log('✅ Build completado: archivos copiados a www/');
