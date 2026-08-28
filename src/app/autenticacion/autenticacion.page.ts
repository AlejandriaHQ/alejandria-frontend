import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../Services/auth.service';

@Component({
  selector: 'app-autenticacion',
  templateUrl: './autenticacion.page.html',
  styleUrls: ['./autenticacion.page.scss'],
  standalone: false,
})
export class AutenticacionPage implements OnInit {
  identifier: string = '';

  password: string = '';

  error: string = '';

  loading: boolean = false;

  showPassword: boolean = false;

  private readonly authService = inject(AuthService);

  private readonly router = inject(Router);

  ngOnInit() {
    this.redirectIfAuthenticated();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  login() {
    if (this.loading) {
      return;
    }

    this.error = '';

    this.loading = true;

    this.authService.login(this.identifier, this.password).subscribe({
      next: (user) => {
        this.loading = false;
        this.router.navigate([user.role === 'admin' ? '/admin' : '/usuario']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.error = this.extractError(err);
      },
    });
  }

  private extractError(err: HttpErrorResponse): string {
    if (err?.error?.detail) {
      return err.error.detail;
    }
    if (err?.error?.Mensaje) {
      return String(err.error.Mensaje);
    }
    if (err?.status === 0) {
      return 'No se pudo conectar con el servidor. Verifique que el backend esté activo.';
    }
    return 'Identificador o contraseña incorrectos';
  }

  private redirectIfAuthenticated() {
    const user = this.authService.getCurrentUser();

    if (user?.role === 'admin') {
      this.router.navigate(['/admin']);

      return;
    }

    if (user?.role === 'user') {
      this.router.navigate(['/usuario']);

      return;
    }
  }
}
