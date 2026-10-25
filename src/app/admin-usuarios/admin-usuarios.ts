import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import Swal from 'sweetalert2';
import { MenuSesion } from '../menu-sesion/menu-sesion';
import { AuthService, TipoUsuario } from '../services/auth';
import { AdminUsuariosService, UsuarioAdmin } from '../services/admin-usuarios';
import { Rechazo, SolicitudesApiService } from '../services/solicitudes-api';
import { forkJoin } from 'rxjs';
import { Solicitud } from '../services/solicitudes';
import { Chart, registerables } from 'chart.js';

// Registra todos los tipos de gráfico de Chart.js (líneas, barras, etc.)
Chart.register(...registerables);

type Filtro = 'todos' | TipoUsuario | 'inactivos';

@Component({
  selector: 'app-admin-usuarios',
  imports: [MenuSesion, FormsModule, DatePipe],
  templateUrl: './admin-usuarios.html',
  styleUrl: './admin-usuarios.css',
})
export class AdminUsuarios implements OnInit, AfterViewInit, OnDestroy {
  private adminService = inject(AdminUsuariosService);
  private auth = inject(AuthService);
  private solicitudesApi = inject(SolicitudesApiService);

  // ---------- Gráfico: solicitudes por mes ----------
  @ViewChild('graficoMeses') graficoMeses?: ElementRef<HTMLCanvasElement>;
  private grafico?: Chart;
  private solicitudes: Solicitud[] = [];
  private rechazos: Rechazo[] = [];
  private vistaLista = false;

  cargandoGrafico = signal(true);
  errorGrafico = signal('');
  resumenGrafico = signal({ total: 0, finalizadas: 0, rechazados: 0, mejorMes: '—', mejorCantidad: 0 });

  usuarios = signal<UsuarioAdmin[]>([]);
  cargando = signal(true);
  error = signal('');

  busqueda = signal('');
  filtro = signal<Filtro>('todos');

  /** uid del administrador logueado (no se puede desactivar ni borrar a sí mismo) */
  miUid = computed(() => this.auth.usuarioActual()?.uid);

  etiquetas: Record<TipoUsuario, string> = { cliente: 'Cliente', empleada: 'Empleada', admin: 'Administrador' };

  // Números de las tarjetas de arriba
  totales = computed(() => {
    const lista = this.usuarios();
    return {
      todos: lista.length,
      cliente: lista.filter(u => u.tipo === 'cliente').length,
      empleada: lista.filter(u => u.tipo === 'empleada').length,
      admin: lista.filter(u => u.tipo === 'admin').length,
      inactivos: lista.filter(u => u.activo === false).length,
    };
  });

  // Lista que se muestra en la tabla, según el filtro y la búsqueda
  usuariosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();

