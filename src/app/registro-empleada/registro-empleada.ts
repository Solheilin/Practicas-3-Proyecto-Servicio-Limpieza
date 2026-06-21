import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-registro-empleada',
  imports: [FormsModule,],
  templateUrl: './registro-empleada.html',
  styleUrl: './registro-empleada.css',
  
})
export class RegistroEmpleada {
  nombre = '';
  apellido = '';
  dni = '';
  telefono = '';
  email = '';
  password = '';

  archivoDni!: File;

  seleccionarArchivo(event: any) {
    this.archivoDni = event.target.files[0];
}
registrarEmpleada() {

    console.log({
      nombre: this.nombre,
      apellido: this.apellido,
      dni: this.dni,
      telefono: this.telefono,
      email: this.email,
      password: this.password,
      archivo: this.archivoDni
    });

  }

}