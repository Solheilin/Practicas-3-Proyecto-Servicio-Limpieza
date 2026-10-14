
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-perfil-empleada',
  imports: [RouterLink],
  templateUrl: './perfil-empleada.html',
  styleUrl: './perfil-empleada.css'
})
export class PerfilEmpleada implements OnInit {

  perfil: any = null;

  ngOnInit() {

    const datos = localStorage.getItem('perfilEmpleada');

    if (datos) {
      this.perfil = JSON.parse(datos);
    }

  }

}
