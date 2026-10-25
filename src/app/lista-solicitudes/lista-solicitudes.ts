import { MenuSesion } from '../menu-sesion/menu-sesion';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';
import { Solicitud, serviciosDe } from '../services/solicitudes';
import { SolicitudesApiService } from '../services/solicitudes-api';
import { Chat, ChatService } from '../services/chat';
import { Unsubscribe } from 'firebase/firestore';
import { descargarCsv, nombreConFecha } from '../services/csv';

type Vista = 'disponibles' | 'mios';

/** Un trabajo del historial de la empleada (se arma con los datos de su chat) */
interface Trabajo {
  id: string;
  cliente: string;
  fecha: string;       // 'aaaa-mm-dd'
  horario: string;
  frecuencia: string;
  direccion: string;
  servicios: string;
  finalizado: boolean;
}
type FiltroHistorial = 'enCurso' | 'finalizados' | 'todos';

/**
 * Página de la EMPLEADA, con dos pestañas:
 *  - Disponibles  → trabajos sin empleada (GET /api/solicitudes/pendientes)
 *  - Mis trabajos → historial de los que tomó (cada trabajo tomado tiene su chat en Firestore)
 */
@Component({
  selector: 'app-lista-solicitudes',
  standalone: true,
  imports: [MenuSesion, DatePipe, RouterLink],
  templateUrl: './lista-solicitudes.html',
  styleUrl: './lista-solicitudes.css'
})
export class ListaSolicitudesComponent implements OnInit, OnDestroy {
  private api = inject(SolicitudesApiService);
  private chatService = inject(ChatService);
  private auth = inject(AuthService);
  private router = inject(Router);

  vista = signal<Vista>('disponibles');

  // ---------- Pestaña "Disponibles" ----------
  solicitudes = signal<Solicitud[]>([]);
  cargando = signal(true);
  error = signal('');
  /** id de la solicitud que se está tomando (para deshabilitar su botón) */
  tomando = signal<string | null>(null);

  // ---------- Pestaña "Mis trabajos" ----------
  misTrabajos = signal<Trabajo[]>([]);
  cargandoMios = signal(true);
  errorMios = signal('');
  filtro = signal<FiltroHistorial>('enCurso');
  /** id del trabajo que se está finalizando o rechazando (para deshabilitar sus botones) */
  finalizando = signal<string | null>(null);
  rechazando = signal<string | null>(null);

  private hoy = new Date().toISOString().slice(0, 10); // 'aaaa-mm-dd'

  /** En curso: tomados y todavía no finalizados, el más cercano primero */
  enCurso = computed(() =>
    this.misTrabajos().filter(t => !t.finalizado).sort((a, b) => a.fecha.localeCompare(b.fecha))
  );

  /** Finalizados: el más reciente primero */
  finalizados = computed(() =>
    this.misTrabajos().filter(t => t.finalizado).sort((a, b) => b.fecha.localeCompare(a.fecha))
  );

  historialVisible = computed(() => {
    switch (this.filtro()) {
      case 'enCurso': return this.enCurso();
      case 'finalizados': return this.finalizados();
      default: return [...this.enCurso(), ...this.finalizados()];
    }
  });

  serviciosDe = serviciosDe;

  /** La lista de disponibles se vuelve a pedir cada 20 segundos */
  private intervalo?: ReturnType<typeof setInterval>;
  private desuscribirChats?: Unsubscribe;

  ngOnInit(): void {
    this.cargar();
    this.cargarMios();
    this.intervalo = setInterval(() => this.cargar(false), 20000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalo);
    this.desuscribirChats?.();
  }

  /** Texto de la etiqueta de cada trabajo */
  estadoDe(t: Trabajo): 'Finalizado' | 'Por finalizar' | 'Próximo' {
    if (t.finalizado) return 'Finalizado';
    return t.fecha < this.hoy ? 'Por finalizar' : 'Próximo';
  }

