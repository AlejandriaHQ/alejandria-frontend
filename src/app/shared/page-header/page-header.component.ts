import { Component, Input, inject } from '@angular/core';
import { ThemeService } from '../../Services/theme.service';
import { AuthService } from '../../Services/auth.service';

@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
  standalone: false,
})
export class PageHeaderComponent {
  @Input() title = '';

  @Input() showBack = true;

  @Input() backRoute = '/';

  public readonly themeService = inject(ThemeService);

  private readonly authService = inject(AuthService);

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  get userName(): string {
    if (!this.currentUser) {
      return '';
    }

    if (this.currentUser.name && this.currentUser.name.trim()) {
      return this.currentUser.name.trim();
    }

    const full = `${this.currentUser.firstName || ''} ${this.currentUser.lastName || ''}`.trim();
    if (full) {
      return full;
    }

    return this.currentUser.role === 'admin' ? 'Administrador' : 'Usuario';
  }

  get initial(): string {
    const nameToUse = this.userName;
    if (nameToUse && nameToUse !== 'Administrador' && nameToUse !== 'Usuario') {
      return nameToUse.charAt(0).toUpperCase();
    }
    return (this.currentUser?.identifier || 'A').charAt(0).toUpperCase();
  }

  get inUserView(): boolean {
    return this.authService.inUserView;
  }

  exitUserView() {
    this.authService.exitUserView();
  }
}
