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
import { soloAdmin, soloClientes, soloEmpleadas, soloInvitados, soloLogueados } from './guards';

export const routes: Routes = [
  // Públicas
  { path: '', component: Inicio },
  { path: 'empleadas', component: Empleadas },

  // Solo para quien NO inició sesión
  { path: 'login', component: Login, canActivate: [soloInvitados] },
  { path: 'registro', component: Registro, canActivate: [soloInvitados] },
  { path: 'registro-empleada', component: RegistroEmpleada, canActivate: [soloInvitados] },

  // Solo clientes logueados
  { path: 'solicitud-servicio', component: SolicitudServicio, canActivate: [soloClientes] },

  // Solo empleadas logueadas
  { path: 'solicitudes', component: ListaSolicitudesComponent, canActivate: [soloEmpleadas] },

  // Solo administradores
  { path: 'admin', component: AdminUsuarios, canActivate: [soloAdmin] },

  // Mensajes: cualquier usuario logueado
  { path: 'chats', component: MisChats, canActivate: [soloLogueados] },
  { path: 'chats/:id', component: Chat, canActivate: [soloLogueados] },

  // Cualquier otra dirección va al inicio (tiene que ir SIEMPRE al final)
  { path: '**', redirectTo: '' },
];
