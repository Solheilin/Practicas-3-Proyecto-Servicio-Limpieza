import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';


import { Login } from './login/login';



@Component({
  selector: 'app-root',

  templateUrl: './app.html',
  imports: [RouterOutlet],
  styleUrl: './app.css'

})
export class App {
  
}
