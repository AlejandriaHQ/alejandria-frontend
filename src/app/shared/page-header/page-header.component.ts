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

  get userName() {
    if (!this.currentUser) {
      return '';
    }

    return this.currentUser.role === 'admin' ? 'Administrador' : 'Usuario';
  }

  get initial() {
    return (this.currentUser?.identifier || 'A').charAt(0).toUpperCase();
  }

  get inUserView(): boolean {
    return this.authService.inUserView;
  }

  exitUserView() {
    this.authService.exitUserView();
  }
}
