import { Component, OnInit, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../../Services/auth.service';
import { CatalogService } from '../../Services/catalog.service';
import { LoanService } from '../../Services/loan.service';
import { TokenService } from '../../Services/token.service';
import { UserService } from '../../Services/user.service';
import { Book } from '../../models/libro.model';
import { Loan } from '../../models/prestamo.model';
import { LoanRequest, LoanRequestStatus } from '../../models/solicitud-prestamo.model';
import { decodeJwtPayload } from '../../utils/jwt.helper';

@Component({
  selector: 'app-usuario-prestamos',
  templateUrl: './prestamos.page.html',
  styleUrls: ['./prestamos.page.scss'],
  standalone: false,
})
export class PrestamosPage implements OnInit {
  currentUserId: number = 0;

  requests: LoanRequest[] = [];

  activeLoans: Loan[] = [];

  overdueLoans: Loan[] = [];

  historyLoans: Loan[] = [];

  private readonly authService = inject(AuthService);

  private readonly loanService = inject(LoanService);

  private readonly catalogService = inject(CatalogService);

  private readonly userService = inject(UserService);

  private readonly tokenService = inject(TokenService);

  private readonly alertController = inject(AlertController);

  ngOnInit() {
    const identifier = this.authService.getCurrentUser()?.identifier ?? '';
    const tokenUserId = this.resolveTokenUserId();

    if (tokenUserId) {
      this.currentUserId = tokenUserId;
      this.loadData();
    } else {
      // Fallback: mapear el identifier del usuario autenticado a su id.
      this.userService.getUsers().subscribe({
        next: (users) => {
          this.currentUserId = users.find((user) => user.identifier === identifier)?.id ?? 0;
          this.loadData();
        },
        error: () => this.loadData(),
      });
    }
  }

  /**
   * Resuelve el `user_id` del usuario autenticado desde el access token (claim
   * `user_id` de SimpleJWT), con respaldo en los claims persistidos por
   * TokenService. Si no está disponible (sesión sin el claim), devuelve 0 y se
   * recurre al mapeo por `identifier`.
   */
  private resolveTokenUserId(): number {
    const access = this.tokenService.getAccess();
    if (access) {
      const payload = decodeJwtPayload(access);
      const fromPayload = payload?.['user_id'];
      if (typeof fromPayload === 'number') {
        return fromPayload;
      }
    }
    return this.tokenService.getClaims()?.user_id ?? 0;
  }

  private loadData() {
    // Precarga el catálogo para que `bookById()` resuelva los títulos al
    // renderizar. Si falla (sin red), igual se cargan los préstamos y las
    // solicitudes (los títulos quedan con el placeholder 'Libro no disponible').
    this.catalogService.loadBooks().subscribe({
      next: () => this.loadUserData(),
      error: () => this.loadUserData(),
    });
  }

  private loadUserData() {
    if (this.currentUserId > 0) {
      this.loanService.getLoansByUser(this.currentUserId).subscribe({
        next: (loans) => {
          this.activeLoans = loans.filter((loan) => loan.status === 'active');
          this.overdueLoans = loans.filter((loan) => loan.status === 'overdue');
          this.historyLoans = loans.filter((loan) => loan.status === 'returned');
        },
        error: (error: unknown) => {
          this.showError('No se pudieron cargar tus préstamos', this.toMessage(error));
        },
      });
    }

    // GET /biblioteca/solicitudes/ devuelve solo las solicitudes del usuario
    // autenticado, así que no hace falta filtrar por currentUserId.
    this.loanService.getRequests().subscribe({
      next: (requests) => {
        this.requests = requests;
      },
      error: (error: unknown) => {
        this.showError('No se pudieron cargar tus solicitudes', this.toMessage(error));
      },
    });
  }

  bookById(bookId: number): Book | null {
    return this.catalogService.getBooks().find((book) => book.id === bookId) ?? null;
  }

  formatDate(date: Date | string | null | undefined): string {
    if (!date) {
      return '—';
    }

    return new Date(date).toLocaleDateString('es-ES');
  }

  requestStatusLabel(status: LoanRequestStatus): string {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      case 'cancelled':
        return 'Cancelada';
    }
  }

  async cancelRequest(request: LoanRequest) {
    const alert = await this.alertController.create({
      header: 'Cancelar solicitud',
      message: '¿Seguro que deseas cancelar esta solicitud?',
      buttons: [
        {
          text: 'No',
          role: 'cancel',
        },
        {
          text: 'Cancelar solicitud',
          handler: () => {
            this.loanService.cancelRequest(request.id).subscribe({
              next: () => this.loadData(),
              error: (error: unknown) => {
                this.showError('No se pudo cancelar', this.toMessage(error));
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private async showError(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        {
          text: 'Entendido',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }
}
