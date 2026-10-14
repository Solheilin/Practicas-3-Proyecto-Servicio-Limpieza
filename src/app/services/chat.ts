import { Injectable } from '@angular/core';
import {
  collection, doc, query, where, orderBy, onSnapshot, writeBatch,
  serverTimestamp, Timestamp, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Usuario } from './auth';

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
  return { ...datos, id, ultimoMensajeFecha: aFecha(datos.ultimoMensajeFecha) };
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {

  /** Conversaciones del usuario en tiempo real. El admin ve todas. */
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

  /** Nombre de la otra persona del chat, según quién lo mire. */
  otraPersona(chat: Chat, miUid?: string): string {
    if (miUid === chat.clienteUid) return chat.empleadaNombre;
    if (miUid === chat.empleadaUid) return chat.clienteNombre;
    return `${chat.clienteNombre} y ${chat.empleadaNombre}`; // administrador
  }
}