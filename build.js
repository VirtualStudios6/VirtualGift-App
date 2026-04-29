// build.js — copia archivos fuente → www/ (cross-platform)
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const WWW  = path.join(ROOT, 'www');

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

// Directorios
for (const dir of ['css', 'js', 'images', 'legal']) {
  copyDir(path.join(ROOT, dir), path.join(WWW, dir));
}

// Archivos individuales
copyFile(path.join(ROOT, 'firebase-messaging-sw.js'), path.join(WWW, 'firebase-messaging-sw.js'));

// Todos los .html de la raíz
for (const f of fs.readdirSync(ROOT)) {
  if (f.endsWith('.html')) {
    copyFile(path.join(ROOT, f), path.join(WWW, f));
  }
}

console.log('✅ Build completado: archivos copiados a www/');
