# NFC en FinGrow — cómo probarlo

## ¿Por qué no en Expo Go?

`react-native-nfc-manager` es un **módulo nativo** (Java/Kotlin + Swift).
Expo Go solo incluye los módulos nativos que vienen con el SDK estándar,
por lo que NFC no funciona allí.

En Expo Go la pantalla `Pago por NFC` muestra una bandera amarilla
("NFC no está disponible aquí") y bloquea el escaneo. **El resto del flujo
de login + UI funciona perfecto en Expo Go**, solo el NFC necesita dev build.

---

## Pasos para crear un dev build (Android)

```bash
# 1. Generar la carpeta android/ con todos los plugins ya configurados
npx expo prebuild --platform android --clean

# 2. (recomendado) Build en la nube con EAS
npm i -g eas-cli
eas login
eas build --profile development --platform android

# 3. Cuando termine, EAS te da un APK. Lo instalas:
adb install path/to/fingrow-dev.apk
```

Alternativa **local** (más rápida si tienes Android Studio):

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

Luego arrancas Metro con `npm start` y el APK conectará al bundler igual
que Expo Go.

---

## Plugins ya configurados en `app.json`

- `react-native-nfc-manager` (NFC)
- `expo-local-authentication` (huella)
- `expo-secure-store` (PIN protegido con biometría)

Permisos Android automáticos:

- `android.permission.NFC`
- `android.permission.USE_BIOMETRIC`
- `android.permission.USE_FINGERPRINT`
- `android.permission.VIBRATE`

---

## Flujo P2P implementado

1. **Receptor** abre `Pago por NFC → Recibir por NFC` y toca
   "Permitir recepción NFC".
   - Su celular queda en modo lectura y autoriza al emisor a acercarse.
2. **Emisor** abre `Inicio → Enviar por NFC`, escribe el monto y toca
   "Continuar: receptor ya permitió".
   - La app escribe un mensaje NDEF con el payload de la transferencia
     (id de quien envía, monto, referencia única).
3. Apenas el receptor lee los bytes, llama a la edge function
   `confirm-nfc-transfer` que **mueve el saldo real en el backend**.
4. El `reference` (UUID v4) actúa como clave de idempotencia.

---

## Notas de seguridad

- El payload NFC NO contiene el PIN ni el `access_token`.
- Solo el receptor puede confirmar la transferencia (su token autentica
  la llamada al backend).
- El backend valida que `fromUserId` exista, que la `reference` no se haya
  usado, y que el saldo alcance.
