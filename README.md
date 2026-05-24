# Credigrow

App móvil financiera (Expo + React Native + TypeScript) construida para el hackathon. Permite a personas naturales, trabajadores independientes y microempresarios mover dinero, registrar movimientos, simular crédito, ver análisis y construir su **Pasaporte Financiero**.

Diseñada con la skill [`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (instalada en `.cursor/skills/ui-ux-pro-max/`, design system persistido en `design-system/credigrow/MASTER.md`).

## Stack

- **Expo SDK 54** + React Native 0.81 + React 19.1 (compatible con la app **Expo Go** publicada en stores)
- **Expo Router v6** (file-based routing con grupos `(auth)` y `(tabs)`)
- **Reanimated 4** + **Moti** para animaciones (180–700 ms, easing suave)
- **react-native-gifted-charts** (donut + línea con animación nativa)
- **react-native-svg** para sparkline custom
- **Zustand** + **AsyncStorage** para estado global y persistencia
- **lucide-react-native** para íconos lineales
- **Inter** (Google Fonts) como tipografía oficial
- **react-hook-form** para el login

## Estructura

```
credigrow/
├─ src/
│  ├─ app/                    # rutas Expo Router
│  │  ├─ _layout.tsx          # providers + guard de auth
│  │  ├─ index.tsx            # redirect según sesión
│  │  ├─ (auth)/login.tsx     # pantalla de login
│  │  └─ (tabs)/              # 5 pestañas
│  │     ├─ _layout.tsx       # bottom bar custom animada
│  │     ├─ index.tsx         # Inicio
│  │     ├─ movimientos.tsx
│  │     ├─ credito.tsx
│  │     ├─ analisis.tsx
│  │     └─ perfil.tsx
│  ├─ components/             # librería UI reutilizable
│  │  ├─ home/                # cards específicas de Inicio
│  │  └─ charts/              # DonutChart + EvolutionChart
│  ├─ theme/                  # tokens, ThemeProvider, useTheme
│  ├─ services/
│  │  ├─ api.ts               # capa de datos: invoke Insforge + fallback mock
│  │  └─ insforge.ts          # invocación HTTP directa a Functions
│  ├─ store/                  # zustand stores (auth, preferencias)
│  ├─ data/mock.ts            # datos consistentes del brief
│  ├─ types/                  # tipos compartidos
│  ├─ utils/format.ts         # formato de moneda/porcentajes
│  └─ hooks/useReduceMotion.ts
├─ design-system/credigrow/MASTER.md
├─ assets/
├─ app.json
├─ eas.json
├─ babel.config.js
└─ .env.example
```

## Tema claro / oscuro

- La app **siempre arranca en modo claro**.
- El usuario puede cambiar al modo oscuro tocando el ícono ☾/☀ del Header (visible en todas las pantallas) o desde Perfil.
- La preferencia se guarda en AsyncStorage con la clave `@credigrow/theme-mode` y se respeta en próximas aperturas.

## Datos y backend (Insforge)

La app ya está cableada al **backend real de Insforge** descrito en `docs/BACKEND-CONTRACT.md`. Cada pantalla consume `src/services/api.ts`, que internamente:

1. Llama a la **edge function** correspondiente del contrato por HTTP: `POST https://eh28u6b7.functions.insforge.app/<slug>`.
2. Si la función todavía no está desplegada o la red falla, **hace fallback automático al mock** en `src/data/mock.ts`. De esta forma Expo Go siempre tiene UI funcional mientras el equipo de backend construye las funciones.

### Configuración

Copia `.env.example` → `.env` (ya viene precargado para el demo):

```
EXPO_PUBLIC_INSFORGE_URL=https://eh28u6b7.us-east.insforge.app
EXPO_PUBLIC_INSFORGE_FUNCTIONS_URL=https://eh28u6b7.functions.insforge.app
EXPO_PUBLIC_DEMO_USER_ID=demo-user-001
```

No se usa `@insforge/sdk` en Expo Go; por eso el frontend no necesita `anonKey`.

> Las variables `EXPO_PUBLIC_*` se inyectan en tiempo de build. Si cambias el `.env`, reinicia `expo start` con `--clear`.

### Funciones esperadas (contrato)

| Slug | Usado en | Estado actual |
| --- | --- | --- |
| `demo-login` | Login demo | invoca con `{ "loginAs": "user" }` + fallback mock |
| `get-wallet-home` | Inicio, Movimientos (recientes) | invoca + fallback mock |
| `get-passport` | Inicio, Análisis | invoca + fallback mock |
| `simulate-loan` | Crédito (simulador) | invoca + fallback cálculo local |
| `process-invoice` | Pagar con foto (quick action) | listo en `processInvoice()` |
| `confirm-bill-payment` | Confirmación de pago | listo en `confirmBillPayment()` |
| `financial-chat` | Preguntar IA (quick action) | listo en `askFinancialChat()` |
| `get-admin-profile` | Perfil (resumen) | listo en `getAdminProfile()` |

Mapeo `contrato → tipos del frontend` vive en `src/services/api.ts` (sección "Mapeos"). Cuando el backend cambie un campo, solo hay que tocar ese archivo.

### Auth

El contrato amarra toda la información a un `userId` (por defecto `demo-user-001`). El botón **"Entrar como demo"** del Login usa ese mismo id, así que las pantallas reciben datos reales del backend sin necesidad de crear una cuenta. El email/password real con Insforge Auth está disponible en `client.auth.signInWithPassword` y se puede enchufar en `signInWithEmail` cuando el backend habilite usuarios verificados.

## Desarrollo local (Expo Go)

Requisitos: Node 22+ y la app **Expo Go** instalada en tu Android/iPhone.

```bash
cd credigrow
npm install
npx expo start --tunnel
```

- Escanea el QR con Expo Go (Android) o con la cámara (iOS).
- Recargar: shake del dispositivo o `r` en la terminal.
- Si tu red bloquea LAN, `--tunnel` es lo más confiable.

> Nota: la API nueva de Reanimated 4 + worklets ya está cableada en `babel.config.js`. No requiere pasos extra.

## Verificación local (sin emulador)

```bash
npx tsc --noEmit         # sin errores
npx expo export --platform android --output-dir /tmp/out   # bundle exitoso
```

## Generar APK (EAS Build en la nube)

Recomendado porque no necesitas instalar Android SDK ni Java en tu máquina.

### Una sola vez

```bash
npm install -g eas-cli   # o usar npx eas-cli ...
eas login                # se abre el navegador, crea/usa cuenta Expo gratuita
cd credigrow
eas init --id <opcional> # vincula proyecto (genera projectId)
```

`eas init` actualiza automáticamente `app.json.extra.eas.projectId`.

### Cada vez que quieras un APK demo

```bash
eas build --platform android --profile preview
```

- Genera el APK en la nube (gratis para usos limitados).
- Al terminar imprime una URL para descargar el `.apk`.
- Instálalo en cualquier Android con "permitir instalación de fuentes desconocidas".

### Versión Play Store (AAB)

```bash
eas build --platform android --profile production
```

Genera un `.aab` listo para subir a Google Play. Para subirlo automáticamente: `eas submit -p android`.

## Animaciones implementadas

Siguiendo el brief al detalle:

- **Transición entre pantallas**: fade + slide up suave (~250 ms) vía `MotiView` en `ScreenContainer`.
- **Cards escalonadas**: `StaggeredList` con `delay = i * 80 ms`.
- **Bottom bar**: ícono activo escala con `withSpring`, píldora verde aparece detrás con `withTiming`.
- **Botones**: `PressableScale` aplica `scale(0.97)` en `onPressIn` (120 ms) + haptic.
- **Barras de progreso** (Pasaporte, Elegibilidad): `withTiming` 700–900 ms con easing `out(cubic)`, respeta `prefers-reduced-motion`.
- **Sparkline (Resumen General)**: dibujo progresivo con `strokeDashoffset` animado (900 ms).
- **Donut (Análisis)**: animación nativa de `react-native-gifted-charts`.
- **Línea (Análisis)**: curva animada de izquierda a derecha + `animateOnDataChange`.
- **PointsBadge (+X pts)**: pop con `spring` (scale 0.6 → 1, translateY 6 → 0).
- **Toggles (Perfil)**: knob desliza con `withSpring` y track cambia color con `withTiming`.
- **Simulador de crédito**: cards de resultado hacen fade al cambiar monto/plazo/motivo.

## Accesibilidad

- `useReduceMotion()` lee `AccessibilityInfo.isReduceMotionEnabled` y desactiva animaciones largas (barras, sparkline) cuando está activa.
- Hit targets ≥ 36 px (todos los `PressableScale` redondos son 38–48 px).
- Contraste AA en ambos temas (texto principal sobre fondo y verde primario sobre negro/blanco).
- Todo el texto en español, sin emojis como íconos (Lucide en todo).

## Brief / PRD

- Diseño y copy fielmente respetados desde el brief original ("Spendly IA" en el brief, ahora rebautizado **Credigrow** a pedido del producto).
- Datos mock siguen los montos exactos: saldo $4.362.036, ingresos $3.200.000, gastos $2.100.000, crédito estimado $800.000, Pasaporte 420/700 puntos.
- PRD completo en `../prd.md`.

## Comandos útiles

```bash
npx expo start --tunnel     # dev server con Expo Go
npx expo start --clear      # limpia caché del bundler
npx expo start --android    # abre emulador (si lo tienes)
npx tsc --noEmit            # type-check
eas build -p android --profile preview     # APK demo
eas build -p android --profile production  # AAB Play Store
```
