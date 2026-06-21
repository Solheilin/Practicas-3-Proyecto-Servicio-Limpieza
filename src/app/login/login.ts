import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  email: string = '';
  password: string = '';

  constructor(private router: Router) {}

  login() {

    const usuarioGuardado = localStorage.getItem('usuario');

    if (!usuarioGuardado) {

      Swal.fire({
        title: 'Sin usuarios',
        text: 'No hay usuarios registrados',
        icon: 'warning',
        confirmButtonColor: '#f39c12'
      });

      return;
    }

    const usuario = JSON.parse(usuarioGuardado);

    if (
      this.email === usuario.email &&
      this.password === usuario.password
    ) {

      localStorage.setItem('logueado', 'true');
  localStorage.setItem('usuarioLogueado', JSON.stringify(usuario));

      Swal.fire({
        title: '¡Bienvenido!',
        text: `Hola ${usuario.nombre}`,
        icon: 'success',
        confirmButtonColor: '#58c69d'
      }).then(() => {
        this.router.navigate(['/solicitud-servicio']);
      });

    } else {

      Swal.fire({
        title: 'Error',
        text: 'Correo o contraseña incorrectos',
        icon: 'error',
        confirmButtonColor: '#e74c3c'
      });

    }
  }
}
