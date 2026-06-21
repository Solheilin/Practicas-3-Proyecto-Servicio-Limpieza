import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Registro } from './registro/registro';
import { Inicio } from './inicio/inicio';
import { SolicitudServicio } from './solicitud-servicio/solicitud-servicio';
import { Empleadas } from './empleadas/empleadas';
import { ListaSolicitudesComponent } from './lista-solicitudes/lista-solicitudes';
import {RegistroEmpleada} from './registro-empleada/registro-empleada';

export const routes: Routes = [
{ path: '', component: Inicio },
{ path: 'login', component: Login },
  { path: 'registro', component: Registro },
   { path: 'solicitud-servicio', component: SolicitudServicio },
    { path: 'empleadas', component: Empleadas },
    {path: 'solicitudes',component: ListaSolicitudesComponent},
     { path: 'registro-empleada',component: RegistroEmpleada}
    

];
