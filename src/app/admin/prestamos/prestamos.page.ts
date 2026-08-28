import { Component, OnInit, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { forkJoin } from 'rxjs';
import { CatalogService } from '../../Services/catalog.service';
import { LoanService } from '../../Services/loan.service';
import { Book } from '../../models/libro.model';
import { Loan, LoanStatus } from '../../models/prestamo.model';
import { LoanRequest } from '../../models/solicitud-prestamo.model';
import { User } from '../../models/usuario.model';

@Component({
  selector: 'app-prestamos',
  templateUrl: './prestamos.page.html',
  styleUrls: ['./prestamos.page.scss'],
  standalone: false,
})
export class PrestamosPage implements OnInit {
  pendingRequests: LoanRequest[] = [];

  activeLoans: Loan[] = [];

  overdueLoans: Loan[] = [];

  /** Socios disponibles para el selector de historial (solo miembros, no admins). */
  users: User[] = [];

  /** Socio seleccionado en el selector de historial (null = ninguno). */
  selectedUserId: number | null = null;

  /** Historial de préstamos del socio seleccionado. */
  socioLoans: Loan[] = [];

  /** Indica si se está consultando el historial del socio seleccionado. */
  historyLoading: boolean = false;

  /** Indicador de carga inicial de la vista (solicitudes, préstamos, socios, libros). */
  loading: boolean = false;

  private readonly loanService = inject(LoanService);

  private readonly catalogService = inject(CatalogService);

  private readonly alertController = inject(AlertController);

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.loading = true;
    forkJoin({
      pending: this.loanService.getPendingRequests(),
      active: this.loanService.getActiveLoans(),
      overdue: this.loanService.getOverdueLoans(),
      users: this.loanService.loadUsers(),
      books: this.catalogService.loadBooks(),
    }).subscribe({
      next: (result) => {
        this.pendingRequests = result.pending;
        this.activeLoans = result.active;
        this.overdueLoans = result.overdue;
        // La lista de socios se toma del mismo resultado que hidrata la caché de
        // `loanService.loadUsers()` (que delega en `userService.getUsers()`), para
        // no duplicar la llamada. Se dejan solo los miembros (`role === 'user'`),
        // que son los que tienen historial de préstamos.
        this.users = result.users.filter((user) => user.role === 'user');
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.showError('Error al cargar préstamos', this.toMessage(error));
      },
    });
  }

  /** Al cambiar el socio seleccionado se limpia y recarga su historial. */
  onSocioChange(): void {
    this.socioLoans = [];
    this.loadSocioLoans();
  }

  /**
   * Carga el historial de préstamos del socio seleccionado.
   *
   * Los títulos se resuelven con `bookById` (caché de `CatalogService`), por lo
   * que se precargan los libros antes de consultar los préstamos; si esa carga
   * falla, el historial se pinta igual y `bookById` degrada al placeholder
   * 'Libro no disponible'.
   */
  private loadSocioLoans(): void {
    if (this.selectedUserId === null) {
      this.historyLoading = false;
      this.socioLoans = [];
      return;
    }

    this.historyLoading = true;
    this.catalogService.loadBooks().subscribe({
      next: () => this.fetchSocioLoans(),
      error: () => this.fetchSocioLoans(),
    });
  }

  /** Consulta a la API el historial de préstamos del socio `selectedUserId`. */
  private fetchSocioLoans(): void {
    if (this.selectedUserId === null) {
      this.historyLoading = false;
      return;
    }

    this.loanService.getLoansByUser(this.selectedUserId).subscribe({
      next: (loans) => {
        this.historyLoading = false;
        this.socioLoans = loans;
      },
      error: (error: unknown) => {
        this.historyLoading = false;
        this.socioLoans = [];
        this.showError('No se pudo cargar el historial del socio', this.toMessage(error));
      },
    });
  }

  /** Refresca el historial tras devolver un préstamo, si hay un socio seleccionado. */
  private refreshSocioHistory(): void {
    if (this.selectedUserId !== null) {
      this.loadSocioLoans();
    }
  }

  /** Etiqueta legible para el estado de un préstamo. */
  loanStatusLabel(status: LoanStatus): string {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'returned':
        return 'Devuelto';
      case 'overdue':
        return 'Vencido';
    }
  }

  /** Color del badge para el estado de un préstamo. */
  loanStatusColor(status: LoanStatus): string {
    switch (status) {
      case 'active':
        return 'success';
      case 'returned':
        return 'medium';
      case 'overdue':
        return 'danger';
    }
  }

  bookById(bookId: number): Book | null {
    return this.catalogService.getBooks().find((book) => book.id === bookId) ?? null;
  }

  userById(userId: number): User | null {
    return this.loanService.getUserById(userId);
  }

  formatDate(date: Date | string | null | undefined): string {
    if (!date) {
      return '—';
    }

    return new Date(date).toLocaleDateString('es-ES');
  }

  async approveRequest(request: LoanRequest) {
    const alert = await this.alertController.create({
      header: 'Aprobar solicitud',
      message: `¿Confirmas el préstamo para este usuario?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Aprobar',
          handler: () => {
            this.loanService.approveRequest(request.id).subscribe({
              next: () => this.loadData(),
              error: (error: unknown) => {
                this.showError('No se pudo aprobar', this.toMessage(error));
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }

  async rejectRequest(request: LoanRequest) {
    const alert = await this.alertController.create({
      header: 'Rechazar solicitud',
      message: '¿Seguro que deseas rechazar esta solicitud?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Rechazar',
          handler: () => {
            this.loanService.rejectRequest(request.id).subscribe({
              next: () => this.loadData(),
              error: (error: unknown) => {
                this.showError('No se pudo rechazar', this.toMessage(error));
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }

  async returnLoan(loan: Loan) {
    const alert = await this.alertController.create({
      header: 'Registrar devolución',
      message: '¿Confirmas la devolución de este ejemplar?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Devolver',
          handler: () => {
            this.loanService.returnLoan(loan.id).subscribe({
              next: () => {
                this.loadData();
                // Tras registrar la devolución se refresca el historial del socio
                // seleccionado, si lo hay, para que el estado quede al día.
                this.refreshSocioHistory();
              },
              error: (error: unknown) => {
                this.showError('No se pudo registrar la devolución', this.toMessage(error));
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
