import { Component, Pipe, PipeTransform } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { MenuSesion } from '../menu-sesion/menu-sesion';
import { descargarCsv, nombreConFecha } from '../services/csv';

/** Cómo es cada profesional del catálogo */
interface Profesional {
  nombre: string;
  foto: string;
  zona: string;
  experiencia: string;
  oficio: string;
  opiniones: number;
  comentario: string;
}

/**
 * PIPE PROPIO: filtra una lista según un texto de búsqueda.
 *
 * Uso en el HTML:
 *   @for (p of profesionales | filtrar: textoBusqueda : camposBusqueda; track $index) { ... }
 *
 *   - lista  → lo que está a la izquierda del |
 *   - texto  → lo que escribió el usuario
 *   - campos → (opcional) en qué propiedades buscar. Si no se indica, busca en todas.
 *
 * No distingue mayúsculas ni acentos: "ninera" encuentra "Niñera".
 */
@Pipe({
  name: 'filtrar',
})
export class FiltrarPipe implements PipeTransform {

  transform<T>(lista: T[] | null | undefined, texto: string | null | undefined, campos: (keyof T)[] = []): T[] {
    if (!lista) return [];

    const buscado = normalizar(texto ?? '');
    if (!buscado) return lista; // sin texto, se muestra todo

    return lista.filter(item => {
      const valores = campos.length
        ? campos.map(campo => item[campo])
        : Object.values(item as object);

      return valores.some(valor => normalizar(String(valor ?? '')).includes(buscado));
    });
  }
}

/** Pasa a minúsculas y saca los acentos, para comparar sin importar cómo se escribió */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

@Component({
  selector: 'app-empleadas',
  imports: [MenuSesion, FormsModule, RouterLink, TitleCasePipe, FiltrarPipe],
  templateUrl: './empleadas.html',
  styleUrl: './empleadas.css',
})
export class Empleadas {

  textoBusqueda = '';

  /** En qué campos busca el pipe "filtrar" */
  camposBusqueda: (keyof Profesional)[] = ['nombre', 'oficio', 'zona'];

  profesionales: Profesional[] = [
    {
      nombre: 'Antonia Cespedes',
      foto: 'usuario-1.png',
      zona: 'Capital Federal',
      experiencia: '4 años',
      oficio: 'Niñera',
      opiniones: 141,
      comentario: 'Trabajo rápido y eficiente'
    },
    {
      nombre: 'Emilia Torres',
      foto: 'usuario-2.png',
      zona: 'GBA Sur',
      experiencia: '5 años',
      oficio: 'Limpieza General',
      opiniones: 140,
      comentario: 'Excelente profesional'
    },
    {
      nombre: 'Juan Carlos Rocha',
      foto: 'usuario-3.png',
      zona: 'Cordoba , Capital',
      experiencia: '17 años',
      oficio: 'Electricista',
      opiniones: 290,
      comentario: 'Responsable, trabaja bien'
    },
    {
      nombre: 'Juan Carlos Rocha',
      foto: 'usuario-4.png',
      zona: 'Avellaneda',
      experiencia: '7 años',
      oficio: 'Electricista',
      opiniones: 100,
      comentario: 'Muy recomendable'
    },
    {
      nombre: 'Ramona Perez',
      foto: 'usuario-5.png',
      zona: 'Capital Federal',
      experiencia: '9 años',
      oficio: 'Cocina',
      opiniones: 90,
      comentario: 'Prudente y honesta'
    },
    {
      nombre: 'Ambar Casalnovo',
      foto: 'usuario-5.png',
      zona: 'Tortuguita',
      experiencia: '2 años',
      oficio: 'Niñera',
      opiniones: 190,
      comentario: 'Muy confiable y eficaz'
    }
  ];

  /** Para el CSV: se reutiliza el mismo pipe desde el código */
  get profesionalesFiltrados(): Profesional[] {
    return new FiltrarPipe().transform(this.profesionales, this.textoBusqueda, this.camposBusqueda);
  }

  /** Descarga el catálogo de profesionales (lo que se ve en pantalla, con la búsqueda aplicada) */
  descargarCatalogo() {
    descargarCsv(nombreConFecha('catalogo-profesionales'), [
      { titulo: 'Nombre', valor: (p: Profesional) => p.nombre },
      { titulo: 'Oficio', valor: (p: Profesional) => p.oficio },
      { titulo: 'Zona', valor: (p: Profesional) => p.zona },
      { titulo: 'Experiencia', valor: (p: Profesional) => p.experiencia },
      { titulo: 'Opiniones', valor: (p: Profesional) => p.opiniones },
      { titulo: 'Comentario', valor: (p: Profesional) => p.comentario },
    ], this.profesionalesFiltrados);
  }
}