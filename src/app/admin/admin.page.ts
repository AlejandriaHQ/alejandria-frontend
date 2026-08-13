import { Component, inject } from '@angular/core';
import { AuthService } from '../Services/auth.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: false,
})
export class AdminPage {
  private readonly authService = inject(AuthService);

  logout() {
    this.authService.logout();
  }

  enterUserView() {
    this.authService.enterUserView();
  }
}
