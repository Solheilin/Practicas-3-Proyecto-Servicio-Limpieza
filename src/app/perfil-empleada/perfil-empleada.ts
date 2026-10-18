import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { MenuSesion } from '../menu-sesion/menu-sesion';
import { AuthService } from '../services/auth';
import {
  PerfilEmpleada, PerfilesApiService, Resena, SERVICIOS_EMPLEADA, achicarImagen,
} from '../services/perfiles-api';

/**
 * PERFIL DE LA EMPLEADA
 *  - /perfil-empleada       → su propio perfil (lo puede editar)
 *  - /perfil-empleada/:uid  → perfil de una empleada (lo ve un cliente, solo lectura)
 */
@Component({
  selector: 'app-perfil-empleada',
  imports: [MenuSesion, FormsModule, RouterLink, DatePipe],
  templateUrl: './perfil-empleada.html',
  styleUrl: './perfil-empleada.css',
})
export class PerfilEmpleadaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private api = inject(PerfilesApiService);

  servicios = SERVICIOS_EMPLEADA;

  perfil = signal<PerfilEmpleada | null>(null);
  resenas = signal<Resena[]>([]);
  cargando = signal(true);
  error = signal('');

  /** true si es el perfil de la empleada logueada (puede editarlo) */
  esMio = signal(false);
  editando = signal(false);
  guardando = signal(false);

  // Campos del formulario de edición
  formDescripcion = '';
  formAnios = 0;
  formServicios = new Set<string>();
  formFoto: string | null = null;

  /** Servicios que ofrece y que no ofrece */
  ofrece = computed(() => this.servicios.filter(s => this.perfil()?.servicios.includes(s.clave)));
  noOfrece = computed(() => this.servicios.filter(s => !this.perfil()?.servicios.includes(s.clave)));

  inicial = computed(() => this.perfil()?.nombre?.charAt(0).toUpperCase() || '?');

  private uid = '';

  ngOnInit() {
    const usuario = this.auth.usuarioActual();
    this.uid = this.route.snapshot.paramMap.get('uid') ?? usuario?.uid ?? '';
    this.esMio.set(usuario?.tipo === 'empleada' && usuario.uid === this.uid);
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set('');

    this.api.obtenerPerfil(this.uid).subscribe({
      next: perfil => {
        // Si todavía no completó su perfil, usamos el nombre de su cuenta
        const usuario = this.auth.usuarioActual();
        if (!perfil.nombre && this.esMio() && usuario) perfil.nombre = `${usuario.nombre} ${usuario.apellido}`;
        this.perfil.set(perfil);
        this.cargando.set(false);
        // Primera vez: le abrimos directamente el formulario
        if (this.esMio() && !perfil.completo) this.empezarEdicion();
      },
      error: e => {
        this.error.set(this.api.mensajeDeError(e));
        this.cargando.set(false);
      },
    });

    this.api.listarResenas(this.uid).subscribe({
      next: lista => this.resenas.set(lista),
      error: e => console.error(e),
    });
  }

  /** Para dibujar ★★★★☆ */
  estrellas(puntaje: number): string {
    const redondeado = Math.round(puntaje);
    return '★'.repeat(redondeado) + '☆'.repeat(5 - redondeado);
  }

  // ---------- Edición (solo su propio perfil) ----------

  empezarEdicion() {
    const p = this.perfil();
    this.formDescripcion = p?.descripcion ?? '';
    this.formAnios = p?.aniosExperiencia ?? 0;
    this.formServicios = new Set(p?.servicios ?? []);
    this.formFoto = p?.foto ?? null;
    this.editando.set(true);
  }

  alternarServicio(clave: string) {
    this.formServicios.has(clave) ? this.formServicios.delete(clave) : this.formServicios.add(clave);
  }

  async elegirFoto(evento: Event) {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    try {
      this.formFoto = await achicarImagen(archivo);
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Foto no válida', text: e.message, confirmButtonColor: '#e74c3c' });
    }
  }

  guardar() {
    if (this.formAnios < 0 || this.formAnios > 70) {
      Swal.fire({ icon: 'warning', title: 'Revisá los años de experiencia', text: 'Tiene que ser un número entre 0 y 70.' });
      return;
    }

    this.guardando.set(true);
    this.api.guardarPerfil({
      descripcion: this.formDescripcion,
      aniosExperiencia: Number(this.formAnios),
      servicios: [...this.formServicios],
      foto: this.formFoto,
    }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(false);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Perfil actualizado', showConfirmButton: false, timer: 2500 });
        this.cargar();
      },
      error: e => {
        this.guardando.set(false);
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: this.api.mensajeDeError(e), confirmButtonColor: '#e74c3c' });
      },
    });
  }
}