import { MenuSesion } from '../menu-sesion/menu-sesion';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';
import { SolicitudesApiService } from '../services/solicitudes-api';
import { DatosSolicitud } from '../services/solicitudes';
import { SoloNumeros } from '../solo-numeros';

/**
 * Formulario de ALTA y MODIFICACIÓN de solicitudes.
 *  - /solicitud-servicio      → alta (POST a la API)
 *  - /solicitud-servicio/:id  → modificación (GET para cargarla y PATCH para guardar)
 */
@Component({
  selector: 'app-solicitud-servicio',
  imports: [MenuSesion, FormsModule, RouterLink, SoloNumeros],
  templateUrl: './solicitud-servicio.html',
  styleUrl: './solicitud-servicio.css',
})
export class SolicitudServicio implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private api = inject(SolicitudesApiService);

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

  /** Si tiene valor, estamos editando esa solicitud */
  idEdicion: string | null = null;

  ngOnInit() {
    this.idEdicion = this.route.snapshot.paramMap.get('id');

    if (this.idEdicion) {
      this.cargarParaEditar(this.idEdicion);
    } else {
      // Alta: completamos con los datos del cliente logueado
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
  }

  /** GET: trae la solicitud de la API y llena el formulario */
  private cargarParaEditar(id: string) {
    this.api.obtener(id).subscribe({
      next: s => {
        if (s.estado !== 'pendiente') {
          Swal.fire({
            icon: 'info',
            title: 'No se puede editar',
            text: 'Esta solicitud ya fue tomada por una empleada. Coordiná los cambios por el chat.',
            confirmButtonColor: '#58c69d',
          });
          this.router.navigate(['/mis-solicitudes']);
          return;
        }
        Object.assign(this, {
          nombre: s.nombre, apellido: s.apellido, correo: s.correo, telefono: s.telefono,
          direccion: s.direccion, requerimientos: s.requerimientos,
          planchar: s.planchar, lavar: s.lavar, cocina: s.cocina,
          cuidadoNinos: s.cuidadoNinos, camaAdentro: s.camaAdentro,
          fecha: s.fecha, horario: s.horario, frecuencia: s.frecuencia,
        });
      },
      error: e => {
        Swal.fire({ icon: 'error', title: 'Error', text: this.api.mensajeDeError(e), confirmButtonColor: '#e74c3c' });
        this.router.navigate(['/mis-solicitudes']);
      },
    });
  }

  contactar() {
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

    const datos: DatosSolicitud = {
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
    };

    const pedido = this.idEdicion
      ? this.api.actualizar(this.idEdicion, datos)   // PATCH
      : this.api.crear(
         datos);          // POST

    pedido.subscribe({
      next: async () => {
        this.enviando = false;
        await Swal.fire({
          title: this.idEdicion ? '¡Solicitud actualizada!' : '¡Solicitud enviada!',
          text: this.idEdicion
            ? 'Los cambios se guardaron correctamente.'
            : 'Cuando una empleada tome tu pedido, vas a poder chatear con ella desde "Mensajes".',
          icon: 'success',
          confirmButtonText: 'Ver mis solicitudes',
          confirmButtonColor: '#58c69d'
        });
        this.router.navigate(['/mis-solicitudes']);
      },
      error: e => {
        this.enviando = false;
        Swal.fire({ title: 'Error', text: this.api.mensajeDeError(e), icon: 'error', confirmButtonColor: '#e74c3c' });
      },
    });
  }
}