import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink , Router } from '@angular/router';
import Swal from 'sweetalert2';
import { SolicitudEmpleada } from '../services/solicitud-empleada';

@Component({
  selector: 'app-solicitud-servicio',
  imports: [FormsModule,RouterLink],
  templateUrl: './solicitud-servicio.html',
  styleUrl: './solicitud-servicio.css',
})
export class SolicitudServicio {
  constructor(
  private router: Router,
  private solicitudService: SolicitudEmpleada
) {}

nombre = '';
  apellido = '';
  correo = '';
  telefono = '';
  direccion = '';
  requerimientos = '';

  planchar = false;
  lavar = false;
  cocina = false;
  cuidadoNinos = false;
  camaAdentro = false;

  fecha = '';
  horario = '';
  frecuencia = '';


  servicios = [
    'Planchar',
    'Lavar',
    'Cocinar',
    'Cuidado de niños',
    'Limpieza cama adentro'
  ];
   textoBusqueda = '';

  get serviciosFiltrados() {
    return this.servicios.filter(servicio =>
      servicio.toLowerCase().includes(this.textoBusqueda.toLowerCase())
    );

   
  }

  contactar() { // TOY GUARDADNDO EL FORMULARIO EN EL LOCALSTORAGE
  console.log('Nombre:', this.nombre);
  console.log('Apellido:', this.apellido);
  console.log('Dirección:', this.direccion);
  console.log('Requerimientos:', this.requerimientos);
  console.log('Frecuencia:', this.frecuencia);
  console.log('Fecha:', this.fecha);
  console.log('Horario:', this.horario);

if (
    !this.frecuencia ||
    !this.nombre.trim() ||
    !this.apellido.trim() ||
    !this.direccion.trim() ||
    !this.requerimientos.trim() ||
    !this.fecha.trim()||
    !this.horario.trim()
   
  )
  {
    Swal.fire({
      title: 'Campos incompletos',
      text: 'Debe completar todos los campos obligatorios',
      icon: 'warning',
      confirmButtonColor: '#f39c12'
    });

    return;
  }

  const solicitud = {
  nombre: this.nombre,
  apellido: this.apellido,
  correo: this.correo,
  telefono: this.telefono,
  direccion: this.direccion,
  requerimientos: this.requerimientos,
  planchar: this.planchar,
  lavar: this.lavar,
  cocina: this.cocina,
  cuidadoNinos: this.cuidadoNinos,
  camaAdentro: this.camaAdentro,
  fecha: this.fecha,
  horario: this.horario,
  frecuencia: this.frecuencia
};

this.solicitudService.agregarSolicitud(solicitud);

console.log('Solicitud guardada:', solicitud)

    Swal.fire({
  title: '¡Solicitud enviada!',
  text: 'Tu pedido fue registrado correctamente.',
  icon: 'success',
  confirmButtonText: 'Aceptar',
  confirmButtonColor: '#58c69d'
}).then(() => {
  this.router.navigate(['/']);
});
  }

}
