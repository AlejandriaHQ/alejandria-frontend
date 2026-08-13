import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { CatalogService } from '../../Services/catalog.service';
import { LoanService } from '../../Services/loan.service';
import { Book } from '../../models/libro.model';
import { Loan } from '../../models/prestamo.model';
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

  constructor(
    private loanService: LoanService,
    private catalogService: CatalogService,
    private alertController: AlertController,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.loanService.detectOverdue();

    this.pendingRequests = this.loanService.getPendingRequests();
    this.activeLoans = this.loanService.getActiveLoans();
    this.overdueLoans = this.loanService.getOverdueLoans();
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
            const loan = this.loanService.approveRequest(request.id);

            if (!loan) {
              this.showError(
                'No se pudo aprobar',
                'Verifica que el libro esté disponible y que el usuario no tenga 3 préstamos activos ni vencidos sin devolver.',
              );
            }

            this.loadData();
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
            this.loanService.rejectRequest(request.id);

            this.loadData();
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
            this.loanService.returnLoan(loan.id);

            this.loadData();
          },
        },
      ],
    });

    await alert.present();
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
