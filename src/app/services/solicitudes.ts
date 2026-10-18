import { Injectable } from '@angular/core';
import {
  collection, doc, addDoc, updateDoc, query, where, onSnapshot,
  runTransaction, serverTimestamp, Timestamp, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Usuario } from './auth';

export type EstadoSolicitud = 'pendiente' | 'tomada' | 'cancelada' |'finalizada';

export interface Solicitud {
  id: string;
  clienteUid: string;
  // Datos de contacto y del servicio
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  direccion: string;
  requerimientos: string;
  planchar: boolean;
  lavar: boolean;
  cocina: boolean;
  cuidadoNinos: boolean;
  camaAdentro: boolean;
  fecha: string;     // 'yyyy-mm-dd'
  horario: string;
  frecuencia: string;
  // Estado
  estado: EstadoSolicitud;
  empleadaUid?: string;
  empleadaNombre?: string;
  creada?: Date;
    resenada?: boolean;
}

/** Lo que completa el cliente en el formulario. */
export type DatosSolicitud = Omit<Solicitud, 'id' | 'clienteUid' | 'estado' | 'empleadaUid' | 'empleadaNombre' | 'creada' | 'resenada'>;

const COLECCION = 'solicitudes';

/** Convierte un documento de Firestore en una Solicitud. */
function aSolicitud(id: string, datos: any): Solicitud {
  return { ...datos, id, creada: (datos.creada as Timestamp | null)?.toDate() };
}

/** Texto corto con los servicios marcados, ej: "Planchar, Lavar". */
export function serviciosDe(s: Partial<Solicitud>): string {
  const lista = [
    s.planchar && 'Planchar',
    s.lavar && 'Lavar',
    s.cocina && 'Cocina',
    s.cuidadoNinos && 'Cuidado de niños',
    s.camaAdentro && 'Cama adentro',
  ].filter(Boolean);
  return lista.length ? lista.join(', ') : 'Limpieza general';
}

@Injectable({
  providedIn: 'root',
})
export class SolicitudesService {

  /** El cliente crea una nueva solicitud. */
  async crear(cliente: Usuario, datos: DatosSolicitud) {
    await addDoc(collection(db, COLECCION), {
      ...datos,
      clienteUid: cliente.uid,
      estado: 'pendiente',
      creada: serverTimestamp(),
    });
  }

  /** Solicitudes sin empleada asignada (las ve la empleada). Se actualiza en tiempo real. */
  escucharPendientes(callback: (lista: Solicitud[]) => void, alError?: (e: any) => void): Unsubscribe {
    const q = query(collection(db, COLECCION), where('estado', '==', 'pendiente'));
    return onSnapshot(q, snap => {
      const lista = snap.docs
        .map(d => aSolicitud(d.id, d.data({ serverTimestamps: 'estimate' })))
        .sort((a, b) => (a.creada?.getTime() ?? 0) - (b.creada?.getTime() ?? 0)); // las más viejas primero
      callback(lista);
    }, alError);
  }

  /** Solicitudes del cliente logueado. Se actualiza en tiempo real. */
  escucharMias(clienteUid: string, callback: (lista: Solicitud[]) => void, alError?: (e: any) => void): Unsubscribe {
    const q = query(collection(db, COLECCION), where('clienteUid', '==', clienteUid));
    return onSnapshot(q, snap => {
      const lista = snap.docs
        .map(d => aSolicitud(d.id, d.data({ serverTimestamps: 'estimate' })))
        .sort((a, b) => (b.creada?.getTime() ?? 0) - (a.creada?.getTime() ?? 0)); // las más nuevas primero
      callback(lista);
    }, alError);
  }

  /**
   * La empleada toma la solicitud. Se hace en una TRANSACCIÓN: si dos empleadas
   * tocan "Tomar" al mismo tiempo, solo una lo consigue.
   * Además crea el chat entre la empleada y el cliente. Devuelve el id del chat.
   */
  async tomar(solicitud: Solicitud, empleada: Usuario): Promise<string> {
    const refSolicitud = doc(db, COLECCION, solicitud.id);
    const refChat = doc(db, 'chats', solicitud.id); // el chat usa el mismo id que la solicitud
    const empleadaNombre = `${empleada.nombre} ${empleada.apellido}`.trim();

    await runTransaction(db, async tx => {
      const snap = await tx.get(refSolicitud);
      if (!snap.exists()) throw { code: 'solicitud/no-existe' };

      const actual = snap.data() as Solicitud;
      if (actual.estado !== 'pendiente') throw { code: 'solicitud/ya-tomada' };

      tx.update(refSolicitud, {
        estado: 'tomada',
        empleadaUid: empleada.uid,
        empleadaNombre,
        tomada: serverTimestamp(),
      });

      tx.set(refChat, {
        solicitudId: solicitud.id,
        participantes: [actual.clienteUid, empleada.uid],
        clienteUid: actual.clienteUid,
        clienteNombre: `${actual.nombre} ${actual.apellido}`.trim(),
        empleadaUid: empleada.uid,
        empleadaNombre,
        resumen: {
          direccion: actual.direccion,
          fecha: actual.fecha,
          horario: actual.horario,
          frecuencia: actual.frecuencia,
          servicios: serviciosDe(actual),
        },
        ultimoMensaje: '',
        ultimoAutorUid: '',
        ultimoMensajeFecha: serverTimestamp(),
        creado: serverTimestamp(),
      });
    });

    return refChat.id;
  }

  /** El cliente cancela una solicitud que todavía nadie tomó. */
  async cancelar(solicitudId: string) {
    await updateDoc(doc(db, COLECCION, solicitudId), { estado: 'cancelada' });
  }

  mensajeDeError(e: any): string {
    switch (e?.code) {
      case 'solicitud/ya-tomada': return 'Otra empleada tomó este trabajo antes que vos.';
      case 'solicitud/no-existe': return 'Esta solicitud ya no existe.';
      case 'permission-denied': return 'No tenés permiso para hacer esto. Revisá las reglas de Firestore.';
      default:
        console.error(e);
        return 'Ocurrió un error. Intentá de nuevo.';
    }
  }
}