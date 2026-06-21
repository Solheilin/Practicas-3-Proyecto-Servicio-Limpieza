import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SolicitudEmpleada {

  solicitudes: any[] = [];

  constructor() {
    const datos = localStorage.getItem('solicitudes');

    if (datos) {
      this.solicitudes = JSON.parse(datos);
    }
  }

  agregarSolicitud(solicitud: any) {
    this.solicitudes.push(solicitud);

    localStorage.setItem(
      'solicitudes',
      JSON.stringify(this.solicitudes)
    );
  }

  obtenerSolicitudes() {
    return JSON.parse(localStorage.getItem('solicitudes') || '[]');
  }

}

let datos = JSON.parse(localStorage.getItem('solicitudes') || '[]');

datos.splice(6, 1);

localStorage.setItem('solicitudes', JSON.stringify(datos));
