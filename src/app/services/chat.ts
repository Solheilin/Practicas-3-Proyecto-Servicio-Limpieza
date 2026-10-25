import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import {
  collection, doc, query, where, orderBy, onSnapshot, writeBatch, setDoc, getDocs, updateDoc,
  serverTimestamp, Timestamp, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { AuthService, Usuario } from './auth';
import { Solicitud, serviciosDe } from './solicitudes';

export interface Chat {
  id: string;
  solicitudId: string;
  participantes: string[];
  clienteUid: string;
  clienteNombre: string;
  empleadaUid: string;
  empleadaNombre: string;
  resumen: {
    direccion: string;
    fecha: string;
    horario: string;
    frecuencia: string;
    servicios: string;
  };
  ultimoMensaje: string;
  ultimoAutorUid: string;
  ultimoMensajeFecha?: Date;
  /** true cuando la empleada marcó el trabajo como terminado */
  finalizado?: boolean;
  /** Última vez que cada participante abrió el chat: { uid: fecha } */
  leido?: Record<string, Date | undefined>;
}

export interface Mensaje {
  id: string;
  texto: string;
  autorUid: string;
  autorNombre: string;
  fecha?: Date;
}

function aFecha(valor: any): Date | undefined {
  return (valor as Timestamp | null)?.toDate();
}

function aChat(id: string, datos: any): Chat {
  const leido: Record<string, Date | undefined> = {};
  for (const [uid, fecha] of Object.entries(datos.leido ?? {})) leido[uid] = aFecha(fecha);
  return { ...datos, id, ultimoMensajeFecha: aFecha(datos.ultimoMensajeFecha), leido };
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private auth = inject(AuthService);
  private router = inject(Router);

  // ---------- Avisos de mensajes nuevos ----------

  /** Cantidad de chats con mensajes sin leer (se muestra en el menú) */
  noLeidos = signal(0);

  private desuscribirAvisos?: Unsubscribe;
  /** Fecha del último mensaje de cada chat, para detectar cuándo llega uno nuevo */
  private ultimasFechas = new Map<string, number>();

  constructor() {
    // Cada vez que cambia el usuario logueado, se empiezan a escuchar SUS chats
    effect(() => {
      const usuario = this.auth.usuarioActual();
      untracked(() => this.escucharAvisos(usuario));
    });
  }

  /**
   * Escucha en tiempo real los chats del usuario:
   *  - cuenta cuántos tienen mensajes sin leer
   *  - muestra un cartelito cuando llega un mensaje nuevo
   */
  private escucharAvisos(usuario: Usuario | null) {
    this.desuscribirAvisos?.();
    this.noLeidos.set(0);
    this.ultimasFechas.clear();
    if (!usuario || usuario.tipo === 'admin') return; // el admin solo mira, no chatea

    let primeraCarga = true;

    this.desuscribirAvisos = this.escucharMisChats(usuario, chats => {
      this.noLeidos.set(chats.filter(c => this.noLeido(c, usuario.uid)).length);

      for (const c of chats) {
        const fecha = c.ultimoMensajeFecha?.getTime() ?? 0;
        const anterior = this.ultimasFechas.get(c.id);
        this.ultimasFechas.set(c.id, fecha);

        const esNuevo = !primeraCarga && (anterior === undefined || fecha > anterior);
        const loEscribioOtro = !!c.ultimoMensaje && c.ultimoAutorUid !== usuario.uid;
        const estaMirandoEseChat = this.router.url.startsWith(`/chats/${c.id}`);

        if (esNuevo && loEscribioOtro && !estaMirandoEseChat) {
          this.mostrarAviso(c, usuario.uid);
        }
      }
      primeraCarga = false; // al entrar no se avisa de los mensajes viejos
    }, e => console.error('[Avisos de chat]', e));
  }

  private mostrarAviso(chat: Chat, miUid: string) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: `💬 Nuevo mensaje de ${this.otraPersona(chat, miUid)}`,
      text: chat.ultimoMensaje.length > 60 ? chat.ultimoMensaje.slice(0, 60) + '…' : chat.ultimoMensaje,
      showConfirmButton: true,
      confirmButtonText: 'Ver',
      confirmButtonColor: '#58c69d',
            showCloseButton: true,
    }).then(r => {
      if (r.isConfirmed) this.router.navigate(['/chats', chat.id]);
    });
  }

  /** true si el último mensaje lo escribió la otra persona y todavía no abrí el chat desde entonces */
  noLeido(chat: Chat, miUid?: string): boolean {
    if (!miUid || !chat.ultimoMensaje || chat.ultimoAutorUid === miUid) return false;
    const ultimo = chat.ultimoMensajeFecha?.getTime() ?? 0;
    const leidoHasta = chat.leido?.[miUid]?.getTime() ?? 0;
    return ultimo > leidoHasta;
  }

  /** Guarda que el usuario abrió el chat ahora (así deja de figurar como no leído) */
  async marcarLeido(chatId: string, uid: string) {
    await updateDoc(doc(db, 'chats', chatId), { [`leido.${uid}`]: serverTimestamp() });
  }


  /**
   * Crea el chat entre la empleada y el cliente cuando la empleada toma un trabajo.
   * La solicitud vive en MySQL (backend); el chat, en Firestore (tiempo real).
   * Usa el mismo id que la solicitud, así cada solicitud tiene un único chat.
   */
  async crearChat(solicitud: Solicitud, empleada: Usuario): Promise<string> {
    const chatId = solicitud.id;
    await setDoc(doc(db, 'chats', chatId), {
      solicitudId: solicitud.id,
      participantes: [solicitud.clienteUid, empleada.uid],
      clienteUid: solicitud.clienteUid,
      clienteNombre: `${solicitud.nombre} ${solicitud.apellido}`.trim(),
      empleadaUid: empleada.uid,
      empleadaNombre: `${empleada.nombre} ${empleada.apellido}`.trim(),
      resumen: {
        direccion: solicitud.direccion,
        fecha: solicitud.fecha,
        horario: solicitud.horario,
        frecuencia: solicitud.frecuencia,
        servicios: serviciosDe(solicitud),
      },
      ultimoMensaje: '',
      ultimoAutorUid: '',
      ultimoMensajeFecha: serverTimestamp(),
      creado: serverTimestamp(),
    });
    return chatId;
  }

  /**
   * Conversaciones del usuario en tiempo real.
   * El administrador ve todas; los demás, solo en las que participan.
   */
  escucharMisChats(usuario: Usuario, callback: (chats: Chat[]) => void, alError?: (e: any) => void): Unsubscribe {
    const ref = collection(db, 'chats');
    const q = usuario.tipo === 'admin'
      ? query(ref)
      : query(ref, where('participantes', 'array-contains', usuario.uid));

    return onSnapshot(q, snap => {
      const chats = snap.docs
        .map(d => aChat(d.id, d.data({ serverTimestamps: 'estimate' })))
        .sort((a, b) => (b.ultimoMensajeFecha?.getTime() ?? 0) - (a.ultimoMensajeFecha?.getTime() ?? 0));
      callback(chats);
    }, alError);
  }

  /** Datos de una conversación (para el encabezado del chat). */
  escucharChat(chatId: string, callback: (chat: Chat | null) => void, alError?: (e: any) => void): Unsubscribe {
    return onSnapshot(doc(db, 'chats', chatId), snap => {
      callback(snap.exists() ? aChat(snap.id, snap.data({ serverTimestamps: 'estimate' })) : null);
    }, alError);
  }

  /** Mensajes de una conversación, en orden, en tiempo real. */
  escucharMensajes(chatId: string, callback: (mensajes: Mensaje[]) => void, alError?: (e: any) => void): Unsubscribe {
    const q = query(collection(db, 'chats', chatId, 'mensajes'), orderBy('fecha', 'asc'));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => {
        const datos = d.data({ serverTimestamps: 'estimate' });
        return { ...datos, id: d.id, fecha: aFecha(datos['fecha']) } as Mensaje;
      }));
    }, alError);
  }

  /** Envía un mensaje y actualiza el "último mensaje" del chat, todo junto. */
  async enviar(chatId: string, autor: Usuario, texto: string) {
    const limpio = texto.trim().slice(0, 1000);
    if (!limpio) return;

    const lote = writeBatch(db);
    const refMensaje = doc(collection(db, 'chats', chatId, 'mensajes'));

    lote.set(refMensaje, {
      texto: limpio,
      autorUid: autor.uid,
      autorNombre: autor.nombre,
      fecha: serverTimestamp(),
    });

    lote.update(doc(db, 'chats', chatId), {
      ultimoMensaje: limpio.slice(0, 100),
      ultimoAutorUid: autor.uid,
      ultimoMensajeFecha: serverTimestamp(),
    });

    await lote.commit();
  }

  /**
   * La empleada marca el trabajo como finalizado: se guarda en el chat
   * y se manda un mensaje automático para que el cliente se entere.
   */
  async marcarFinalizado(chatId: string, empleada: Usuario) {
    const texto = '✅ Trabajo finalizado. ¡Gracias por confiar en nosotros!';
    const lote = writeBatch(db);

    lote.set(doc(collection(db, 'chats', chatId, 'mensajes')), {
      texto,
      autorUid: empleada.uid,
      autorNombre: empleada.nombre,
      fecha: serverTimestamp(),
    });

    lote.update(doc(db, 'chats', chatId), {
      finalizado: true,
      finalizadoFecha: serverTimestamp(),
      ultimoMensaje: texto,
      ultimoAutorUid: empleada.uid,
      ultimoMensajeFecha: serverTimestamp(),
    });

    await lote.commit();
  }

  /**
   * Borra el chat y todos sus mensajes (cuando la empleada rechaza el trabajo).
   * Así la próxima empleada que lo tome empieza una conversación nueva.
   */
  async eliminarChat(chatId: string) {
    const mensajes = await getDocs(collection(db, 'chats', chatId, 'mensajes'));
    const lote = writeBatch(db);
    mensajes.docs.forEach(m => lote.delete(m.ref));
    lote.delete(doc(db, 'chats', chatId));
    await lote.commit();
  }

  /** Nombre de la otra persona del chat, según quién lo mire. */
  otraPersona(chat: Chat, miUid?: string): string {
    if (miUid === chat.clienteUid) return chat.empleadaNombre;
    if (miUid === chat.empleadaUid) return chat.clienteNombre;
    return `${chat.clienteNombre} y ${chat.empleadaNombre}`; // administrador
  }
}