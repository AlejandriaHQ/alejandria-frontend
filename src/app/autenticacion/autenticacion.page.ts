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
  identifier: string = '';

  password: string = '';

  error: string = '';

  loading: boolean = false;

  showPassword: boolean = false;

  private loadingTimer: any;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.redirectIfAuthenticated();
  }

  ngOnDestroy() {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);

      this.loadingTimer = null;
    }
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

    this.loadingTimer = setTimeout(() => {
      this.loading = false;

      this.loadingTimer = null;

      const role = this.authService.login(this.identifier, this.password);

      if (role === 'admin') {
        this.router.navigate(['/admin']);

        return;
      }

      if (role === 'user') {
        this.router.navigate(['/usuario']);

        return;
      }

      this.error = 'Identificador o contraseña incorrectos';
    }, 500);
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
