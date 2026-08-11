import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../Services/auth.service';

@Component({
  selector: 'app-autenticacion',
  templateUrl: './autenticacion.page.html',
  styleUrls: ['./autenticacion.page.scss'],
  standalone: false,
})
export class AutenticacionPage implements OnInit, OnDestroy {
  identificador: string = '';
  contrasena: string = '';

  error: string = '';

  cargando: boolean = false;

  mostrarContrasena: boolean = false;

  private temporizadorCarga: any;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.redirigirSiHaySesion();
  }

  private redirigirSiHaySesion() {
    const usuario = this.authService.obtenerUsuarioActual();

    if (usuario?.rol === 'admin') {
      this.router.navigate(['/admin']);

      return;
    }

    if (usuario?.rol === 'usuario') {
      this.router.navigate(['/usuario']);

      return;
    }
  }

  ngOnDestroy() {
    if (this.temporizadorCarga) {
      clearTimeout(this.temporizadorCarga);

      this.temporizadorCarga = null;
    }
  }

  alternarVisibilidadContrasena() {
    this.mostrarContrasena = !this.mostrarContrasena;
  }

  iniciarSesion() {
    if (this.cargando) {
      return;
    }

    this.error = '';

    this.cargando = true;

    this.temporizadorCarga = setTimeout(() => {
      this.cargando = false;

      this.temporizadorCarga = null;

      const rol = this.authService.iniciarSesion(this.identificador, this.contrasena);

      if (rol === 'admin') {
        this.router.navigate(['/admin']);

        return;
      }

      if (rol === 'usuario') {
        this.router.navigate(['/usuario']);

        return;
      }

      this.error = 'Identificador o contraseña incorrectos';
    }, 500);
  }
}
