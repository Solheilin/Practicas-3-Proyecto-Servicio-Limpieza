const express = require('express');
const { consultar } = require('../db');
const { soloTipos } = require('../auth');

/** Servicios que puede ofrecer una empleada */
const SERVICIOS = ['limpieza', 'planchar', 'lavar', 'cocina', 'cuidadoNinos', 'camaAdentro'];

// ===========================================================================
//  PERFIL DE LA EMPLEADA   →  /api/empleadas
// ===========================================================================
const empleadas = express.Router();

/**
 * GET /api/empleadas/:uid/perfil
 * Perfil + resumen: promedio de estrellas, cantidad de reseñas y de trabajos.
 * Lo puede ver cualquier usuario logueado.
 */
empleadas.get('/:uid/perfil', async (req, res) => {
  const uid = req.params.uid;

  const [perfil] = await consultar('SELECT * FROM perfiles_empleada WHERE empleada_uid = ?', [uid]);

  const [resumenResenas] = await consultar(
    'SELECT COUNT(*) AS cantidad, AVG(puntaje) AS promedio FROM resenas WHERE empleada_uid = ?',
    [uid]
  );

  const [trabajos] = await consultar(
    `SELECT
       SUM(estado = 'tomada')     AS enCurso,
       SUM(estado = 'finalizada') AS finalizados,
       MAX(empleada_nombre)       AS nombre
     FROM solicitudes WHERE empleada_uid = ?`,
    [uid]
  );

  res.json({
    empleadaUid: uid,
    nombre: perfil?.nombre || trabajos?.nombre || '',
    descripcion: perfil?.descripcion || '',
    aniosExperiencia: perfil?.anios_experiencia ?? 0,
    servicios: perfil?.servicios ? perfil.servicios.split(',').filter(Boolean) : [],
    foto: perfil?.foto || null,
    completo: !!perfil,                       // false = todavía no completó su perfil
    resenas: {
      cantidad: Number(resumenResenas.cantidad),
      promedio: resumenResenas.promedio ? Number(Number(resumenResenas.promedio).toFixed(1)) : 0,
    },
    trabajos: {
      enCurso: Number(trabajos?.enCurso || 0),
      finalizados: Number(trabajos?.finalizados || 0),
    },
  });
});

/** PUT /api/empleadas/perfil → la empleada crea o actualiza SU perfil */
empleadas.put('/perfil', soloTipos('empleada'), async (req, res) => {
  const body = req.body || {};

  const anios = Number.parseInt(body.aniosExperiencia, 10);
  if (Number.isNaN(anios) || anios < 0 || anios > 70) {
    return res.status(400).json({ error: 'Los años de experiencia deben ser un número entre 0 y 70.' });
  }

  const servicios = Array.isArray(body.servicios) ? body.servicios.filter(s => SERVICIOS.includes(s)) : [];
  const descripcion = String(body.descripcion ?? '').trim().slice(0, 600);

  // La foto llega como "data:image/jpeg;base64,...". Se limita el tamaño (unos 300 KB)
  let foto = body.foto ?? null;
  if (foto !== null) {
    if (typeof foto !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(foto)) {
      return res.status(400).json({ error: 'La foto no tiene un formato válido.' });
    }
    if (foto.length > 400000) return res.status(400).json({ error: 'La foto es demasiado grande.' });
  }

  await consultar(
    `INSERT INTO perfiles_empleada (empleada_uid, nombre, descripcion, anios_experiencia, servicios, foto)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       nombre = VALUES(nombre), descripcion = VALUES(descripcion),
       anios_experiencia = VALUES(anios_experiencia), servicios = VALUES(servicios), foto = VALUES(foto)`,
    [req.usuario.uid, req.usuario.nombre, descripcion, anios, servicios.join(','), foto]
  );

  res.json({ ok: true });
});

/** GET /api/empleadas/:uid/resenas → reseñas de la empleada, las más nuevas primero */
empleadas.get('/:uid/resenas', async (req, res) => {
  const filas = await consultar(
    `SELECT r.*, s.fecha AS fecha_trabajo
       FROM resenas r
       JOIN solicitudes s ON s.id = r.solicitud_id
      WHERE r.empleada_uid = ?
      ORDER BY r.creada DESC`,
    [req.params.uid]
  );

  res.json(filas.map(r => ({
    id: String(r.id),
    clienteNombre: r.cliente_nombre,
    puntaje: r.puntaje,
    comentario: r.comentario,
    fechaTrabajo: r.fecha_trabajo,
    creada: r.creada ? r.creada.replace(' ', 'T') : undefined,
  })));
});

// ===========================================================================
//  RESEÑAS   →  /api/resenas
// ===========================================================================
const resenas = express.Router();

/**
 * POST /api/resenas → el cliente califica un trabajo FINALIZADO.
 * Body: { solicitudId, puntaje (1 a 5), comentario }
 */
resenas.post('/', soloTipos('cliente'), async (req, res) => {
  const { solicitudId, comentario } = req.body || {};
  const puntaje = Number.parseInt(req.body?.puntaje, 10);

  if (!(puntaje >= 1 && puntaje <= 5)) {
    return res.status(400).json({ error: 'El puntaje tiene que ser de 1 a 5 estrellas.' });
  }

  const [solicitud] = await consultar('SELECT * FROM solicitudes WHERE id = ?', [solicitudId]);
  if (!solicitud) return res.status(404).json({ error: 'La solicitud no existe.' });
  if (solicitud.cliente_uid !== req.usuario.uid) return res.status(403).json({ error: 'Esta solicitud no es tuya.' });
  if (solicitud.estado !== 'finalizada') {
    return res.status(409).json({ error: 'Solo podés calificar trabajos finalizados.' });
  }

  try {
    await consultar(
      `INSERT INTO resenas (solicitud_id, empleada_uid, cliente_uid, cliente_nombre, puntaje, comentario)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [solicitud.id, solicitud.empleada_uid, req.usuario.uid, req.usuario.nombre,
        puntaje, String(comentario ?? '').trim().slice(0, 500)]
    );
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya calificaste este trabajo.' });
    throw e;
  }

  res.status(201).json({ ok: true });
});

module.exports = { empleadas, resenas };