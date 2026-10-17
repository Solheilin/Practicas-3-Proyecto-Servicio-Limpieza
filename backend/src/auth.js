const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Solo hace falta el id del proyecto para VERIFICAR tokens (no se necesita clave privada)
const projectId = process.env.FIREBASE_PROJECT_ID;
initializeApp({ projectId });

/**
 * Lee el tipo de usuario (cliente / empleada / admin) desde su perfil de Firestore.
 * Se usa el MISMO token del usuario, así que las reglas de Firestore siguen aplicando.
 */
async function obtenerTipo(uid, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/usuarios/${uid}`;
  const respuesta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!respuesta.ok) return null;

  const perfil = await respuesta.json();
  const f = perfil.fields || {};
  if (f.activo?.booleanValue === false) return null; // cuenta desactivada por el admin

  return {
    tipo: f.tipo?.stringValue || null,
    nombre: `${f.nombre?.stringValue || ''} ${f.apellido?.stringValue || ''}`.trim(),
  };
}

/**
 * Middleware: exige el header "Authorization: Bearer <token de Firebase>".
 * Si es válido, deja en req.usuario = { uid, email, tipo, nombre }.
 */
async function requiereLogin(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de inicio de sesión.' });
  }

  try {
    const datos = await getAuth().verifyIdToken(token);
    const perfil = await obtenerTipo(datos.uid, token);

    if (!perfil?.tipo) {
      return res.status(403).json({ error: 'Tu cuenta no tiene un perfil activo.' });
    }

    req.usuario = { uid: datos.uid, email: datos.email, ...perfil };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o vencido. Volvé a iniciar sesión.' });
  }
}

/** Middleware: solo deja pasar a los tipos indicados. Ej: soloTipos('cliente') */
function soloTipos(...tipos) {
  return (req, res, next) => {
    if (!tipos.includes(req.usuario?.tipo)) {
      return res.status(403).json({ error: 'No tenés permiso para esta operación.' });
    }
    next();
  };
}

module.exports = { requiereLogin, soloTipos };
