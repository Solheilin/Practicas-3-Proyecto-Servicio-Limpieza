import { Injectable, signal } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type TipoUsuario = 'cliente' | 'empleada' | 'admin';

// Campos que tienen todos los perfiles (la contraseña la maneja Firebase Auth, NO se guarda acá)
interface PerfilBase {
  uid: string;
  nombre: string;
  apellido: string;
  email: string;
  /** false = cuenta desactivada por un administrador (si no existe, se considera activa) */
  activo?: boolean;
}

export interface Cliente extends PerfilBase {
  tipo: 'cliente';
  telefono: string;
  direccion: string;
}

export interface Empleada extends PerfilBase {
  tipo: 'empleada';
  dni: string;
  telefono: string;
  archivoDni: string; // nombre del archivo adjuntado
}

/** Los administradores NO se registran desde la app: se crean cambiando "tipo" a "admin" en la consola de Firestore. */
export interface Administrador extends PerfilBase {
  tipo: 'admin';
}

export type Usuario = Cliente | Empleada | Administrador;

/** Datos que trae Google de alguien que entró pero todavía no completó su registro. */
export interface DatosGoogle {
  nombre: string;
  apellido: string;
  email: string;
}

// password es opcional: si el usuario entró con Google, no hace falta
type DatosCliente = Omit<Cliente, 'uid' | 'tipo' | 'activo'> & { password?: string };
type DatosEmpleada = Omit<Empleada, 'uid' | 'tipo' | 'activo'> & { password?: string };

