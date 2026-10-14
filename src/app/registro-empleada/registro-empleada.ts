import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth';
import { MenuSesion } from '../menu-sesion/menu-sesion';

@Component({
  selector: 'app-registro-empleada',
  imports: [MenuSesion, FormsModule, RouterLink],
  templateUrl: './registro-empleada.html',
  styleUrl: './registro-empleada.css',
})
export class RegistroEmpleada implements OnInit {
  nombre = '';
  apellido = '';
  dni = '';
  telefono = '';
  email = '';
  password = '';

  archivoDni: File | null = null;

  /** true cuando la persona entró con Google: no se pide contraseña y el correo es el de Google */
  conGoogle = false;
  cargando = false;

  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit() {
    // Si viene del login con Google, completamos con sus datos
    await this.auth.listo;
    this.cargarDatosGoogle();
  }

  seleccionarArchivo(event: Event) {
    const input = event.target as HTMLInputElement;
    this.archivoDni = input.files?.[0] ?? null;
  }

  async continuarConGoogle() {
    if (this.cargando) return;
    this.cargando = true;

    try {
      const usuario = await this.auth.loginConGoogle();

      if (usuario) {
        // Ya tenía cuenta: la mandamos a su pantalla
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
        text: 'Completá tu DNI, teléfono y la foto del DNI para terminar el registro.',
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

  async registrarEmpleada() {
    if (
      !this.nombre.trim() ||
      !this.apellido.trim() ||
      !String(this.dni).trim() ||
      !String(this.telefono).trim() ||
      !this.email.trim() ||
      (!this.conGoogle && this.password.length < 6)
    ) {
      Swal.fire({
        title: 'Campos incompletos',
        text: 'Debe completar todos los campos obligatorios',
        icon: 'warning',
        confirmButtonColor: '#f39c12'
      });
      return;
    }

    // El input de archivo no usa ngModel, así que el formulario no lo valida solo
    if (!this.archivoDni) {
      Swal.fire({
        title: 'Falta la foto del DNI',
        text: 'Adjunte una foto o PDF de su DNI',
        icon: 'warning',

        confirmButtonColor: '#f39c12'
      });
      return;
    }

    if (this.cargando) return;
    this.cargando = true;

    try {
      await this.auth.registrarEmpleada({
        nombre: this.nombre.trim(),
        apellido: this.apellido.trim(),
        dni: String(this.dni),
        telefono: String(this.telefono),
        email: this.email,
        password: this.conGoogle ? undefined : this.password,
        archivoDni: this.archivoDni.name
      });

      await Swal.fire({
        title: '¡Registro exitoso!',
        text: `Bienvenida ${this.nombre}`,
        icon: 'success',
        confirmButtonColor: '#58c69d'
      });
      // La sesión queda iniciada al registrarse
      this.router.navigate(['/solicitudes']);

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