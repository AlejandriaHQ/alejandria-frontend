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
  @Input() title = '';

  @Input() showBack = true;

  @Input() backRoute = '/';

  constructor(
    public themeService: ThemeService,
    private authService: AuthService,
  ) {}

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
}
