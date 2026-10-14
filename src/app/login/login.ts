import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService, Usuario } from '../services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  email: string = '';
  password: string = '';
  cargando = false;

  constructor(private router: Router, private auth: AuthService) {}

  async login() {
    if (!this.email.trim() || !this.password) {
      Swal.fire({
        title: 'Campos incompletos',
        text: 'Ingresá tu correo y contraseña',
        icon: 'warning',
        confirmButtonColor: '#f39c12'
      });
      return;
    }

    if (this.cargando) return;
    this.cargando = true;

    try {
      const usuario = await this.auth.login(this.email, this.password);
      await this.bienvenida(usuario);
    } catch (error) {
      this.mostrarError(error);
    } finally {
      this.cargando = false;
    }
  }

  async loginConGoogle() {
    if (this.cargando) return;
    this.cargando = true;

    try {
      const usuario = await this.auth.loginConGoogle();

      if (usuario) {
        await this.bienvenida(usuario);
        return;
      }

      // Es la primera vez que entra: tiene que elegir qué tipo de cuenta quiere
      const datos = this.auth.pendienteGoogle();
      const eleccion = await Swal.fire({
        title: `¡Hola ${datos?.nombre ?? ''}!`,
        text: 'Es tu primera vez. ¿Cómo querés usar la app?',
        icon: 'question',
        showDenyButton: true,
        confirmButtonText: 'Quiero contratar un servicio',
        denyButtonText: 'Quiero trabajar',
        confirmButtonColor: '#58c69d',
        denyButtonColor: '#3498db',
        allowOutsideClick: false
      });

      this.router.navigate([eleccion.isDenied ? '/registro-empleada' : '/registro']);

    } catch (error) {
      if (!this.auth.esCancelacion(error)) this.mostrarError(error);
    } finally {
      this.cargando = false;
    }
  }

  private async bienvenida(usuario: Usuario) {
    // Cada tipo de usuario va a su pantalla
    const destino = this.auth.inicioDe(usuario);

    await Swal.fire({
      title: '¡Bienvenido!',
      text: `Hola ${usuario.nombre}`,
      icon: 'success',
      confirmButtonColor: '#58c69d'
    });
    this.router.navigate([destino]);
  }

  private mostrarError(error: unknown) {
    Swal.fire({
      title: 'Error',
      text: this.auth.mensajeDeError(error),
      icon: 'error',
      confirmButtonColor: '#e74c3c'
    });
  }
}