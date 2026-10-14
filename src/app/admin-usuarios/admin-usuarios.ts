import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import Swal from 'sweetalert2';
import { MenuSesion } from '../menu-sesion/menu-sesion';
import { AuthService, TipoUsuario } from '../services/auth';
import { AdminUsuariosService, UsuarioAdmin } from '../services/admin-usuarios';

type Filtro = 'todos' | TipoUsuario | 'inactivos';

@Component({
  selector: 'app-admin-usuarios',
  imports: [MenuSesion, FormsModule, DatePipe],
  templateUrl: './admin-usuarios.html',
  styleUrl: './admin-usuarios.css',
})
export class AdminUsuarios implements OnInit {
  private adminService = inject(AdminUsuariosService);
  private auth = inject(AuthService);

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