  /** GET /api/solicitudes/pendientes */
  cargar(mostrarCargando = true) {
    if (mostrarCargando) this.cargando.set(true);

    this.api.listarPendientes().subscribe({
      next: lista => {
        this.solicitudes.set(lista);
        this.error.set('');
        this.cargando.set(false);
      },
      error: e => {
        this.error.set(this.api.mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  /**
   * Historial: cada trabajo que tomó la empleada tiene su chat con el cliente.
   * Se escuchan sus chats en tiempo real y se arma la lista con los datos de cada uno.
   */
  cargarMios() {
    const empleada = this.auth.usuarioActual();
    if (!empleada) return;

    this.desuscribirChats?.();
    this.cargandoMios.set(true);

    this.desuscribirChats = this.chatService.escucharMisChats(
      empleada,
      chats => {
        this.misTrabajos.set(
          chats
            .filter(c => c.empleadaUid === empleada.uid)   // solo los que tomó ella
            .map(c => this.aTrabajo(c))
        );
        this.errorMios.set('');
        this.cargandoMios.set(false);
      },
      e => {
        console.error(e);
        this.errorMios.set('No se pudo cargar tu historial.');
        this.cargandoMios.set(false);
      }
    );
  }

  private aTrabajo(c: Chat): Trabajo {
    return {
      id: c.id,
      cliente: c.clienteNombre,
      fecha: c.resumen?.fecha ?? '',
      horario: c.resumen?.horario ?? '',
      frecuencia: c.resumen?.frecuencia ?? '',
      direccion: c.resumen?.direccion ?? '',
      servicios: c.resumen?.servicios ?? '',
      finalizado: !!c.finalizado,
    };
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

    // 1) El backend la marca como tomada en MySQL (POST /api/solicitudes/:id/tomar)
    this.api.tomar(solicitud.id).subscribe({
      next: async tomada => {
        try {
          // 2) Se abre el chat en Firestore
          const chatId = await this.chatService.crearChat(tomada, empleada);
          this.solicitudes.update(lista => lista.filter(s => s.id !== solicitud.id));

          await Swal.fire({
            icon: 'success',
            title: '¡Trabajo tomado!',
            text: 'Ahora podés escribirle al cliente para coordinar.',
            confirmButtonText: 'Ir al chat',
            confirmButtonColor: '#58c69d',
          });
          this.router.navigate(['/chats', chatId]);
        } catch (e) {
          console.error(e);
          Swal.fire({
            icon: 'warning',
            title: 'Trabajo tomado, pero falló el chat',
            text: 'El trabajo quedó a tu nombre, pero no se pudo abrir el chat. Revisá las reglas de Firestore.',
            confirmButtonColor: '#f39c12',
          });
        } finally {
          this.tomando.set(null);
        }
      },
      error: e => {
        this.tomando.set(null);
        Swal.fire({ icon: 'error', title: 'No se pudo tomar', text: this.api.mensajeDeError(e), confirmButtonColor: '#e74c3c' });
        this.cargar(false); // por si otra empleada lo tomó: se actualiza la lista
      },
    });
  }

  /**
   * La empleada termina el trabajo:
   *  1) en MySQL la solicitud pasa a "finalizada" (POST /api/solicitudes/:id/finalizar)
   *  2) en el chat se marca como finalizado y se avisa al cliente con un mensaje
   */
  async finalizarTrabajo(t: Trabajo) {
    const empleada = this.auth.usuarioActual();
    if (!empleada) return;

    const r = await Swal.fire({
      title: '¿Finalizar este trabajo?',
      html: `Vas a marcar como terminado el trabajo de <b>${t.cliente}</b> del
             <b>${t.fecha.split('-').reverse().join('/')}</b>.<br><br>
             Se le va a avisar al cliente por el chat.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, finalizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e74c3c',
    });
    if (!r.isConfirmed) return;

    this.finalizando.set(t.id);

    const marcarEnChat = async () => {
      try {
        await this.chatService.marcarFinalizado(t.id, empleada);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Trabajo finalizado', showConfirmButton: false, timer: 2500 });
      } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el chat. Revisá las reglas de Firestore.', confirmButtonColor: '#e74c3c' });
      } finally {
        this.finalizando.set(null);
      }
    };

    this.api.finalizar(t.id).subscribe({
      next: () => marcarEnChat(),
      error: e => {
        // 404: es un trabajo viejo que estaba en Firebase y no existe en MySQL → se finaliza solo en el chat
        // 409 "ya estaba finalizado": se sincroniza el chat igual
        if ((e?.status === 404 && e?.error?.error === 'La solicitud no existe.') || e?.status === 409) {
          marcarEnChat();
          return;
        }
        this.finalizando.set(null);
        Swal.fire({ icon: 'error', title: 'No se pudo finalizar', text: this.api.mensajeDeError(e), confirmButtonColor: '#e74c3c' });
      },
    });
  }

  /**
   * La empleada RECHAZA un trabajo que había tomado:
   *  1) en MySQL vuelve a "pendiente" y sin empleada (POST /api/solicitudes/:id/rechazar)
   *  2) se borra el chat con el cliente, para que la próxima empleada empiece de cero
   * Así el trabajo reaparece en "Disponibles" y lo puede tomar otra empleada.
   */
  async rechazarTrabajo(t: Trabajo) {
    const r = await Swal.fire({
      title: '¿Rechazar este pedido?',
      html: `El trabajo de <b>${t.cliente}</b> del <b>${t.fecha.split('-').reverse().join('/')}</b>
             va a volver a la lista de trabajos disponibles para que lo tome otra empleada.<br><br>
             <small>Se va a borrar el chat que tenías con el cliente.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f39c12',
    });
    if (!r.isConfirmed) return;

    this.rechazando.set(t.id);

    this.api.rechazar(t.id).subscribe({
      next: async () => {
        try {
          await this.chatService.eliminarChat(t.id);
          Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Pedido rechazado. Volvió a la lista de disponibles.', showConfirmButton: false, timer: 3000 });
        } catch (e) {
          console.error(e);
          Swal.fire({ icon: 'warning', title: 'Pedido rechazado', text: 'El trabajo volvió a la lista, pero no se pudo borrar el chat. Revisá las reglas de Firestore.', confirmButtonColor: '#f39c12' });
        } finally {
          this.rechazando.set(null);
          this.cargar(false); // vuelve a aparecer en "Disponibles"
        }
      },
            error: async e => {
        // Trabajo viejo: su chat existe en Firebase, pero la solicitud ya no está en MySQL.
        // No hay nada que devolver a "Disponibles", así que solo se quita de la lista borrando el chat.
        if (e?.status === 404 && e?.error?.error === 'La solicitud no existe.') {
          try {
            await this.chatService.eliminarChat(t.id);
            Swal.fire({
              icon: 'info',
              title: 'Trabajo quitado de tu lista',
              text: 'Era un trabajo anterior que ya no existe en la base de datos, así que se quitó de tus trabajos.',
              confirmButtonColor: '#58c69d',
            });
          } catch (err) {
            console.error(err);
            Swal.fire({ icon: 'error', title: 'No se pudo quitar', text: 'Revisá las reglas de Firestore.', confirmButtonColor: '#e74c3c' });
          } finally {
            this.rechazando.set(null);
          }
          return;
        }

        this.rechazando.set(null);
        Swal.fire({ icon: 'error', title: 'No se pudo rechazar', text: this.api.mensajeDeError(e), confirmButtonColor: '#e74c3c' });
      },
    });
  }

  /** Descarga el historial que se ve en pantalla */
  descargarHistorial() {
    descargarCsv(nombreConFecha('mis-trabajos'), [
      { titulo: 'Fecha', valor: (t: Trabajo) => t.fecha.split('-').reverse().join('/') },
      { titulo: 'Horario', valor: (t: Trabajo) => t.horario },
      { titulo: 'Frecuencia', valor: (t: Trabajo) => t.frecuencia },
      { titulo: 'Cliente', valor: (t: Trabajo) => t.cliente },
      { titulo: 'Dirección', valor: (t: Trabajo) => t.direccion },
      { titulo: 'Servicios', valor: (t: Trabajo) => t.servicios },
      { titulo: 'Estado', valor: (t: Trabajo) => this.estadoDe(t) },
    ], this.historialVisible());
  }
}