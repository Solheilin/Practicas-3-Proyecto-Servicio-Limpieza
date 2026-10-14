import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService, TipoUsuario } from './services/auth';

// Aviso chiquito en la esquina (no bloquea la pantalla)
const aviso = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

/** Solo deja pasar a usuarios logueados del tipo indicado. */
function soloTipo(tipo: TipoUsuario): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.listo;
    const usuario = auth.usuarioActual();

    if (!usuario) {
      aviso.fire({ icon: 'info', title: 'Iniciá sesión para continuar' });
      return router.createUrlTree(['/login']);
    }

    if (usuario.tipo !== tipo) {
      const nombres = { cliente: 'clientes', empleada: 'empleadas', admin: 'administradores' };
      aviso.fire({ icon: 'warning', title: `Esa sección es solo para ${nombres[tipo]}` });
      return router.createUrlTree([auth.inicioDe(usuario)]);
    }

    return true;
  };
}

export const soloClientes = soloTipo('cliente');
export const soloEmpleadas = soloTipo('empleada');
export const soloAdmin = soloTipo('admin');

/** Cualquier usuario logueado (cliente, empleada o admin). */
export const soloLogueados: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.listo;
  if (auth.usuarioActual()) return true;

  aviso.fire({ icon: 'info', title: 'Iniciá sesión para continuar' });
  return router.createUrlTree(['/login']);
};

/** Para login y registros: si ya tiene sesión iniciada, lo manda a su página. */
export const soloInvitados: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.listo;
  const usuario = auth.usuarioActual();

  return usuario ? router.createUrlTree([auth.inicioDe(usuario)]) : true;
};
