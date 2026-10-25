import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';
import { ChatService } from '../services/chat';

/**
 * Menú de la barra de arriba. Se usa en todas las páginas con <app-menu-sesion />
 * - Sin sesión: "Acceder" y "¿Buscás empleo?"
 * - Con sesión: saludo, acceso a su sección y "Cerrar sesión"
 */
@Component({
  selector: 'app-menu-sesion',
  imports: [RouterLink],
  templateUrl: './menu-sesion.html',
  styleUrl: './menu-sesion.css',
})
export class MenuSesion {
  private auth = inject(AuthService);
  private router = inject(Router);
  private chatService = inject(ChatService);

  /** Cantidad de chats con mensajes sin leer */
  noLeidos = this.chatService.noLeidos;

  usuario = this.auth.usuarioActual;
  verificando = this.auth.verificandoSesion;

  etiquetas = { cliente: 'Cliente', empleada: 'Empleada', admin: 'Administrador' };

  inicial = computed(() => this.usuario()?.nombre?.charAt(0).toUpperCase() ?? '');

  async cerrarSesion() {
    const r = await Swal.fire({
      title: '¿Cerrar sesión?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#58c69d',
      cancelButtonColor: '#aaa',
    });
    if (!r.isConfirmed) return;

    await this.auth.logout();
    this.router.navigate(['/']);
  }
}