const COLECCION_USUARIOS = 'usuarios';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  /** Usuario logueado y con perfil completo (null si no hay sesión). */
  usuarioActual = signal<Usuario | null>(null);

  /** Usuario que entró con Google pero todavía no eligió si es cliente o empleada. */
  pendienteGoogle = signal<DatosGoogle | null>(null);

  /** true mientras Firebase revisa si había una sesión abierta (al cargar la página). */
  verificandoSesion = signal(true);

  /** Se resuelve cuando Firebase terminó de revisar si había una sesión abierta. */
  readonly listo: Promise<void>;

  constructor() {
    this.listo = new Promise(resolve => {
      onAuthStateChanged(auth, async user => {
        try {
          if (!user) {
            this.usuarioActual.set(null);
            this.pendienteGoogle.set(null);
          } else {
            const perfil = await this.obtenerPerfil(user.uid);
            if (perfil?.activo === false) {
              // Un administrador desactivó la cuenta mientras tenía la sesión abierta
              await signOut(auth);
              return;
            }
            this.usuarioActual.set(perfil);
            this.pendienteGoogle.set(perfil ? null : this.datosDeGoogle(user));
          }
        } catch (error) {
          // Si Firestore falla (reglas, base no creada, sin internet) la app NO se tiene que trabar
          console.error('[Auth] No se pudo leer el perfil del usuario:', error);
          this.usuarioActual.set(null);
          this.pendienteGoogle.set(null);
        } finally {
          this.verificandoSesion.set(false);
          resolve();
        }
      });
    });
  }

  // ---------- Google ----------

  async loginConGoogle(): Promise<Usuario | null> {
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });

    const cred = await signInWithPopup(auth, proveedor);
    const perfil = await this.obtenerPerfil(cred.user.uid);
    await this.verificarActivo(perfil);

    this.usuarioActual.set(perfil);
    this.pendienteGoogle.set(perfil ? null : this.datosDeGoogle(cred.user));
    return perfil;
  }

  private datosDeGoogle(user: User): DatosGoogle {
    const partes = (user.displayName ?? '').trim().split(/\s+/);
    return {
      nombre: partes[0] ?? '',
      apellido: partes.slice(1).join(' '),
      email: user.email ?? '',
    };
  }

  // ---------- Registro ----------

  async registrarCliente(datos: DatosCliente): Promise<Cliente> {
    const { password, ...perfil } = datos;
    const user = await this.obtenerCuenta(perfil.email, password);

    const cliente: Cliente = { ...perfil, email: user.email!, uid: user.uid, tipo: 'cliente', activo: true };
    await setDoc(doc(db, COLECCION_USUARIOS, cliente.uid), { ...cliente, creado: serverTimestamp() });

    this.usuarioActual.set(cliente);
    this.pendienteGoogle.set(null);
    return cliente;
  }

  async registrarEmpleada(datos: DatosEmpleada): Promise<Empleada> {
    const { password, ...perfil } = datos;
    const user = await this.obtenerCuenta(perfil.email, password);

    const empleada: Empleada = { ...perfil, email: user.email!, uid: user.uid, tipo: 'empleada', activo: true };
    await setDoc(doc(db, COLECCION_USUARIOS, empleada.uid), { ...empleada, creado: serverTimestamp() });

    this.usuarioActual.set(empleada);
    this.pendienteGoogle.set(null);
    return empleada;
  }

  /** Con contraseña crea la cuenta; sin contraseña usa la sesión de Google ya abierta. */
  private async obtenerCuenta(email: string, password?: string): Promise<User> {
    if (password) {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      return cred.user;
    }
    if (auth.currentUser) return auth.currentUser;
    throw { code: 'auth/sin-sesion' };
  }

  // ---------- Login con correo / sesión ----------

  async login(email: string, password: string): Promise<Usuario> {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const perfil = await this.obtenerPerfil(cred.user.uid);

    if (!perfil) {
      await signOut(auth);
      throw { code: 'perfil/no-encontrado' };
    }
    await this.verificarActivo(perfil);

    this.usuarioActual.set(perfil);
    return perfil;
  }

    // ---------- Recuperar contraseña ----------

  /** Manda un correo de Firebase con un link para crear una contraseña nueva. */
  async recuperarContrasena(email: string) {
    auth.languageCode = 'es'; // el correo llega en español
    await sendPasswordResetEmail(auth, email.trim());
  }

  /** Página principal de cada tipo de usuario. */
  inicioDe(usuario: Usuario): string {
    switch (usuario.tipo) {
      case 'admin': return '/admin';
      case 'empleada': return '/solicitudes';
      default: return '/solicitud-servicio';
    }
  }

  async logout() {
    await signOut(auth);
    this.usuarioActual.set(null);
    this.pendienteGoogle.set(null);
  }

  /** Si la cuenta fue desactivada por un administrador, cierra la sesión y avisa. */
  private async verificarActivo(perfil: Usuario | null) {
    if (perfil?.activo === false) {
      await signOut(auth);
      throw { code: 'perfil/desactivado' };
    }
  }

  private async obtenerPerfil(uid: string): Promise<Usuario | null> {
    const snap = await getDoc(doc(db, COLECCION_USUARIOS, uid));
    return snap.exists() ? (snap.data() as Usuario) : null;
  }

  

  // ---------- Errores ----------

  esCancelacion(error: any): boolean {
    return error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request';
  }

  mensajeDeError(error: any): string {
    switch (error?.code) {
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con ese correo electrónico.';
      case 'auth/invalid-email':
        return 'El correo electrónico no es válido.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Correo o contraseña incorrectos.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Esperá unos minutos y volvé a probar.';
      case 'auth/network-request-failed':
        return 'Error de conexión. Revisá tu internet.';
      case 'auth/operation-not-allowed':
        return 'Este método de acceso no está habilitado en la consola de Firebase.';
      case 'auth/popup-blocked':
        return 'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes e intentá de nuevo.';
      case 'auth/unauthorized-domain':
        return 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).';
      case 'auth/account-exists-with-different-credential':
        return 'Ya existe una cuenta con ese correo usando otro método de acceso.';
      case 'auth/sin-sesion':
        return 'La sesión de Google expiró. Volvé a tocar "Continuar con Google".';
      case 'permission-denied':
        return 'Firestore rechazó la operación. Revisá que las reglas de seguridad estén publicadas.';
      case 'unavailable':
      case 'failed-precondition':
        return 'No se pudo conectar con Firestore. Revisá que la base de datos esté creada en la consola de Firebase.';
      case 'auth/invalid-api-key':
      case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
        return 'La configuración de Firebase es incorrecta. Revisá los datos en environment.ts.';
      case 'auth/configuration-not-found':
        return 'Firebase Authentication no está configurado en este proyecto.';
      case 'perfil/desactivado':
        return 'Tu cuenta fue desactivada. Comunicate con el administrador.';
      case 'perfil/no-encontrado':
        return 'Tu cuenta no tiene un perfil asociado. Registrate nuevamente.';
      default:
        console.error(error);
        return 'Ocurrió un error inesperado. Intentá de nuevo.';
    }
  }
}
