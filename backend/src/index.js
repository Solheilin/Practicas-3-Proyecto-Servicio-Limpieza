require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { iniciarBase } = require('./db');
const { requiereLogin } = require('./auth');
const rutasSolicitudes = require('./rutas/solicitudes');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Permite pedidos desde el frontend Angular
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));
app.use(express.json());

// Ruta pública para comprobar que la API está viva
app.get('/api/salud', (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));

// CRUD de solicitudes (todas las rutas requieren iniciar sesión)
app.use('/api/solicitudes', requiereLogin, rutasSolicitudes);

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
