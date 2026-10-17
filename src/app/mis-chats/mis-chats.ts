import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Unsubscribe } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { MenuSesion } from '../menu-sesion/menu-sesion';
import { AuthService } from '../services/auth';
import { Chat, ChatService } from '../services/chat';
import { Solicitud, serviciosDe } from '../services/solicitudes';
import { SolicitudesApiService } from '../services/solicitudes-api';

/** Lista de conversaciones del usuario (y, si es cliente, sus solicitudes que esperan empleada). */
@Component({
  selector: 'app-mis-chats',
  imports: [MenuSesion, RouterLink, DatePipe],
  templateUrl: './mis-chats.html',
  styleUrl: './mis-chats.css',
})
export class MisChats implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private chatService = inject(ChatService);
  private api = inject(SolicitudesApiService);

  usuario = this.auth.usuarioActual;
  chats = signal<Chat[]>([]);
  solicitudes = signal<Solicitud[]>([]);
  cargando = signal(true);
  error = signal('');

  /** Solicitudes del cliente que todavía nadie tomó */
  pendientes = computed(() => this.solicitudes().filter(s => s.estado === 'pendiente'));

  serviciosDe = serviciosDe;

  private desuscripciones: Unsubscribe[] = [];

  ngOnInit() {
    const u = this.usuario();
    if (!u) return;

    const alError = (e: any) => {
      console.error(e);
      this.error.set(e?.code === 'permission-denied'
        ? 'Firestore no te deja ver las conversaciones. Revisá que las reglas nuevas estén publicadas.'
        : 'No se pudieron cargar las conversaciones.');
      this.cargando.set(false);
    };

    this.desuscripciones.push(
      this.chatService.escucharMisChats(u, chats => {
        this.chats.set(chats);
        this.cargando.set(false);
      }, alError)
    );

    // Solo clientes: sus solicitudes que todavía esperan empleada (desde el backend)
    if (u.tipo === 'cliente') this.cargarSolicitudes();
  }

  private cargarSolicitudes() {
    this.api.listarMias().subscribe({
      next: lista => this.solicitudes.set(lista),
      error: e => console.error(e),
    });
  }

  ngOnDestroy() {
    this.desuscripciones.forEach(d => d());
  }

  otraPersona(chat: Chat) {
    return this.chatService.otraPersona(chat, this.usuario()?.uid);
  }

  inicial(chat: Chat) {
    return this.otraPersona(chat).charAt(0).toUpperCase();
  }

  /** "Vos: ..." si el último mensaje lo escribí yo */
  vistaPrevia(chat: Chat) {
    if (!chat.ultimoMensaje) return 'Todavía no hay mensajes. ¡Escribí el primero!';
    return (chat.ultimoAutorUid === this.usuario()?.uid ? 'Vos: ' : '') + chat.ultimoMensaje;
  }

  async cancelar(s: Solicitud) {
    const r = await Swal.fire({
      title: '¿Cancelar esta solicitud?',
      text: 'Las empleadas ya no la van a ver.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No',
      confirmButtonColor: '#e74c3c',
    });
    if (!r.isConfirmed) return;

    this.api.eliminar(s.id).subscribe({
      next: () => this.solicitudes.update(lista => lista.filter(x => x.id !== s.id)),
      error: e => Swal.fire({ icon: 'error', title: 'Error', text: this.api.mensajeDeError(e) }),
    });
  }
}