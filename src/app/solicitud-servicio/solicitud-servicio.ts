import { MenuSesion } from '../menu-sesion/menu-sesion';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
   import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';
import { SolicitudesService } from '../services/solicitudes';


@Component({
  selector: 'app-solicitud-servicio',
      imports: [MenuSesion, FormsModule],
  templateUrl: './solicitud-servicio.html',
  styleUrl: './solicitud-servicio.css',
})
export class SolicitudServicio implements OnInit {
  constructor(
    private router: Router,
    private auth: AuthService,
    private solicitudes: SolicitudesService
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

  enviando = false;

  ngOnInit() {
    // Completamos con los datos del cliente logueado
    const u = this.auth.usuarioActual();
    if (u) {
      this.nombre = u.nombre;
      this.apellido = u.apellido;
      this.correo = u.email;
      if (u.tipo === 'cliente') {
        this.telefono = u.telefono;
        this.direccion = u.direccion;
      }
    }
  }

  async contactar() {
    if (
      !this.frecuencia ||
      !this.nombre.trim() ||
      !this.apellido.trim() ||
      !this.direccion.trim() ||
      !this.requerimientos.trim() ||
      !this.fecha.trim() ||
      !this.horario.trim()
    ) {
      Swal.fire({
        title: 'Campos incompletos',
        text: 'Debe completar todos los campos obligatorios',
        icon: 'warning',
        confirmButtonColor: '#f39c12'
      });
      return;
    }

    const cliente = this.auth.usuarioActual();
    if (!cliente || this.enviando) return;
    this.enviando = true;

    try {
      // Se guarda en Firestore: la ven todas las empleadas
      await this.solicitudes.crear(cliente, {
        nombre: this.nombre.trim(),
        apellido: this.apellido.trim(),
        correo: this.correo.trim(),
        telefono: String(this.telefono),
        direccion: this.direccion.trim(),
        requerimientos: this.requerimientos.trim(),
        planchar: this.planchar,
        lavar: this.lavar,
        cocina: this.cocina,
        cuidadoNinos: this.cuidadoNinos,
        camaAdentro: this.camaAdentro,
        fecha: this.fecha,
        horario: this.horario,
        frecuencia: this.frecuencia,
      });

      await Swal.fire({
        title: '¡Solicitud enviada!',
        text: 'Cuando una empleada tome tu pedido, vas a poder chatear con ella desde "Mensajes".',
        icon: 'success',
        confirmButtonText: 'Ver mis solicitudes',
        confirmButtonColor: '#58c69d'
      });
      this.router.navigate(['/chats']);

    } catch (e) {
      Swal.fire({
        title: 'Error',
        text: this.solicitudes.mensajeDeError(e),
        icon: 'error',
        confirmButtonColor: '#e74c3c'
      });
    } finally {
      this.enviando = false;
    }
  }
}
