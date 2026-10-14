import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-registro',
  imports: [RouterLink, FormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro implements OnInit {
  nombre: string = '';
  apellido: string = '';
  email: string = '';
  password: string = '';
  direccion: string = '';
  telefono: string = '';

  /** true cuando la persona entró con Google: no se pide contraseña y el correo es el de Google */
  conGoogle = false;
  cargando = false;

  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit() {
    // Si viene del login con Google, completamos con sus datos
    await this.auth.listo;
    this.cargarDatosGoogle();
  }

  async continuarConGoogle() {
    if (this.cargando) return;
    this.cargando = true;

    try {
      const usuario = await this.auth.loginConGoogle();

      if (usuario) {
        // Ya tenía cuenta: lo mandamos a su pantalla
        await Swal.fire({
          title: 'Ya tenés una cuenta',
          text: `Hola ${usuario.nombre}, iniciaste sesión.`,
          icon: 'info',
          confirmButtonColor: '#58c69d'
          
        });
      this.router.navigate([this.auth.inicioDe(usuario)]);
        return;
      }

      this.cargarDatosGoogle();
      Swal.fire({
        title: 'Casi listo',
        text: 'Completá tu teléfono y dirección para terminar el registro.',
        icon: 'info',
        confirmButtonColor: '#58c69d'
      });

    } catch (error) {
      if (!this.auth.esCancelacion(error)) {
        Swal.fire({ title: 'Error', text: this.auth.mensajeDeError(error), icon: 'error', confirmButtonColor: '#e74c3c' });
      }
    } finally {
      this.cargando = false;
    }
  }

  private cargarDatosGoogle() {
    const datos = this.auth.pendienteGoogle();
    if (!datos) return;
    this.conGoogle = true;
    this.nombre = this.nombre || datos.nombre;
    this.apellido = this.apellido || datos.apellido;
    this.email = datos.email;
  }

  async registrar() {
    if (
      !this.nombre.trim() ||
      !this.apellido.trim() ||
      !String(this.telefono).trim() ||
      !this.direccion.trim() ||
      !this.email.trim() ||
      (!this.conGoogle && !this.password.trim())
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

    if (this.cargando) return;
    this.cargando = true;

    try {
      await this.auth.registrarCliente({
        nombre: this.nombre.trim(),
        apellido: this.apellido.trim(),
        email: this.email,
        telefono: String(this.telefono),
        direccion: this.direccion.trim(),
        password: this.conGoogle ? undefined : this.password
      });

      await Swal.fire({
        title: '¡Registro exitoso!',
        text: `Bienvenido ${this.nombre}`,
        icon: 'success',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#58c69d'
      });
      // La sesión queda iniciada al registrarse
      this.router.navigate(['/solicitud-servicio']);

    } catch (error) {
      Swal.fire({
        title: 'No se pudo registrar',
        text: this.auth.mensajeDeError(error),
        icon: 'error',
        confirmButtonColor: '#e74c3c'
      });
    } finally {
      this.cargando = false;
    }
  }
}

