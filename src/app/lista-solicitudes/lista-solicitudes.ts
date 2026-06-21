import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SolicitudEmpleada } from '../services/solicitud-empleada';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-lista-solicitudes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lista-solicitudes.html',
  styleUrl: './lista-solicitudes.css'
})
export class ListaSolicitudesComponent implements OnInit {

  solicitudes: any[] = [];

  constructor(private solicitudService: SolicitudEmpleada) {}

  ngOnInit(): void {
    this.solicitudes = this.solicitudService.obtenerSolicitudes();
    console.log(this.solicitudes);
  }

 tomarTrabajo(index: number) {
  Swal.fire({
    icon: 'success',
    title: '¡Trabajo tomado!',
    text: 'Tomaste este trabajo. Comunicate con el cliente.',
    confirmButtonText: 'Aceptar'
  }).then(() => {
    this.solicitudes.splice(index, 1);
  });
}

}

