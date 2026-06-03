# Checklist de Release - VirtualGift con Unity Ads

Completar antes de publicar en Google Play Store, App Store o lanzar web.

---

## 1. Unity Ads

- [x] Confirmar Game ID Android `6127955`
- [x] Confirmar Game ID iOS `6127954`
- [ ] Confirmar placements en Unity Dashboard:
  - `Interstitial_Android`
  - `Interstitial_iOS`
  - `Rewarded_Android`
  - `Rewarded_iOS`
  - `Banner_Android`
  - `Banner_iOS`
- [ ] Probar Rewarded Ads en ruleta y tragamonedas con usuario real
- [ ] Confirmar que `js/unity-ads.js` tiene `testMode: false` solo cuando Unity Ads ya este listo para produccion
- [x] Mantener la Monetization Stats API Key fuera del cliente/app

## 2. Recompensas

- [x] Desplegar `grantUnityAdReward` antes de publicar la app
- [ ] Verificar que ruleta desbloquea maximo 3 giros extra por dia
- [ ] Verificar que tragamonedas desbloquea maximo 3 tiradas extra por dia
- [ ] Revisar en Firestore la coleccion `adRewards`
- [ ] Configurar Server-to-Server callbacks de Unity Ads cuando Unity lo habilite para endurecer antifraude

## 3. Android

- [x] Ejecutar `npm run cap:sync:android`
- [x] Ejecutar `cd android && .\gradlew.bat assembleRelease`
- [x] Ejecutar `cd android && .\gradlew.bat bundleRelease`
- [ ] Revisar Data Safety en Google Play: ads, Advertising ID y datos usados por Unity Ads
- [ ] Probar en dispositivo fisico Android

## 4. iOS

- [ ] En Mac: ejecutar `npm run cap:sync:ios`
- [ ] En `ios/App`: ejecutar `pod install`
- [ ] Abrir Xcode y compilar en dispositivo fisico
- [x] Copiar desde Unity Dashboard la lista completa de SKAdNetwork IDs al `Info.plist`
- [ ] Revisar App Privacy en App Store Connect: anuncios, tracking y datos usados por Unity Ads

## 5. Firebase

- [x] Activar `compute.googleapis.com` en Google Cloud si sigue apareciendo el warning de Functions Gen 2
- [ ] Deploy ordenado:
  1. `firebase deploy --only functions`
  2. `firebase deploy --only firestore:rules,storage`
  3. `npm run build && firebase deploy --only hosting`

---

## QA minimo

- [ ] Registro/login
- [ ] Check-in diario
- [ ] Ruleta normal y rewarded
- [ ] Tragamonedas normal y rewarded
- [ ] Canjes
- [ ] Admin
- [ ] Borrado de cuenta
