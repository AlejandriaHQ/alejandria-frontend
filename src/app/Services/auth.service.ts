import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

export type RolUsuario = 'admin' | 'usuario';

interface SesionGuardada {
  identificador: string;
  rol: RolUsuario;
  expiraEn: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly claveSesion = 'alejandria_sesion';

  private usuarioActual: {
    identificador: string;
    rol: RolUsuario;
  } | null = null;

  private temporizador: any;

  // La sesión expira a los 30 minutos (RF-03)
  private tiempoInactividad = 30 * 60 * 1000;

  constructor(private router: Router) {
    this.restaurarSesion();
  }

  iniciarSesion(identificador: string, contrasena: string): RolUsuario | null {
    if (!identificador || !contrasena) {
      return null;
    }

    // Administrador
    if (identificador === 'admin@alejandria.com' && contrasena === 'admin123') {
      this.usuarioActual = {
        identificador,
        rol: 'admin',
      };

      this.guardarSesion();
      this.iniciarTemporizador();

      return 'admin';
    }

    // Usuario
    if (identificador === 'usuario001' && contrasena === 'usuario123') {
      this.usuarioActual = {
        identificador,
        rol: 'usuario',
      };

      this.guardarSesion();
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

    this.limpiarSesionGuardada();
    this.detenerTemporizador();

    this.router.navigate(['/autenticacion']);
  }

  private guardarSesion() {
    const sesion: SesionGuardada = {
      identificador: this.usuarioActual!.identificador,
      rol: this.usuarioActual!.rol,
      expiraEn: Date.now() + this.tiempoInactividad,
    };

    localStorage.setItem(this.claveSesion, JSON.stringify(sesion));
  }

  private restaurarSesion() {
    const guardada = localStorage.getItem(this.claveSesion);

    if (!guardada) {
      return;
    }

    try {
      const sesion: SesionGuardada = JSON.parse(guardada);

      const restante = sesion.expiraEn - Date.now();

      if (restante <= 0) {
        this.limpiarSesionGuardada();

        return;
      }

      this.usuarioActual = {
        identificador: sesion.identificador,
        rol: sesion.rol,
      };

      this.temporizador = setTimeout(() => this.expiarSesion(), restante);
    } catch {
      this.limpiarSesionGuardada();
    }
  }

  private iniciarTemporizador() {
    this.detenerTemporizador();

    this.temporizador = setTimeout(() => this.expiarSesion(), this.tiempoInactividad);
  }

  private expiarSesion() {
    this.usuarioActual = null;

    this.temporizador = null;

    this.limpiarSesionGuardada();

    console.log('Sesión expirada por inactividad');

    this.router.navigate(['/autenticacion']);
  }

  private limpiarSesionGuardada() {
    localStorage.removeItem(this.claveSesion);
  }

  private detenerTemporizador() {
    if (this.temporizador) {
      clearTimeout(this.temporizador);

      this.temporizador = null;
    }
  }
}
