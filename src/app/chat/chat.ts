import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Unsubscribe } from 'firebase/firestore';
import { MenuSesion } from '../menu-sesion/menu-sesion';
import { AuthService } from '../services/auth';
import { Chat as DatosChat, ChatService, Mensaje } from '../services/chat';

/** Vista de una conversación con burbujas, tipo WhatsApp. */
@Component({
  selector: 'app-chat',
  imports: [MenuSesion, RouterLink, FormsModule, DatePipe],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private chatService = inject(ChatService);

  @ViewChild('zonaMensajes') zonaMensajes?: ElementRef<HTMLDivElement>;

  usuario = this.auth.usuarioActual;
  chat = signal<DatosChat | null>(null);
  mensajes = signal<Mensaje[]>([]);
  cargando = signal(true);
  error = signal('');

  texto = '';
  enviando = signal(false);

  /** El administrador puede leer, pero no escribir */
  soloLectura = computed(() => {
    const c = this.chat();
    const uid = this.usuario()?.uid;
    return !c || !uid || !c.participantes.includes(uid);
  });

  titulo = computed(() => {
    const c = this.chat();
    return c ? this.chatService.otraPersona(c, this.usuario()?.uid) : '';
  });

  private chatId = '';
  private desuscripciones: Unsubscribe[] = [];

  ngOnInit() {
    this.chatId = this.route.snapshot.paramMap.get('id') ?? '';

    const alError = (e: any) => {
      console.error(e);
      this.error.set(e?.code === 'permission-denied'
        ? 'No tenés acceso a esta conversación.'
        : 'No se pudo cargar la conversación.');
      this.cargando.set(false);
    };

    this.desuscripciones.push(
      this.chatService.escucharChat(this.chatId, chat => {
        const primeraVez = !this.chat();
        this.chat.set(chat);
        if (!chat) this.error.set('Esta conversación no existe.');
        this.cargando.set(false);
        if (primeraVez) this.marcarComoLeido();
      }, alError),

      this.chatService.escucharMensajes(this.chatId, mensajes => {
        this.mensajes.set(mensajes);
        this.bajarAlFinal();
        this.marcarComoLeido(); // si llega un mensaje mientras está mirando, ya queda leído
      }, alError)
    );
  }

  /** Avisa que el usuario está viendo el chat, así deja de figurar como "no leído" */
  private marcarComoLeido() {
    const uid = this.usuario()?.uid;
    if (!uid || this.soloLectura()) return; // el admin solo mira
    this.chatService.marcarLeido(this.chatId, uid).catch(e => console.error(e));
  }

  ngOnDestroy() {
    this.desuscripciones.forEach(d => d());
  }

  esMio(m: Mensaje) {
    return m.autorUid === this.usuario()?.uid;
  }

  /** Muestra el día ("Hoy", "Ayer" o la fecha) cuando cambia respecto al mensaje anterior */
  separadorDeDia(i: number): string | null {
    const lista = this.mensajes();
    const actual = lista[i]?.fecha;
    if (!actual) return null;
    const anterior = lista[i - 1]?.fecha;
    if (anterior && anterior.toDateString() === actual.toDateString()) return null;

    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (actual.toDateString() === hoy.toDateString()) return 'Hoy';
    if (actual.toDateString() === ayer.toDateString()) return 'Ayer';
    return actual.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  }

  async enviar() {
    const u = this.usuario();
    const texto = this.texto.trim();
    if (!u || !texto || this.enviando() || this.soloLectura()) return;

    this.enviando.set(true);
    this.texto = ''; // se limpia enseguida, como en WhatsApp
    try {
      await this.chatService.enviar(this.chatId, u, texto);
    } catch (e) {
      console.error(e);
      this.texto = texto; // si falló, devolvemos el texto para no perderlo
      this.error.set('No se pudo enviar el mensaje. Probá de nuevo.');
      setTimeout(() => this.error.set(''), 4000);
    } finally {
      this.enviando.set(false);
    }
  }

  /** Enter envía; Shift + Enter hace un salto de línea */
  alPresionarTecla(evento: KeyboardEvent) {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      this.enviar();
    }
  }

  private bajarAlFinal() {
    // Esperamos a que Angular dibuje los mensajes nuevos
    setTimeout(() => {
      const zona = this.zonaMensajes?.nativeElement;
      if (zona) zona.scrollTop = zona.scrollHeight;
    });
  }
}