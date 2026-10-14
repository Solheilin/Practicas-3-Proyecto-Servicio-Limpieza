import { MenuSesion } from '../menu-sesion/menu-sesion';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Unsubscribe } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';
import { Solicitud, SolicitudesService } from '../services/solicitudes';

@Component({
  selector: 'app-lista-solicitudes',
  standalone: true,
  imports: [MenuSesion, DatePipe],
  templateUrl: './lista-solicitudes.html',
  styleUrl: './lista-solicitudes.css'
})
export class ListaSolicitudesComponent implements OnInit, OnDestroy {
  private solicitudesService = inject(SolicitudesService);
  private auth = inject(AuthService);
  private router = inject(Router);

  solicitudes = signal<Solicitud[]>([]);
  cargando = signal(true);
  error = signal('');
  /** id de la solicitud que se está tomando (para deshabilitar su botón) */
  tomando = signal<string | null>(null);

  private desuscribir?: Unsubscribe;

  ngOnInit(): void {
    // Lista en tiempo real: si otra empleada toma un trabajo, desaparece solo
    this.desuscribir = this.solicitudesService.escucharPendientes(
      lista => {
        this.solicitudes.set(lista);
        this.cargando.set(false);
      },
      e => {
        this.error.set(this.solicitudesService.mensajeDeError(e));
        this.cargando.set(false);
      }
    );
  }

  ngOnDestroy(): void {
    this.desuscribir?.();
  }

  async tomarTrabajo(solicitud: Solicitud) {
    const empleada = this.auth.usuarioActual();
    if (!empleada) return;

    const r = await Swal.fire({
      title: '¿Tomar este trabajo?',
      html: `Te vas a comprometer con <b>${solicitud.nombre} ${solicitud.apellido}</b> para el
             <b>${solicitud.fecha.split('-').reverse().join('/')}</b> (${solicitud.horario}).<br><br>
             Se va a abrir un chat para que coordinen los detalles.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, tomarlo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#58c69d',
    });
    if (!r.isConfirmed) return;

    this.tomando.set(solicitud.id);
    try {
      const chatId = await this.solicitudesService.tomar(solicitud, empleada);

      await Swal.fire({
        icon: 'success',
        title: '¡Trabajo tomado!',
        text: 'Ahora podés escribirle al cliente para coordinar.',
        confirmButtonText: 'Ir al chat',
        confirmButtonColor: '#58c69d',
      });
      this.router.navigate(['/chats', chatId]);

    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo tomar',
        text: this.solicitudesService.mensajeDeError(e),
        confirmButtonColor: '#e74c3c',
      });
    } finally {
      this.tomando.set(null);
    }
  }
}
