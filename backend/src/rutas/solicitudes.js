const express = require('express');
const { consultar } = require('../db');
const { soloTipos } = require('../auth');

const router = express.Router();

function aJson(fila) {
  return {
    id: String(fila.id),
    clienteUid: fila.cliente_uid,
    nombre: fila.nombre,
    apellido: fila.apellido,
    correo: fila.correo,
    telefono: fila.telefono,
    direccion: fila.direccion,
    requerimientos: fila.requerimientos,
    planchar: !!fila.planchar,
    lavar: !!fila.lavar,
    cocina: !!fila.cocina,
    cuidadoNinos: !!fila.cuidado_ninos,
    camaAdentro: !!fila.cama_adentro,
    fecha: fila.fecha,
    horario: fila.horario,
    frecuencia: fila.frecuencia,
    estado: fila.estado,
    empleadaUid: fila.empleada_uid || undefined,
    empleadaNombre: fila.empleada_nombre || undefined,
    finalizadaEn: fila.finalizada_en ? fila.finalizada_en.replace(' ', 'T') : undefined,
    creada: fila.creada ? fila.creada.replace(' ', 'T') : undefined,
  };
}

/**
 * Valida el cuerpo de un alta o modificación.
 * Devuelve { datos } si está todo bien, o { error } con el motivo.
 */
function validar(body = {}) {
  const texto = (campo, max) => String(body[campo] ?? '').trim().slice(0, max);

  const datos = {
    nombre: texto('nombre', 80),
    apellido: texto('apellido', 80),
    correo: texto('correo', 120),
    telefono: texto('telefono', 20),
    direccion: texto('direccion', 200),
    requerimientos: texto('requerimientos', 2000),
    planchar: body.planchar === true,
    lavar: body.lavar === true,
    cocina: body.cocina === true,
    cuidado_ninos: body.cuidadoNinos === true,
    cama_adentro: body.camaAdentro === true,
    fecha: texto('fecha', 10),
    horario: texto('horario', 30),
    frecuencia: texto('frecuencia', 40),
  };

  const obligatorios = ['nombre', 'apellido', 'correo', 'telefono', 'direccion', 'requerimientos', 'fecha', 'horario', 'frecuencia'];
  const faltantes = obligatorios.filter(c => !datos[c]);
  if (faltantes.length) return { error: `Faltan campos obligatorios: ${faltantes.join(', ')}` };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) return { error: 'La fecha debe tener el formato AAAA-MM-DD.' };
  if (!/^\S+@\S+\.\S+$/.test(datos.correo)) return { error: 'El correo no es válido.' };

  return { datos };
}

const COLUMNAS = ['nombre', 'apellido', 'correo', 'telefono', 'direccion', 'requerimientos',
  'planchar', 'lavar', 'cocina', 'cuidado_ninos', 'cama_adentro', 'fecha', 'horario', 'frecuencia'];


async function buscar(id) {
  const filas = await consultar('SELECT * FROM solicitudes WHERE id = ?', [id]);
  return filas[0] || null;
}


router.get('/', soloTipos('admin'), async (req, res) => {
  const filas = await consultar('SELECT * FROM solicitudes ORDER BY creada DESC');
  res.json(filas.map(aJson));
});


router.get('/mias', soloTipos('cliente'), async (req, res) => {
  const filas = await consultar(
    'SELECT * FROM solicitudes WHERE cliente_uid = ? ORDER BY creada DESC',
    [req.usuario.uid]
  );
  res.json(filas.map(aJson));
});


router.get('/pendientes', soloTipos('empleada', 'admin'), async (req, res) => {
  const filas = await consultar(
    "SELECT * FROM solicitudes WHERE estado = 'pendiente' ORDER BY creada ASC"
  );
  res.json(filas.map(aJson));
});


router.get('/tomadas', soloTipos('empleada'), async (req, res) => {
  const filas = await consultar(
    "SELECT * FROM solicitudes WHERE empleada_uid = ? AND estado IN ('tomada', 'finalizada') ORDER BY fecha DESC",
    [req.usuario.uid]
  );
  res.json(filas.map(aJson));
});


