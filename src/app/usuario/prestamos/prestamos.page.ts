import { Component, OnInit, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../../Services/auth.service';
import { CatalogService } from '../../Services/catalog.service';
import { LoanService } from '../../Services/loan.service';
import { Book } from '../../models/libro.model';
import { Loan } from '../../models/prestamo.model';
import { LoanRequest, LoanRequestStatus } from '../../models/solicitud-prestamo.model';

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

  private readonly alertController = inject(AlertController);

  ngOnInit() {
    const identifier = this.authService.getCurrentUser()?.identifier ?? '';

    this.currentUserId = this.loanService.getUserByIdentifier(identifier)?.id ?? 0;

    this.loadData();
  }

  private loadData() {
    this.loanService.detectOverdue();

    const userLoans = this.loanService.getLoansByUser(this.currentUserId);

    this.requests = this.loanService.getRequestsByUser(this.currentUserId);
    this.activeLoans = userLoans.filter((loan) => loan.status === 'active');
    this.overdueLoans = userLoans.filter((loan) => loan.status === 'overdue');
    this.historyLoans = userLoans.filter((loan) => loan.status === 'returned');
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
            this.loanService.cancelRequest(request.id);

            this.loadData();
          },
        },
      ],
    });

    await alert.present();
  }
}
