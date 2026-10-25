import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, map, switchMap } from 'rxjs';
import { auth } from '../firebase';
import { DatosSolicitud, Solicitud } from './solicitudes';

/** Dirección del backend propio (Node.js + Express + MySQL) */
export const API_URL = 'http://localhost:3000/api';

/**
 * CRUD de SOLICITUDES DE SERVICIO contra el BACKEND PROPIO, usando HttpClient.
 * Los datos se guardan en MySQL.
 *
 *   Listar todas (admin)     → GET    /api/solicitudes
 *   Rechazos (admin)         → GET    /api/solicitudes/rechazos
 *   Listar mis solicitudes   → GET    /api/solicitudes/mias
 *   Trabajos disponibles     → GET    /api/solicitudes/pendientes
 *   Historial de la empleada → GET    /api/solicitudes/tomadas
 *   Ver una                  → GET    /api/solicitudes/:id
 *   Alta                     → POST   /api/solicitudes
 *   Modificación             → PUT    /api/solicitudes/:id
 *   Tomar un trabajo         → POST   /api/solicitudes/:id/tomar
 *   Finalizar un trabajo     → POST   /api/solicitudes/:id/finalizar
 *   Rechazar un trabajo      → POST   /api/solicitudes/:id/rechazar
 *   Baja                     → DELETE /api/solicitudes/:id
 */
@Injectable({
  providedIn: 'root',
})
export class SolicitudesApiService {
  private http = inject(HttpClient);
  private readonly base = `${API_URL}/solicitudes`;

  // ---------- Operaciones del CRUD ----------

  /** GET: todas las solicitudes (solo el administrador, para las estadísticas) */
  listarTodas(): Observable<Solicitud[]> {
    return this.conToken(headers => this.http.get<SolicitudJson[]>(this.base, { headers }))
      .pipe(map(lista => lista.map(aSolicitud)));
  }

  /** GET: historial de rechazos (solo el administrador, para las estadísticas) */
  listarRechazos(): Observable<Rechazo[]> {
    return this.conToken(headers => this.http.get<Rechazo[]>(`${this.base}/rechazos`, { headers }));
  }

  /** GET: solicitudes del cliente logueado */
  listarMias(): Observable<Solicitud[]> {
    return this.conToken(headers => this.http.get<SolicitudJson[]>(`${this.base}/mias`, { headers }))
      .pipe(map(lista => lista.map(aSolicitud)));
  }

  /** GET: trabajos sin empleada asignada (para las empleadas) */
  listarPendientes(): Observable<Solicitud[]> {
    return this.conToken(headers => this.http.get<SolicitudJson[]>(`${this.base}/pendientes`, { headers }))
      .pipe(map(lista => lista.map(aSolicitud)));
  }

  /** GET: trabajos que tomó la empleada logueada (su historial) */
  listarTomadas(): Observable<Solicitud[]> {
    return this.conToken(headers => this.http.get<SolicitudJson[]>(`${this.base}/tomadas`, { headers }))
      .pipe(map(lista => lista.map(aSolicitud)));
  }

  /** GET: una solicitud por id */
  obtener(id: string): Observable<Solicitud> {
    return this.conToken(headers => this.http.get<SolicitudJson>(`${this.base}/${id}`, { headers }))
      .pipe(map(aSolicitud));
  }

  /** POST: alta de una solicitud nueva */
  crear(datos: DatosSolicitud): Observable<Solicitud> {
    return this.conToken(headers => this.http.post<SolicitudJson>(this.base, datos, { headers }))
      .pipe(map(aSolicitud));
  }

  /** PUT: modificación de una solicitud (solo si sigue pendiente) */
  actualizar(id: string, datos: DatosSolicitud): Observable<Solicitud> {
    return this.conToken(headers => this.http.put<SolicitudJson>(`${this.base}/${id}`, datos, { headers }))
      .pipe(map(aSolicitud));
  }

  /** POST: una empleada toma un trabajo */
  tomar(id: string): Observable<Solicitud> {
    return this.conToken(headers => this.http.post<SolicitudJson>(`${this.base}/${id}/tomar`, {}, { headers }))
      .pipe(map(aSolicitud));
  }

  /** POST: la empleada marca el trabajo como finalizado */
  finalizar(id: string): Observable<Solicitud> {
    return this.conToken(headers => this.http.post<SolicitudJson>(`${this.base}/${id}/finalizar`, {}, { headers }))
      .pipe(map(aSolicitud));
  }

  /** POST: la empleada rechaza (devuelve) un trabajo que había tomado */
  rechazar(id: string): Observable<Solicitud> {
    return this.conToken(headers => this.http.post<SolicitudJson>(`${this.base}/${id}/rechazar`, {}, { headers }))
      .pipe(map(aSolicitud));
  }

  /** DELETE: baja de una solicitud (solo si sigue pendiente) */
  eliminar(id: string): Observable<void> {
    return this.conToken(headers => this.http.delete<void>(`${this.base}/${id}`, { headers }));
  }

  // ---------- Ayudas ----------

  /** Agrega el token de Firebase del usuario: el backend lo verifica para saber quién es. */
  private conToken<T>(pedido: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    const usuario = auth.currentUser;
    if (!usuario) throw new Error('No hay sesión iniciada');

    return from(usuario.getIdToken()).pipe(
      switchMap(token => pedido(new HttpHeaders({ Authorization: `Bearer ${token}` })))
    );
  }

  /** Mensaje para mostrar al usuario: usa el que manda el backend si existe. */
  mensajeDeError(e: any): string {
    if (e?.status === 0) {
      return 'No se pudo conectar con el servidor. ¿Está corriendo el backend (npm start en la carpeta backend)?';
    }
    if (e?.error?.error) return e.error.error;   // mensaje del backend
    console.error(e);
    return 'Ocurrió un error con el servidor. Intentá de nuevo.';
  }
}

/** Un rechazo: una empleada devolvió un trabajo que había tomado */
export interface Rechazo {
  id: string;
  solicitudId: string;
  empleadaUid: string;
  empleadaNombre: string;
  rechazadaEn?: string;
}

/** Así llega una solicitud desde el backend (las fechas vienen como texto) */
type SolicitudJson = Omit<Solicitud, 'creada'> & { creada?: string };

function aSolicitud(s: SolicitudJson): Solicitud {
  return { ...s, creada: s.creada ? new Date(s.creada) : undefined };
}