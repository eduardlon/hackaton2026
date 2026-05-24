# Backend Contract — FinGrow ↔ Insforge

## Endpoints

- App base URL: `https://eh28u6b7.us-east.insforge.app`
- Functions URL: `https://eh28u6b7.functions.insforge.app`

## Invocación

El frontend (Expo + Hermes) llama a las edge functions de Insforge por HTTP:

```http
POST https://eh28u6b7.functions.insforge.app/<function-slug>
Content-Type: application/json
Authorization: Bearer <access_token>   # cuando ya hay sesión
```

No usamos `@insforge/sdk` (incompatible con Hermes SDK 54). Tampoco
necesitamos `anonKey` mientras llamemos directo a `/<slug>`.

---

## Auth (nuevo flujo Nequi-style — phone + PIN + huella)

### `auth-lookup-phone`

Verifica si un celular ya está registrado.

**Request**
```json
{ "phone": "+573001234567" }
```

**Response 200**
```json
{ "exists": true, "user": { "name": "María" } }
```

Si la function no está desplegada todavía, el frontend asume `{ exists: false }`
y manda al usuario al registro.

---

### `auth-register`

Crea una cuenta nueva con teléfono + nombre + PIN.

**Request**
```json
{
  "phone": "+573001234567",
  "name": "María García",
  "pinHash": "sha256(pepper::phone::pin)",
  "pin": "1234"
}
```

`pinHash` es **defensa en profundidad** (no expone el PIN en logs).
El backend debe hashearlo **otra vez** con bcrypt/argon2 antes de guardarlo.

**Response 200**
```json
{
  "user": { "id": "usr_...", "phone": "+57...", "name": "María", "type": "personal" },
  "session": { "access_token": "...", "refresh_token": "..." }
}
```

---

### `auth-login-pin`

Login con celular + PIN.

**Request**
```json
{ "phone": "+573001234567", "pinHash": "...", "pin": "1234" }
```

**Response 200** — igual que `auth-register`.

**Response 401** — PIN incorrecto.

---

### `auth-logout`

Invalida el `access_token` actual. Best-effort.

```json
{}
```

---

## Datos / Wallet

- `get-wallet-home` — saldo, ingresos, gastos, pasaporte, últimas transacciones
- `get-passport` — pasaporte financiero + recomendaciones
- `simulate-loan` — calcula cuota y recomendación
- `financial-chat` — copiloto AI

## NFC

### `confirm-nfc-transfer`

El receptor confirma una transferencia recibida por NFC.

**Request**
```json
{
  "fromUserId": "usr_emisor",
  "amount": 25000,
  "reference": "uuid-v4",
  "note": "almuerzo",
  "createdAt": "2026-05-24T05:00:00Z"
}
```

**Response 200**
```json
{
  "transferId": "tx_...",
  "status": "completed",
  "amount": 25000,
  "from": { "id": "usr_emisor", "name": "Juan" },
  "to":   { "id": "usr_receptor", "name": "María" }
}
```

El backend debe usar `reference` como **clave de idempotencia** (evita doble
cobro si el receptor escanea dos veces).

---

## Tabla `users` esperada en Insforge

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,        -- bcrypt/argon2
  type TEXT DEFAULT 'personal',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Frontend notes

- El frontend NO persiste `access_token` en disco (política app financiera).
  La sesión muere al cerrar la app.
- El celular **sí** se persiste en AsyncStorage (`@fingrow/last-phone`).
- El PIN se persiste en SecureStore con `requireAuthentication: true` solo
  cuando el usuario activa el ingreso por huella.
