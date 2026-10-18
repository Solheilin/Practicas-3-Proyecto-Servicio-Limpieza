import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { auth } from '../firebase';
import { API_URL } from './solicitudes-api';

/** Servicios que puede ofrecer una empleada (clave → texto para mostrar) */
export const SERVICIOS_EMPLEADA: { clave: string; nombre: string; icono: string }[] = [
  { clave: 'limpieza', nombre: 'Limpieza general', icono: '🧹' },
  { clave: 'planchar', nombre: 'Planchado', icono: '👕' },
  { clave: 'lavar', nombre: 'Lavado de ropa', icono: '🧺' },
  { clave: 'cocina', nombre: 'Cocina', icono: '🍳' },
  { clave: 'cuidadoNinos', nombre: 'Cuidado de niños', icono: '🧸' },
  { clave: 'camaAdentro', nombre: 'Cama adentro', icono: '🛏️' },
];

export interface PerfilEmpleada {
  empleadaUid: string;
  nombre: string;
  descripcion: string;
  aniosExperiencia: number;
  servicios: string[];
  foto: string | null;
  completo: boolean;
  resenas: { cantidad: number; promedio: number };
  trabajos: { enCurso: number; finalizados: number };
}

export interface Resena {
  id: string;
  clienteNombre: string;
  puntaje: number;
  comentario: string;
  fechaTrabajo: string;
  creada?: string;
}

export interface DatosPerfil {
  descripcion: string;
  aniosExperiencia: number;
  servicios: string[];
  foto: string | null;
}

/**
 * Perfil de empleadas y reseñas, contra el backend propio (MySQL).
 *
 *   Ver perfil       → GET  /api/empleadas/:uid/perfil
 *   Guardar perfil   → PUT  /api/empleadas/perfil
 *   Ver reseñas      → GET  /api/empleadas/:uid/resenas
 *   Calificar        → POST /api/resenas
 */
@Injectable({
  providedIn: 'root',
})
export class PerfilesApiService {
  private http = inject(HttpClient);

  obtenerPerfil(uid: string): Observable<PerfilEmpleada> {
    return this.conToken(headers => this.http.get<PerfilEmpleada>(`${API_URL}/empleadas/${uid}/perfil`, { headers }));
  }

  guardarPerfil(datos: DatosPerfil): Observable<{ ok: boolean }> {
    return this.conToken(headers => this.http.put<{ ok: boolean }>(`${API_URL}/empleadas/perfil`, datos, { headers }));
  }

  listarResenas(uid: string): Observable<Resena[]> {
    return this.conToken(headers => this.http.get<Resena[]>(`${API_URL}/empleadas/${uid}/resenas`, { headers }));
  }

  calificar(solicitudId: string, puntaje: number, comentario: string): Observable<{ ok: boolean }> {
    return this.conToken(headers =>
      this.http.post<{ ok: boolean }>(`${API_URL}/resenas`, { solicitudId, puntaje, comentario }, { headers })
    );
  }

  private conToken<T>(pedido: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    const usuario = auth.currentUser;
    if (!usuario) throw new Error('No hay sesión iniciada');

    return from(usuario.getIdToken()).pipe(
      switchMap(token => pedido(new HttpHeaders({ Authorization: `Bearer ${token}` })))
    );
  }

  mensajeDeError(e: any): string {
    if (e?.status === 0) {
      return 'No se pudo conectar con el servidor. ¿Está corriendo el backend (npm start en la carpeta backend)?';
    }
    if (e?.error?.error) return e.error.error;
    console.error(e);
    return 'Ocurrió un error con el servidor. Intentá de nuevo.';
  }
}

/**
 * Achica una imagen en el navegador (máximo 300 x 300 px, formato JPEG)
 * para poder guardarla en la base sin que pese mucho.
 */
export function achicarImagen(archivo: File, tamanio = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida'));
      img.onload = () => {
        const escala = Math.min(1, tamanio / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = lector.result as string;
    };
    lector.readAsDataURL(archivo);
  });
}