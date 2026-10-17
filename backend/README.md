# Backend – Limpieza (API REST + MySQL)

API hecha con **Node.js + Express** que expone el **CRUD de solicitudes de servicio** y lo guarda en **MySQL**.
El frontend Angular la consume con `HttpClient`. El login sigue siendo con Firebase: cada pedido
lleva el token del usuario y el backend lo verifica.

## Requisitos

- Node.js 18 o superior
- MySQL 8 (o MariaDB) corriendo en tu compu

## Cómo levantarlo

```bash
cd backend
npm install
copy .env.example .env      (en Mac/Linux: cp .env.example .env)
```

Abrí `.env` y completá tu usuario y contraseña de MySQL (`DB_USER`, `DB_PASSWORD`). Después:

```bash
npm start
```

Tiene que aparecer:

```
✔ Conectado a MySQL (localhost:3306/limpieza)
✔ API escuchando en http://localhost:3000
```

La **base `limpieza` y la tabla `solicitudes` se crean solas** al arrancar. El SQL está en `sql/schema.sql`.

## Endpoints

Todos (salvo `/api/salud`) requieren el header `Authorization: Bearer <token de Firebase>`.

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| GET | `/api/salud` | público | Comprueba que la API está viva |
| GET | `/api/solicitudes` | admin | Lista todas |
| GET | `/api/solicitudes/mias` | cliente | Lista las del cliente logueado |
| GET | `/api/solicitudes/pendientes` | empleada | Trabajos sin empleada asignada |
| GET | `/api/solicitudes/:id` | dueño / empleada asignada / admin | Una solicitud |
| POST | `/api/solicitudes` | cliente | **Alta** |
| PUT | `/api/solicitudes/:id` | cliente dueño | **Modificación** (solo si está pendiente) |
| POST | `/api/solicitudes/:id/tomar` | empleada | Toma un trabajo |
| DELETE | `/api/solicitudes/:id` | cliente dueño / admin | **Baja** (el cliente, solo si está pendiente) |

Códigos de respuesta: `200` OK, `201` creado, `204` borrado, `400` datos inválidos,
`401` sin login, `403` sin permiso, `404` no existe, `409` ya fue tomada.

## Estructura

```
backend/
├── sql/schema.sql          Tabla de MySQL
├── src/
│   ├── index.js            Arranca Express
│   ├── db.js               Conexión a MySQL (crea la base y la tabla)
│   ├── auth.js             Verifica el token de Firebase y el tipo de usuario
│   └── rutas/solicitudes.js  Endpoints del CRUD
├── .env.example            Configuración de ejemplo
└── package.json
```
