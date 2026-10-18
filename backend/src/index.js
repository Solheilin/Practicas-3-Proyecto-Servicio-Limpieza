require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { iniciarBase } = require('./db');
const { requiereLogin } = require('./auth');
const rutasSolicitudes = require('./rutas/solicitudes');
const rutasEmpleadas = require('./rutas/empleadas');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Acepta pedidos del frontend en cualquier puerto de localhost (4200, 50170, etc.)
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));
app.use(express.json({ limit: '1mb' })); // 1 MB alcanza para la foto del perfil

// Ruta pública para comprobar que la API está viva
app.get('/api/salud', (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));

// CRUD de solicitudes (todas las rutas requieren iniciar sesión)
app.use('/api/solicitudes', requiereLogin, rutasSolicitudes);

// Perfil de empleadas y reseñas (requieren iniciar sesión)
app.use('/api/empleadas', requiereLogin, rutasEmpleadas.empleadas);
app.use('/api/resenas', requiereLogin, rutasEmpleadas.resenas);

// Ruta inexistente
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// Cualquier error inesperado (por ejemplo, se cayó MySQL)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

iniciarBase()
  .then(() => {
    app.listen(PORT, () => console.log(`✔ API escuchando en http://localhost:${PORT}`));
  })
  .catch(e => {
    console.error('✘ No se pudo conectar a MySQL. Revisá los datos del archivo .env');
    console.error('  ' + e.message);
    process.exit(1);
  });
