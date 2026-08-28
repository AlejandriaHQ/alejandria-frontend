import { Component, OnInit, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
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

  // Indicador de carga de la vista (préstamos + solicitudes).
  loading: boolean = false;

  // Contador de peticiones pendientes para ocultar el spinner cuando terminen todas.
  private pendingLoads: number = 0;

  private readonly loanService = inject(LoanService);

  private readonly catalogService = inject(CatalogService);

  private readonly userService = inject(UserService);

  private readonly tokenService = inject(TokenService);

  private readonly alertController = inject(AlertController);

  ngOnInit() {
    const tokenUserId = this.resolveTokenUserId();

    if (tokenUserId) {
      this.currentUserId = tokenUserId;
      this.loadData();
    } else {
      // Fallback: resolver el id del usuario autenticado desde /usuarios/me/
      // (el backend restringió GET /usuarios/ a solo-admin, por lo que ya no se
      // puede mapear por identifier sobre la lista completa).
      this.userService.getCurrentUserProfile().subscribe({
        next: (me) => {
          this.currentUserId = me.id;
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
   * recurre a `getCurrentUserProfile()`.
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
    // Enciende el spinner mientras se precarga el catálogo y luego se consultan
    // los préstamos y las solicitudes del usuario.
    this.loading = true;

    // Precarga el catálogo para que `bookById()` resuelva los títulos al
    // renderizar. Si falla (sin red), igual se cargan los préstamos y las
    // solicitudes (los títulos quedan con el placeholder 'Libro no disponible').
    this.catalogService.loadBooks().subscribe({
      next: () => this.loadUserData(),
      error: () => this.loadUserData(),
    });
  }

  private loadUserData() {
    // Cuenta las peticiones que dispara esta vista (préstamos + solicitudes) para
    // apagar el spinner solo cuando todas hayan terminado.
    this.pendingLoads = 1 + (this.currentUserId > 0 ? 1 : 0);

    if (this.currentUserId > 0) {
      this.loanService.getLoansByUser(this.currentUserId).subscribe({
        next: (loans) => {
          this.activeLoans = loans.filter((loan) => loan.status === 'active');
          this.overdueLoans = loans.filter((loan) => loan.status === 'overdue');
          this.historyLoans = loans.filter((loan) => loan.status === 'returned');
          this.finishLoad();
        },
        error: (error: unknown) => {
          this.showError('No se pudieron cargar tus préstamos', this.toMessage(error));
          this.finishLoad();
        },
      });
    }

    // GET /biblioteca/solicitudes/ devuelve solo las solicitudes del usuario
    // autenticado, así que no hace falta filtrar por currentUserId.
    this.loanService.getRequests().subscribe({
      next: (requests) => {
        this.requests = requests;
        this.finishLoad();
      },
      error: (error: unknown) => {
        this.showError('No se pudieron cargar tus solicitudes', this.toMessage(error));
        this.finishLoad();
      },
    });
  }

  /** Apaga el spinner cuando todas las peticiones pendientes hayan terminado. */
  private finishLoad(): void {
    this.pendingLoads = Math.max(0, this.pendingLoads - 1);
    if (this.pendingLoads === 0) {
      this.loading = false;
    }
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
