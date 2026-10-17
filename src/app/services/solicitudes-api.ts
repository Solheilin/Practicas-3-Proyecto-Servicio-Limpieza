import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, from, map, switchMap } from 'rxjs';
import { auth, firebaseApp } from '../firebase';
import { DatosSolicitud, Solicitud } from './solicitudes';

/**
 * ABM de SOLICITUDES DE SERVICIO (objeto de negocio) contra la API REST de Cloud Firestore,
 * usando HttpClient. Lo usa el CLIENTE para administrar sus pedidos:
 *
 *   Listar mis solicitudes → POST   /documents:runQuery   (consulta filtrada por cliente)
 *   Ver una                → GET    /solicitudes/{id}
 *   Alta                   → POST   /solicitudes
 *   Modificación           → PATCH  /solicitudes/{id}
 *   Baja                   → DELETE /solicitudes/{id}
 *
 * Documentación: https://firebase.google.com/docs/firestore/use-rest-api
 */
@Injectable({
  providedIn: 'root',
})
export class SolicitudesApiService {
  private http = inject(HttpClient);

  private readonly documentos =
    `https://firestore.googleapis.com/v1/projects/${firebaseApp.options.projectId}/databases/(default)/documents`;
  private readonly base = `${this.documentos}/solicitudes`;

  /** Campos que el cliente puede cargar y modificar */
  private readonly camposEditables: (keyof DatosSolicitud)[] = [
    'nombre', 'apellido', 'correo', 'telefono', 'direccion', 'requerimientos',
    'planchar', 'lavar', 'cocina', 'cuidadoNinos', 'camaAdentro',
    'fecha', 'horario', 'frecuencia',
  ];

  // ---------- Operaciones del ABM ----------

  /** LISTADO: solicitudes del cliente logueado (consulta con filtro). */
  listarMias(clienteUid: string): Observable<Solicitud[]> {
    const consulta = {
      structuredQuery: {
        from: [{ collectionId: 'solicitudes' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'clienteUid' },
            op: 'EQUAL',
            value: { stringValue: clienteUid },
          },
        },
      },
    };

    return this.conToken(headers =>
      this.http.post<{ document?: DocumentoFirestore }[]>(`${this.documentos}:runQuery`, consulta, { headers })
    ).pipe(
      map(filas => filas
        .filter(f => f.document)
        .map(f => this.desdeFirestore(f.document!))
        .sort((a, b) => (b.creada?.getTime() ?? 0) - (a.creada?.getTime() ?? 0)))
    );
  }

  /** GET: una solicitud por id (para editarla). */
  obtener(id: string): Observable<Solicitud> {
    return this.conToken(headers =>
      this.http.get<DocumentoFirestore>(`${this.base}/${id}`, { headers })
    ).pipe(map(d => this.desdeFirestore(d)));
  }

  /** POST: alta de una solicitud nueva (queda "pendiente" hasta que una empleada la tome). */
  crear(clienteUid: string, datos: DatosSolicitud): Observable<Solicitud> {
    const cuerpo = {
      fields: {
        ...this.camposAFirestore(datos),
        clienteUid: { stringValue: clienteUid },
        estado: { stringValue: 'pendiente' },
        creada: { timestampValue: new Date().toISOString() },
      },
    };

    return this.conToken(headers =>
      this.http.post<DocumentoFirestore>(this.base, cuerpo, { headers })
    ).pipe(map(d => this.desdeFirestore(d)));
  }

  /** PATCH: modificación. Solo se envían los campos editables (no el estado ni el cliente). */
  actualizar(id: string, datos: DatosSolicitud): Observable<Solicitud> {
    let params = new HttpParams().set('currentDocument.exists', 'true'); // no crear si no existe
    for (const campo of this.camposEditables) {
      params = params.append('updateMask.fieldPaths', campo);
    }

    return this.conToken(headers =>
      this.http.patch<DocumentoFirestore>(`${this.base}/${id}`, { fields: this.camposAFirestore(datos) }, { headers, params })
    ).pipe(map(d => this.desdeFirestore(d)));
  }

  /** DELETE: baja de una solicitud (solo mientras ninguna empleada la tomó). */
  eliminar(id: string): Observable<void> {
    return this.conToken(headers =>
      this.http.delete<void>(`${this.base}/${id}`, { headers })
    );
  }

  // ---------- Ayudas ----------

  /** Agrega el token del usuario logueado: la API lo usa para aplicar las reglas de seguridad. */
  private conToken<T>(pedido: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    const usuario = auth.currentUser;
    if (!usuario) throw new Error('No hay sesión iniciada');

    return from(usuario.getIdToken()).pipe(
      switchMap(token => pedido(new HttpHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      })))
    );
  }

  /** La API REST pide cada campo con su tipo: { "nombre": { "stringValue": "Ana" } } */
  private camposAFirestore(datos: DatosSolicitud): Record<string, ValorFirestore> {
    const campos: Record<string, ValorFirestore> = {};
    for (const campo of this.camposEditables) {
      const valor = datos[campo];
      campos[campo] = typeof valor === 'boolean'
        ? { booleanValue: valor }
        : { stringValue: String(valor ?? '').trim() };
    }
    return campos;
  }

  /** Convierte la respuesta de la API en un objeto Solicitud común. */
  private desdeFirestore(doc: DocumentoFirestore): Solicitud {
    const datos: any = { id: doc.name.split('/').pop() };
    for (const [clave, valor] of Object.entries(doc.fields ?? {})) {
      if (valor.stringValue !== undefined) datos[clave] = valor.stringValue;
      else if (valor.booleanValue !== undefined) datos[clave] = valor.booleanValue;
      else if (valor.timestampValue !== undefined) datos[clave] = new Date(valor.timestampValue);
      else if (valor.integerValue !== undefined) datos[clave] = Number(valor.integerValue);
      else if (valor.doubleValue !== undefined) datos[clave] = valor.doubleValue;
    }
    return datos as Solicitud;
  }

  /** Traduce los errores HTTP a mensajes en español. */
  mensajeDeError(e: any): string {
    switch (e?.status) {
      case 0: return 'No hay conexión con la API. Revisá tu internet.';
      case 400: return 'Los datos enviados no son válidos.';
      case 401:
      case 403: return 'No tenés permiso. Solo podés modificar o eliminar tus solicitudes que todavía no tomó ninguna empleada.';
      case 404: return 'La solicitud ya no existe.';
      default:
        console.error(e);
        return 'Ocurrió un error con la API. Intentá de nuevo.';
    }
  }
}

// Formato de las respuestas de la API REST de Firestore
interface ValorFirestore {
  stringValue?: string;
  booleanValue?: boolean;
  timestampValue?: string;
  integerValue?: string;
  doubleValue?: number;
}

interface DocumentoFirestore {
  name: string;
  fields?: Record<string, ValorFirestore>;
}