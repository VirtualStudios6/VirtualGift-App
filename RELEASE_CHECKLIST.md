# Checklist de Release — VirtualGift AdMob/AdSense

Completar TODOS los puntos antes de publicar en Google Play Store o lanzar en producción web.

---

## 1. Activar anuncios reales (App Nativa)

- [ ] Abrir `js/admob.js`
- [ ] Cambiar `FORCE_PROD_NATIVE = false` → `FORCE_PROD_NATIVE = true`
- [ ] Verificar en consola que el log dice `[AdMob] TEST_MODE activo` NO aparece
- [ ] Ejecutar `npx cap sync android`
- [ ] Hacer Clean + Rebuild en Android Studio

## 2. Verificar IDs de producción en logs

Ejecutar la app en un dispositivo físico real (no emulador) y verificar en logcat:

```
AdMobPlugin: SDK ready
Banner: AdMob cargado ✓
```

Los IDs que aparecen deben ser los reales (`ca-app-pub-1930529129644930/...`).

## 3. Firmar el APK/AAB

- [ ] Usar la keystore de producción (NO la debug keystore)
- [ ] Build → Generate Signed Bundle / APK en Android Studio

## 4. Verificar AdSense en web

- [ ] Visitar `https://virtualgift.pro/landing.html` desde un navegador limpio (sin login)
- [ ] Verificar que el anuncio AdSense aparece en la landing
- [ ] Verificar que en `localhost` NO aparece ningún anuncio AdSense (consola debe mostrar `[app-mode] AdSense bloqueado`)

## 5. Verificar protecciones anti-IVT activas

- [ ] `app-mode.js` bloquea AdSense en localhost
- [ ] `admob.js` usa IDs reales solo cuando `FORCE_PROD_NATIVE = true`
- [ ] `ads-init.js` frequency capping: mínimo 90s entre interstitials
- [ ] `anuncios.html` NO carga AdSense (verificar en DevTools → Network)

## 6. Prueba de usuario real antes de publicar

- [ ] Instalar el APK firmado en un dispositivo físico real
- [ ] Navegar 5 minutos normalmente y verificar que los anuncios aparecen
- [ ] Verificar que el banner está encima del bottom-nav (no lo solapa)
- [ ] Verificar que el interstitial no aparece más de 1 vez en 90 segundos
- [ ] NO hacer clic en los anuncios durante la verificación

## 7. Políticas de Google a recordar

- NO hacer clic en tus propios anuncios nunca (ni en test, ni en producción)
- NO incentivar a usuarios a hacer clic en anuncios
- NO mostrar anuncios en páginas sin contenido real
- NO cargar AdSense en páginas de acceso exclusivo (detrás de login sin tráfico orgánico)
- NO usar VPN mientras pruebas la app con anuncios reales
- Máximo 3 unidades AdSense por página
- Interstitials: no mostrar en carga inicial ni más de 1 por 30 segundos

## 8. Después de publicar

- [ ] Monitorear AdMob dashboard las primeras 48h
- [ ] Verificar CTR (Click-Through Rate) — si supera el 10% es sospechoso
- [ ] Verificar RPM (Revenue per 1000 impressions) — valores muy altos también son alerta
- [ ] Si se detecta tráfico inválido, activar inmediatamente `FORCE_PROD_NATIVE = false` y republicar

---

## Rollback de emergencia

Si AdMob/AdSense envía alerta de tráfico inválido:

1. `js/admob.js` → `FORCE_PROD_NATIVE = false`
2. `npx cap sync android` + rebuild + publicar como update urgente en Play Store
3. En AdSense/AdMob dashboard: reportar el incidente en la sección de appeals
