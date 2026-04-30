# Cloud Functions — Secrets

Los secrets se gestionan con Firebase Secret Manager.
Nunca los pongas en código fuente ni en archivos .env commiteados.

## Secrets requeridos

| Secret name           | Función que lo usa         | Dónde obtenerlo                                      |
|-----------------------|----------------------------|------------------------------------------------------|
| `AYET_POSTBACK_TOKEN` | `ayetPostback`             | AyetStudios dashboard → Postback settings → Token   |
| `ADGEM_SECRET_KEY`    | `adgemPostback`            | AdGem dashboard → Postback → Secure Hash Secret Key |
| `FORTNITE_API_KEY`    | `syncFortniteShop` / `forceFortniteShopSync` | fortnite-api.com → API Keys |

## Cómo configurar un secret

```bash
# Desde la raíz del proyecto (donde está firebase.json)
firebase functions:secrets:set AYET_POSTBACK_TOKEN
# Te pedirá el valor — pégalo y presiona Enter

firebase functions:secrets:set ADGEM_SECRET_KEY
firebase functions:secrets:set FORTNITE_API_KEY
```

## Cómo verificar que están configurados

```bash
firebase functions:secrets:access AYET_POSTBACK_TOKEN
firebase functions:secrets:access ADGEM_SECRET_KEY
firebase functions:secrets:access FORTNITE_API_KEY
```

## Notas importantes

- Después de configurar los secrets, debes hacer deploy de functions:
  `firebase deploy --only functions`

- Los fallbacks hardcodeados en `index.js` (marcados con TODO) deben
  eliminarse una vez que los secrets estén configurados y verificados.

- El `.env` de functions (si existiera) NO debe estar en git.
  Está incluido en functions/.gitignore: `*.local`

## AdGem — Verificar hash

La función `adgemPostback` calcula:
`SHA256(player_id + amount + transaction_id + secret_key)`

Confirma el orden exacto en el dashboard de AdGem:
AdGem Dashboard → Apps → tu app → Postback → Secure Hash

Si el orden es diferente, ajusta `computeAdgemHash()` en `index.js`.
