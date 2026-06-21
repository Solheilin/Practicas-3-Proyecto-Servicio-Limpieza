import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-registro',
  imports: [RouterLink,FormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  nombre: string = '';
  apellido: string = '';
  email: string = '';
  password: string = '';
  direccion: string = '';
  telefono: string= '';

  registrar() {

  if (
    !this.nombre.trim() ||
    !this.apellido.trim() ||
    !this.telefono ||
    !this.direccion.trim() ||
    !this.email.trim() ||
    !this.password.trim()
  ) {

    Swal.fire({
      title: 'Campos incompletos',
      text: 'Debe completar todos los campos',
      icon: 'warning',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#f39c12'
    });

    return;
  }

  const usuario = {
    nombre: this.nombre,
    apellido: this.apellido,
    email: this.email,
    telefono: this.telefono,
    direccion: this.direccion,
    password: this.password
  };

  console.log('Usuario a guardar:', usuario);

localStorage.setItem(
  'usuario',
  JSON.stringify(usuario)
);

console.log('Usuario guardado en localStorage');
console.log(localStorage.getItem('usuario'));
  

  Swal.fire({
    title: '¡Registro exitoso!',
    text: `Bienvenido ${this.nombre}`,
    icon: 'success',
    confirmButtonText: 'Aceptar',
    confirmButtonColor: '#58c69d'
  });

}
  }
