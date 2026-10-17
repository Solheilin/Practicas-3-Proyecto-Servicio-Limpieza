import { MenuSesion } from '../menu-sesion/menu-sesion';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';
import { Solicitud, serviciosDe } from '../services/solicitudes';
import { SolicitudesApiService } from '../services/solicitudes-api';
import { ChatService } from '../services/chat';
import { descargarCsv, nombreConFecha } from '../services/csv';

type Vista = 'disponibles' | 'mios';
type FiltroHistorial = 'proximos' | 'realizados' | 'todos';

/**
 * Página de la EMPLEADA, con dos pestañas:
 *  - Disponibles  → trabajos sin empleada (GET /api/solicitudes/pendientes)
 *  - Mis trabajos → historial de los que tomó (GET /api/solicitudes/tomadas)
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
  misTrabajos = signal<Solicitud[]>([]);
  cargandoMios = signal(true);
  errorMios = signal('');
  filtro = signal<FiltroHistorial>('proximos');

  private hoy = new Date().toISOString().slice(0, 10); // 'aaaa-mm-dd'

  /** Próximos: de hoy en adelante, el más cercano primero */
  proximos = computed(() =>
    this.misTrabajos().filter(t => t.fecha >= this.hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))
  );

  /** Realizados: fechas pasadas, el más reciente primero */
  realizados = computed(() =>
    this.misTrabajos().filter(t => t.fecha < this.hoy).sort((a, b) => b.fecha.localeCompare(a.fecha))
  );

  historialVisible = computed(() => {
    switch (this.filtro()) {
      case 'proximos': return this.proximos();
      case 'realizados': return this.realizados();
      default: return [...this.proximos(), ...this.realizados()];
    }
  });

  serviciosDe = serviciosDe;

  /** La lista de disponibles se vuelve a pedir cada 20 segundos */
  private intervalo?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.cargar();
    this.cargarMios();
    this.intervalo = setInterval(() => this.cargar(false), 20000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalo);
  }

  esRealizado(t: Solicitud) {
    return t.fecha < this.hoy;
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

  /** GET /api/solicitudes/tomadas */
  cargarMios() {
    this.cargandoMios.set(true);

    this.api.listarTomadas().subscribe({
      next: lista => {
        this.misTrabajos.set(lista);
        this.errorMios.set('');
        this.cargandoMios.set(false);
      },
      error: e => {
        this.errorMios.set(this.api.mensajeDeError(e));
        this.cargandoMios.set(false);
      },
    });
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
          this.misTrabajos.update(lista => [...lista, tomada]); // pasa al historial

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

  /** Descarga el historial que se ve en pantalla */
  descargarHistorial() {
    descargarCsv(nombreConFecha('mis-trabajos'), [
      { titulo: 'Fecha', valor: (t: Solicitud) => t.fecha.split('-').reverse().join('/') },
      { titulo: 'Horario', valor: (t: Solicitud) => t.horario },
      { titulo: 'Frecuencia', valor: (t: Solicitud) => t.frecuencia },
      { titulo: 'Cliente', valor: (t: Solicitud) => `${t.nombre} ${t.apellido}` },
      { titulo: 'Teléfono', valor: (t: Solicitud) => t.telefono },
      { titulo: 'Dirección', valor: (t: Solicitud) => t.direccion },
      { titulo: 'Servicios', valor: (t: Solicitud) => serviciosDe(t) },
      { titulo: 'Estado', valor: (t: Solicitud) => (this.esRealizado(t) ? 'Realizado' : 'Próximo') },
    ], this.historialVisible());
  }
}