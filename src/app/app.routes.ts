import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Registro } from './registro/registro';
import { Inicio } from './inicio/inicio';
import { SolicitudServicio } from './solicitud-servicio/solicitud-servicio';
import { Empleadas } from './empleadas/empleadas';
import { ListaSolicitudesComponent } from './lista-solicitudes/lista-solicitudes';
import { RegistroEmpleada } from './registro-empleada/registro-empleada';
import { AdminUsuarios } from './admin-usuarios/admin-usuarios';
import { MisChats } from './mis-chats/mis-chats';
import { Chat } from './chat/chat';
import { MisSolicitudes } from './mis-solicitudes/mis-solicitudes';
import { PerfilEmpleadaComponent } from './perfil-empleada/perfil-empleada';
import { soloAdmin, soloClientes, soloEmpleadas, soloInvitados, soloLogueados } from './guards';

export const routes: Routes = [
  // Públicas
  { path: '', component: Inicio },
  { path: 'empleadas', component: Empleadas },

  // Solo para quien NO inició sesión
  { path: 'login', component: Login, canActivate: [soloInvitados] },
  { path: 'registro', component: Registro, canActivate: [soloInvitados] },
  { path: 'registro-empleada', component: RegistroEmpleada, canActivate: [soloInvitados] },

  // Solo clientes: ABM de solicitudes
  { path: 'solicitud-servicio', component: SolicitudServicio, canActivate: [soloClientes] },      // alta
  { path: 'solicitud-servicio/:id', component: SolicitudServicio, canActivate: [soloClientes] },  // modificación
  { path: 'mis-solicitudes', component: MisSolicitudes, canActivate: [soloClientes] },            // listado y baja

  // Solo empleadas
  { path: 'solicitudes', component: ListaSolicitudesComponent, canActivate: [soloEmpleadas] },
  { path: 'perfil-empleada', component: PerfilEmpleadaComponent, canActivate: [soloEmpleadas] },  // su propio perfil

  // Perfil de una empleada (lo puede ver un cliente)
  { path: 'perfil-empleada/:uid', component: PerfilEmpleadaComponent, canActivate: [soloLogueados] },

  // Solo administradores
  { path: 'admin', component: AdminUsuarios, canActivate: [soloAdmin] },

  // Mensajes: cualquier usuario logueado
  { path: 'chats', component: MisChats, canActivate: [soloLogueados] },
  { path: 'chats/:id', component: Chat, canActivate: [soloLogueados] },

  // Cualquier otra dirección va al inicio (tiene que ir SIEMPRE al final)
  { path: '**', redirectTo: '' },
];