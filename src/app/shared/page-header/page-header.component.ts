import { Component, Input } from '@angular/core';
import { ThemeService } from '../../Services/theme.service';
import { AuthService } from '../../Services/auth.service';

@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
  standalone: false,
})
export class PageHeaderComponent {
  @Input() titulo = '';

  @Input() mostrarAtras = true;

  @Input() rutaAtras = '/';

  constructor(
    public themeService: ThemeService,
    private authService: AuthService,
  ) {}

  get usuario() {
    return this.authService.obtenerUsuarioActual();
  }

  get nombreUsuario() {
    if (!this.usuario) {
      return '';
    }

    return this.usuario.rol === 'admin' ? 'Administrador' : 'Usuario';
  }

  get inicial() {
    return (this.usuario?.identificador || 'A').charAt(0).toUpperCase();
  }
}
