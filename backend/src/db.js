const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const nombreBase = process.env.DB_NAME || 'limpieza';

/** Pool de conexiones a MySQL (se crea en iniciarBase) */
let pool;

/**
 * Crea la base y la tabla si no existen, y abre el pool de conexiones.
 * Así no hace falta correr el SQL a mano.
 */
async function iniciarBase() {
  // 1) Conexión sin base para poder crearla
  const conexion = await mysql.createConnection({ ...config, multipleStatements: true });
  const schema = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8')
    .replace(/\blimpieza\b/g, nombreBase); // por si usás otro nombre de base
  await conexion.query(schema);
  await conexion.end();

  // 2) Pool contra la base ya creada
  pool = mysql.createPool({
    ...config,
    database: nombreBase,
    connectionLimit: 10,
    dateStrings: true, // las fechas llegan como texto ("2026-10-17"), sin líos de zona horaria
  });

  console.log(`✔ Conectado a MySQL (${config.host}:${config.port}/${nombreBase})`);
}

/** Ejecuta una consulta con parámetros (?) para evitar inyección SQL. */
async function consultar(sql, parametros = []) {
  const [resultado] = await pool.execute(sql, parametros);
  return resultado;
}

module.exports = { iniciarBase, consultar };
