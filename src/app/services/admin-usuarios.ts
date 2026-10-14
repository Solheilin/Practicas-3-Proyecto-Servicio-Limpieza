import { Injectable } from '@angular/core';
import { collection, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Usuario } from './auth';

/** Usuario tal como lo ve el panel de administración (con la fecha de alta ya convertida). */
export type UsuarioAdmin = Usuario & { creado?: Date };

@Injectable({
  providedIn: 'root',
})
export class AdminUsuariosService {

  async listar(): Promise<UsuarioAdmin[]> {
    const snap = await getDocs(collection(db, 'usuarios'));

    return snap.docs
      .map(d => {
        const datos = d.data() as Usuario & { creado?: Timestamp };
        return { ...datos, uid: d.id, creado: datos.creado?.toDate() } as UsuarioAdmin;
      })
      .sort((a, b) => (b.creado?.getTime() ?? 0) - (a.creado?.getTime() ?? 0));
  }

  /** Activa o desactiva una cuenta. Una cuenta desactivada no puede iniciar sesión. */
  async cambiarEstado(uid: string, activo: boolean) {
    await updateDoc(doc(db, 'usuarios', uid), { activo });
  }

  /** Borra el perfil de Firestore (la cuenta de Authentication sigue existiendo). */
  async eliminarPerfil(uid: string) {
    await deleteDoc(doc(db, 'usuarios', uid));
  }
}
