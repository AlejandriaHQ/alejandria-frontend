import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

export type RolUsuario = 'admin' | 'usuario';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private usuarioActual: {
    identificador: string;
    rol: RolUsuario;
  } | null = null;

  private temporizador: any;

  // 1 minuto solamente para probar RF-03
  private tiempoInactividad = 60 * 1000;

  constructor(
    private router: Router
  ) {}

  iniciarSesion(
    identificador: string,
    contrasena: string
  ): RolUsuario | null {

    if (!identificador || !contrasena) {
      return null;
    }

    // Administrador
    if (
      identificador === 'admin@alejandria.com' &&
      contrasena === 'admin123'
    ) {

      this.usuarioActual = {
        identificador,
        rol: 'admin'
      };

      this.iniciarTemporizador();

      return 'admin';
    }

    // Usuario
    if (
      identificador === 'usuario001' &&
      contrasena === 'usuario123'
    ) {

      this.usuarioActual = {
        identificador,
        rol: 'usuario'
      };

      this.iniciarTemporizador();

      return 'usuario';
    }

    return null;
  }

  obtenerUsuarioActual() {
    return this.usuarioActual;
  }

  cerrarSesion() {

    this.usuarioActual = null;

    this.detenerTemporizador();

    this.router.navigate(['/autenticacion']);
  }

  private iniciarTemporizador() {

    this.detenerTemporizador();

    this.temporizador = setTimeout(() => {

      this.usuarioActual = null;

      this.temporizador = null;

      console.log('Sesión expirada por inactividad');

      this.router.navigate(['/autenticacion']);

    }, this.tiempoInactividad);
  }

  private detenerTemporizador() {

    if (this.temporizador) {

      clearTimeout(this.temporizador);

      this.temporizador = null;
    }
  }

}