router.get('/:id', async (req, res, next) => {
  // Si no es un número (por ej. "tomadas"), no es un id: sigue con la próxima ruta
  if (!/^\d+$/.test(req.params.id)) return next();

  const fila = await buscar(req.params.id);
  if (!fila) return res.status(404).json({ error: 'La solicitud no existe.' });

  const { uid, tipo } = req.usuario;
  const puedeVer = fila.cliente_uid === uid || fila.empleada_uid === uid || tipo === 'admin'
    || (tipo === 'empleada' && fila.estado === 'pendiente');
  if (!puedeVer) return res.status(403).json({ error: 'No tenés permiso para ver esta solicitud.' });

  res.json(aJson(fila));
});


router.post('/', soloTipos('cliente'), async (req, res) => {
  const { datos, error } = validar(req.body);
  if (error) return res.status(400).json({ error });

  const resultado = await consultar(
    `INSERT INTO solicitudes (cliente_uid, ${COLUMNAS.join(', ')})
     VALUES (?, ${COLUMNAS.map(() => '?').join(', ')})`,
    [req.usuario.uid, ...COLUMNAS.map(c => datos[c])]
  );

  res.status(201).json(aJson(await buscar(resultado.insertId)));
});


router.put('/:id', soloTipos('cliente'), async (req, res) => {
  const fila = await buscar(req.params.id);
  if (!fila) return res.status(404).json({ error: 'La solicitud no existe.' });
  if (fila.cliente_uid !== req.usuario.uid) return res.status(403).json({ error: 'Esta solicitud no es tuya.' });
  if (fila.estado !== 'pendiente') {
    return res.status(409).json({ error: 'La solicitud ya fue tomada por una empleada y no se puede modificar.' });
  }

  const { datos, error } = validar(req.body);
  if (error) return res.status(400).json({ error });

  await consultar(
    `UPDATE solicitudes SET ${COLUMNAS.map(c => `${c} = ?`).join(', ')}
     WHERE id = ? AND estado = 'pendiente'`,
    [...COLUMNAS.map(c => datos[c]), fila.id]
  );

  res.json(aJson(await buscar(fila.id)));
});


router.post('/:id/tomar', soloTipos('empleada'), async (req, res) => {
  const resultado = await consultar(
    `UPDATE solicitudes SET estado = 'tomada', empleada_uid = ?, empleada_nombre = ?
     WHERE id = ? AND estado = 'pendiente'`,
    [req.usuario.uid, req.usuario.nombre, req.params.id]
  );

  if (resultado.affectedRows === 0) {
    const fila = await buscar(req.params.id);
    if (!fila) return res.status(404).json({ error: 'La solicitud no existe.' });
    return res.status(409).json({ error: 'Otra empleada tomó este trabajo antes que vos.' });
  }

  res.json(aJson(await buscar(req.params.id)));
});


router.post('/:id/finalizar', soloTipos('empleada'), async (req, res) => {
  const fila = await buscar(req.params.id);
  if (!fila) return res.status(404).json({ error: 'La solicitud no existe.' });
  if (fila.empleada_uid !== req.usuario.uid) return res.status(403).json({ error: 'Este trabajo no es tuyo.' });
  if (fila.estado === 'finalizada') return res.status(409).json({ error: 'Este trabajo ya estaba finalizado.' });
  if (fila.estado !== 'tomada') return res.status(409).json({ error: 'Solo se puede finalizar un trabajo tomado.' });

  await consultar(
    "UPDATE solicitudes SET estado = 'finalizada', finalizada_en = NOW() WHERE id = ? AND estado = 'tomada'",
    [fila.id]
  );
  res.json(aJson(await buscar(fila.id)));
});


router.delete('/:id', soloTipos('cliente', 'admin'), async (req, res) => {
  const fila = await buscar(req.params.id);
  if (!fila) return res.status(404).json({ error: 'La solicitud no existe.' });

  if (req.usuario.tipo === 'cliente') {
    if (fila.cliente_uid !== req.usuario.uid) return res.status(403).json({ error: 'Esta solicitud no es tuya.' });
    if (fila.estado !== 'pendiente') {
      return res.status(409).json({ error: 'La solicitud ya fue tomada por una empleada y no se puede eliminar.' });
    }
  }

  await consultar('DELETE FROM solicitudes WHERE id = ?', [fila.id]);
  res.status(204).end();
});

module.exports = router;
