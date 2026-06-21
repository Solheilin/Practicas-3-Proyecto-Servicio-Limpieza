import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empleadas',
  imports: [FormsModule,RouterLink],
  templateUrl: './empleadas.html',
  styleUrl: './empleadas.css',
})
export class Empleadas {

textoBusqueda = '';

  profesionales = [
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

  get profesionalesFiltrados() {
    return this.profesionales.filter(p =>
      p.nombre.toLowerCase().includes(this.textoBusqueda.toLowerCase())
    );
  }

}
