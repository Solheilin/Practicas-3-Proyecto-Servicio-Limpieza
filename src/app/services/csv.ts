/**
 * Exportación a CSV reutilizable.
 *
 * Ejemplo de uso:
 *   descargarCsv('catalogo.csv', [
 *     { titulo: 'Nombre', valor: p => p.nombre },
 *     { titulo: 'Zona',   valor: p => p.zona },
 *   ], listaDeProfesionales);
 */

/** Una columna del CSV: el título del encabezado y cómo sacar el valor de cada fila. */
export interface ColumnaCsv<T> {
  titulo: string;
  valor: (fila: T) => unknown;
}

// Excel en español (Argentina) separa columnas con punto y coma.
// Con coma, Excel mete todo en una sola columna.
const SEPARADOR = ';';

/** Arma el texto CSV y lo descarga como archivo. */
export function descargarCsv<T>(nombreArchivo: string, columnas: ColumnaCsv<T>[], filas: T[]): void {
  const encabezado = columnas.map(c => escapar(c.titulo)).join(SEPARADOR);
  const lineas = filas.map(fila => columnas.map(c => escapar(c.valor(fila))).join(SEPARADOR));
  const contenido = [encabezado, ...lineas].join('\r\n');

  // El "\uFEFF" (BOM) hace que Excel muestre bien los acentos y las ñ
  const archivo = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });

  // Se crea un link invisible, se "hace clic" y se borra
  const url = URL.createObjectURL(archivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Nombre de archivo con la fecha de hoy, ej: "catalogo-2026-10-17.csv" */
export function nombreConFecha(base: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  return `${base}-${hoy}.csv`;
}

/**
 * Convierte un valor a texto seguro para CSV:
 * - true/false → Sí/No
 * - fechas → dd/mm/aaaa
 * - si tiene ; " o saltos de línea, lo encierra entre comillas
 */
function escapar(valor: unknown): string {
  let texto: string;

  if (valor === null || valor === undefined) texto = '';
  else if (typeof valor === 'boolean') texto = valor ? 'Sí' : 'No';
  else if (valor instanceof Date) texto = valor.toLocaleDateString('es-AR');
  else texto = String(valor);

  if (/[";\r\n]/.test(texto)) {
    texto = '"' + texto.replace(/"/g, '""') + '"';
  }
  return texto;
}