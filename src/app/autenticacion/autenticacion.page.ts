import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../Services/auth.service';

@Component({
  selector: 'app-autenticacion',
  templateUrl: './autenticacion.page.html',
  styleUrls: ['./autenticacion.page.scss'],
  standalone: false
})
export class AutenticacionPage implements OnInit {

  identificador: string = '';
  contrasena: string = '';

  error: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {}

  iniciarSesion() {

    this.error = '';

    const rol = this.authService.iniciarSesion(
      this.identificador,
      this.contrasena
    );

    if (rol === 'admin') {

      this.router.navigate(['/admin']);

      return;
    }

    if (rol === 'usuario') {

      this.router.navigate(['/usuario']);

      return;
    }

    this.error = 'Identificador o contraseña incorrectos';
  }

}