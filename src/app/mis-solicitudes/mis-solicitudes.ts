import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { MenuSesion } from '../menu-sesion/menu-sesion';
import { AuthService } from '../services/auth';
import { SolicitudesApiService } from '../services/solicitudes-api';
import { PerfilesApiService } from '../services/perfiles-api';
import { EstadoSolicitud, Solicitud, serviciosDe } from '../services/solicitudes';
import { descargarCsv, nombreConFecha } from '../services/csv';

type Filtro = 'todas' | EstadoSolicitud;

/** LISTADO y BAJA de las solicitudes del cliente (el alta y la modificación están en solicitud-servicio). */
@Component({
  selector: 'app-mis-solicitudes',
  imports: [MenuSesion, RouterLink, DatePipe],
  templateUrl: './mis-solicitudes.html',
  styleUrl: './mis-solicitudes.css',
})
export class MisSolicitudes implements OnInit {
  private api = inject(SolicitudesApiService);
  private perfiles = inject(PerfilesApiService);
  private auth = inject(AuthService);

  solicitudes = signal<Solicitud[]>([]);
  cargando = signal(true);
  error = signal('');
  filtro = signal<Filtro>('todas');

  serviciosDe = serviciosDe;

  etiquetas: Record<EstadoSolicitud, string> = {
    pendiente: 'Esperando empleada',
    tomada: 'Tomada',
    finalizada: 'Finalizada',
    cancelada: 'Cancelada',
  };

  filtradas = computed(() => {
    const f = this.filtro();
    return f === 'todas' ? this.solicitudes() : this.solicitudes().filter(s => s.estado === f);
  });

  cantidad = (estado: EstadoSolicitud) => this.solicitudes().filter(s => s.estado === estado).length;

  ngOnInit() {
    this.cargar();
  }

  /** LISTADO: pide las solicitudes al backend (GET /api/solicitudes/mias) */
  cargar() {
    const u = this.auth.usuarioActual();
    if (!u) return;

    this.cargando.set(true);
    this.error.set('');

    this.api.listarMias().subscribe({
      next: lista => {
        this.solicitudes.set(lista);
        this.cargando.set(false);
      },
      error: e => {
        this.error.set(this.api.mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  /** Descarga a CSV las solicitudes que se ven en pantalla (con el filtro aplicado) */
  descargarCsv() {
    descargarCsv(nombreConFecha('mis-solicitudes'), [
      { titulo: 'Fecha del servicio', valor: (s: Solicitud) => s.fecha.split('-').reverse().join('/') },
      { titulo: 'Horario', valor: (s: Solicitud) => s.horario },
      { titulo: 'Frecuencia', valor: (s: Solicitud) => s.frecuencia },
      { titulo: 'Servicios', valor: (s: Solicitud) => serviciosDe(s) },
      { titulo: 'Dirección', valor: (s: Solicitud) => s.direccion },
      { titulo: 'Requerimientos', valor: (s: Solicitud) => s.requerimientos },
      { titulo: 'Estado', valor: (s: Solicitud) => this.etiquetas[s.estado] },
      { titulo: 'Empleada', valor: (s: Solicitud) => s.empleadaNombre ?? '' },
      { titulo: 'Pedida el', valor: (s: Solicitud) => s.creada },
    ], this.filtradas());
  }

  /** El cliente califica un trabajo finalizado (POST /api/resenas) */
  async calificar(s: Solicitud) {
    const { value } = await Swal.fire({
      title: `Calificá a ${s.empleadaNombre ?? 'la empleada'}`,
      html: `
        <div class="calificar-swal">
          <div class="estrellas-swal">
            ${[5, 4, 3, 2, 1].map(n => `
              <input type="radio" name="puntaje" id="estrella-${n}" value="${n}">
              <label for="estrella-${n}" title="${n} estrellas">★</label>`).join('')}
          </div>
          <textarea id="comentario-swal" class="swal2-textarea" maxlength="500"
                    placeholder="Contanos cómo fue el trabajo (opcional)"></textarea>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Enviar reseña',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#58c69d',
      focusConfirm: false,
      preConfirm: () => {
        const elegida = document.querySelector<HTMLInputElement>('input[name="puntaje"]:checked');
        if (!elegida) {
          Swal.showValidationMessage('Elegí de 1 a 5 estrellas');
          return false;
        }
        const comentario = (document.getElementById('comentario-swal') as HTMLTextAreaElement).value;
        return { puntaje: Number(elegida.value), comentario };
      },
    });
    if (!value) return;

    this.perfiles.calificar(s.id, value.puntaje, value.comentario).subscribe({
      next: () => {
        this.solicitudes.update(lista => lista.map(x => (x.id === s.id ? { ...x, resenada: true } : x)));
        Swal.fire({ icon: 'success', title: '¡Gracias por tu reseña!', confirmButtonColor: '#58c69d' });
      },
      error: e => Swal.fire({ icon: 'error', title: 'No se pudo enviar', text: this.perfiles.mensajeDeError(e), confirmButtonColor: '#e74c3c' }),
    });
  }

  /** BAJA: DELETE al backend */
  async eliminar(s: Solicitud) {
    const r = await Swal.fire({
      title: '¿Eliminar solicitud?',
      html: `Se va a borrar tu solicitud de <b>${serviciosDe(s)}</b> del
             <b>${s.fecha.split('-').reverse().join('/')}</b>. Las empleadas ya no la van a ver.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e74c3c',
    });
    if (!r.isConfirmed) return;

    this.api.eliminar(s.id).subscribe({
      next: () => {
        this.solicitudes.update(lista => lista.filter(x => x.id !== s.id));
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Solicitud eliminada', showConfirmButton: false, timer: 2500 });
      },
      error: e => {
        Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: this.api.mensajeDeError(e), confirmButtonColor: '#e74c3c' });
        this.cargar(); // por si una empleada la tomó mientras tanto
      },
    });
  }
}