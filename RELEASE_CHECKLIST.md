# Checklist de Release - VirtualGift sin anuncios

Completar antes de publicar en Google Play Store o lanzar en produccion web.

---

## 1. Confirmar que no hay SDKs de anuncios

- [ ] Android no registra plugins de anuncios en `MainActivity.java`
- [ ] Android no incluye `play-services-ads`, Unity Ads ni SDKs publicitarios
- [ ] `AndroidManifest.xml` no declara App ID de AdMob ni permiso `com.google.android.gms.permission.AD_ID`
- [ ] No existen cargas de AdSense (`pagead2.googlesyndication.com`) en HTML
- [ ] No existen archivos `ads.txt` ni `app-ads.txt` en el build web

## 2. Sin recompensas por anuncios

- [ ] `puntos.html` no muestra tarjeta para ver anuncios
- [ ] `anuncios.html` muestra que la funcion esta desactivada
- [ ] Ruleta y tragamonedas no ofrecen giros/tiradas extra por anuncios
- [ ] No se escriben nuevas recompensas `ad_reward` desde el cliente

## 3. Build Android

- [ ] Ejecutar `npm run cap:sync:android`
- [ ] Ejecutar `cd android && .\gradlew.bat assembleRelease`
- [ ] Abrir Android Studio y hacer Clean + Rebuild si vas a firmar desde la UI
- [ ] Firmar el APK/AAB con la keystore de produccion

## 4. Verificacion manual

- [ ] Instalar el build en un dispositivo fisico
- [ ] Navegar por home, puntos, ruleta, tragamonedas, tienda y soporte
- [ ] Verificar que no aparece ningun banner, interstitial, rewarded ad ni espacio vacio de anuncio
- [ ] Verificar en logcat que no aparecen logs de AdMob, UnityAds o Google Mobile Ads
- [ ] Verificar en DevTools/Network web que no hay requests a `pagead2.googlesyndication.com`

## 5. Google Play

- [ ] En Data Safety, declarar que la app no usa Advertising ID si no hay otro SDK que lo requiera
- [ ] En la ficha de Play Console, no marcar monetizacion por anuncios
- [ ] Publicar una version nueva para que la app instalada deje de usar SDKs publicitarios

---

## Rollback

Si en el futuro decides volver a monetizar con anuncios, hacerlo en una rama separada y revisar politicas de Google antes de reintroducir cualquier SDK publicitario.