    return this.usuarios().filter(u => {
      const pasaFiltro =
        filtro === 'todos' ||
        (filtro === 'inactivos' ? u.activo === false : u.tipo === filtro);

      const pasaBusqueda =
        !texto ||
        `${u.nombre} ${u.apellido} ${u.email} ${'dni' in u ? u.dni : ''}`.toLowerCase().includes(texto);

      return pasaFiltro && pasaBusqueda;
    });
  });

  ngOnInit() {
    this.cargar();
    this.cargarEstadisticas();
  }

  ngAfterViewInit() {
    this.vistaLista = true;
    this.dibujarGrafico();
  }

  ngOnDestroy() {
    this.grafico?.destroy();
  }

  /**
   * Pide al backend, en paralelo:
   *  - GET /api/solicitudes          → todas las solicitudes
   *  - GET /api/solicitudes/rechazos → el historial de rechazos
   */
  cargarEstadisticas() {
    this.cargandoGrafico.set(true);
    this.errorGrafico.set('');

    forkJoin({
      solicitudes: this.solicitudesApi.listarTodas(),
      rechazos: this.solicitudesApi.listarRechazos(),
    }).subscribe({
      next: ({ solicitudes, rechazos }) => {
        this.solicitudes = solicitudes;
        this.rechazos = rechazos;
        this.cargandoGrafico.set(false);
        this.dibujarGrafico();
      },
      error: e => {
        this.errorGrafico.set(this.solicitudesApi.mensajeDeError(e));
        this.cargandoGrafico.set(false);
      },
    });
  }

  /**
   * Arma el gráfico de líneas con los últimos 12 meses:
   *  - Solicitudes creadas en cada mes
   *  - Solicitudes finalizadas en cada mes
   *  - Pedidos rechazados por empleadas en cada mes
   */
  private dibujarGrafico() {
    const canvas = this.graficoMeses?.nativeElement;
    if (!canvas || !this.vistaLista || this.cargandoGrafico()) return;

    // Los últimos 12 meses, del más viejo al actual
    const hoy = new Date();
    const meses = Array.from({ length: 12 }, (_, i) => new Date(hoy.getFullYear(), hoy.getMonth() - 11 + i, 1));
    const clave = (f: Date) => `${f.getFullYear()}-${f.getMonth()}`;

    const creadas = new Map(meses.map(m => [clave(m), 0]));
    const finalizadas = new Map(meses.map(m => [clave(m), 0]));
    const rechazados = new Map(meses.map(m => [clave(m), 0]));

    for (const s of this.solicitudes) {
      if (s.creada && creadas.has(clave(s.creada))) {
        creadas.set(clave(s.creada), creadas.get(clave(s.creada))! + 1);
      }
      if (s.finalizadaEn) {
        const f = new Date(s.finalizadaEn);
        if (finalizadas.has(clave(f))) finalizadas.set(clave(f), finalizadas.get(clave(f))! + 1);
      }
    }

    for (const r of this.rechazos) {
      if (r.rechazadaEn) {
        const f = new Date(r.rechazadaEn);
        if (rechazados.has(clave(f))) rechazados.set(clave(f), rechazados.get(clave(f))! + 1);
      }
    }

    const etiquetas = meses.map(m => m.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }));
    const datosCreadas = meses.map(m => creadas.get(clave(m))!);
    const datosFinalizadas = meses.map(m => finalizadas.get(clave(m))!);
    const datosRechazados = meses.map(m => rechazados.get(clave(m))!);

    // Resumen que se muestra arriba del gráfico
    const maximo = Math.max(...datosCreadas);
    this.resumenGrafico.set({
      total: datosCreadas.reduce((a, b) => a + b, 0),
      finalizadas: datosFinalizadas.reduce((a, b) => a + b, 0),
      rechazados: datosRechazados.reduce((a, b) => a + b, 0),
      mejorMes: maximo > 0 ? etiquetas[datosCreadas.indexOf(maximo)] : '—',
      mejorCantidad: maximo,
    });

    this.grafico?.destroy(); // si ya había uno, se reemplaza
    this.grafico = new Chart(canvas, {
      type: 'line',
      data: {
        labels: etiquetas,
        datasets: [
          {
            label: 'Solicitudes creadas',
            data: datosCreadas,
            borderColor: '#58c69d',
            backgroundColor: 'rgba(88, 198, 157, 0.15)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
          },
          {
            label: 'Trabajos finalizados',
            data: datosFinalizadas,
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            fill: false,
            tension: 0.35,
            pointRadius: 4,
          },
          {
            label: 'Pedidos rechazados',
            data: datosRechazados,
            borderColor: '#f39c12',
            backgroundColor: 'rgba(243, 156, 18, 0.1)',
            borderDash: [6, 4],        // línea punteada para diferenciarla
            fill: false,
            tension: 0.35,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y}` } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Cantidad' } },
        },
      },
    });
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.usuarios.set(await this.adminService.listar());
    } catch (e: any) {
      console.error(e);
      this.error.set(
        e?.code === 'permission-denied'
          ? 'Firestore no te deja ver los usuarios. Revisá que las reglas de administrador estén publicadas.'
          : 'No se pudieron cargar los usuarios.'
      );
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarEstado(u: UsuarioAdmin) {
    const activar = u.activo === false;

    const r = await Swal.fire({
      title: activar ? '¿Activar cuenta?' : '¿Desactivar cuenta?',
      html: activar
        ? `<b>${u.nombre} ${u.apellido}</b> va a poder volver a iniciar sesión.`
        : `<b>${u.nombre} ${u.apellido}</b> no va a poder iniciar sesión hasta que la vuelvas a activar.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: activar ? 'Activar' : 'Desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: activar ? '#58c69d' : '#f39c12',
    });
    if (!r.isConfirmed) return;

    try {
      await this.adminService.cambiarEstado(u.uid, activar);
      // Actualizamos la lista sin volver a pedir todo a Firestore
      this.usuarios.update(lista => lista.map(x => (x.uid === u.uid ? { ...x, activo: activar } : x)));
      this.toast(activar ? 'Cuenta activada' : 'Cuenta desactivada');
    } catch (e) {
      this.mostrarError(e);
    }
  }

  async eliminar(u: UsuarioAdmin) {
    const r = await Swal.fire({
      title: '¿Eliminar usuario?',
      html: `Se va a borrar el perfil de <b>${u.nombre} ${u.apellido}</b> (${u.email}).<br><br>
             <small>Si vuelve a ingresar, la app le va a pedir que se registre de nuevo.
             Si querés impedir que entre, usá <b>Desactivar</b>.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e74c3c',
    });
    if (!r.isConfirmed) return;

    try {
      await this.adminService.eliminarPerfil(u.uid);
      this.usuarios.update(lista => lista.filter(x => x.uid !== u.uid));
      this.toast('Usuario eliminado');
    } catch (e) {
      this.mostrarError(e);
    }
  }

  async verDetalle(u: UsuarioAdmin) {
    const fila = (titulo: string, valor?: string) =>
      valor ? `<tr><td style="text-align:left;padding:4px 10px;color:#777">${titulo}</td><td style="text-align:left;padding:4px 10px"><b>${valor}</b></td></tr>` : '';

    await Swal.fire({
      title: `${u.nombre} ${u.apellido}`,
      html: `<table style="margin:auto">
        ${fila('Tipo', this.etiquetas[u.tipo])}
        ${fila('Correo', u.email)}
        ${'telefono' in u ? fila('Teléfono', u.telefono) : ''}
        ${'direccion' in u ? fila('Dirección', u.direccion) : ''}
        ${'dni' in u ? fila('DNI', u.dni) : ''}
        ${'archivoDni' in u ? fila('Foto DNI', u.archivoDni) : ''}
        ${fila('Estado', u.activo === false ? 'Desactivada' : 'Activa')}
        ${fila('Alta', u.creado?.toLocaleString('es-AR'))}
      </table>`,
      confirmButtonColor: '#58c69d',
      confirmButtonText: 'Cerrar',
    });
  }

  private toast(titulo: string) {
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: titulo, showConfirmButton: false, timer: 2500 });
  }

  private mostrarError(e: any) {
    console.error(e);
    Swal.fire({
      title: 'Error',
      text: e?.code === 'permission-denied'
        ? 'No tenés permiso para hacer esto. Revisá las reglas de Firestore.'
        : 'No se pudo completar la acción.',
      icon: 'error',
      confirmButtonColor: '#e74c3c',
    });
  }
}