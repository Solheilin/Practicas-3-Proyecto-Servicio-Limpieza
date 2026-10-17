import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { MenuSesion } from '../menu-sesion/menu-sesion';
import { AuthService } from '../services/auth';
import { SolicitudesApiService } from '../services/solicitudes-api';
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
  private auth = inject(AuthService);

  solicitudes = signal<Solicitud[]>([]);
  cargando = signal(true);
  error = signal('');
  filtro = signal<Filtro>('todas');

  serviciosDe = serviciosDe;

  etiquetas: Record<EstadoSolicitud, string> = {
    pendiente: 'Esperando empleada',
    tomada: 'Tomada',
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

  /** LISTADO: pide las solicitudes a la API */
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
  };
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
        this.cargar(); 
      },
    });
  }
}