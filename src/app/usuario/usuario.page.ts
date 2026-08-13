import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../Services/auth.service';
import { CatalogService } from '../Services/catalog.service';
import { LoanService } from '../Services/loan.service';
import { Category } from '../models/categoria.model';
import { Book } from '../models/libro.model';

@Component({
  selector: 'app-usuario',
  templateUrl: './usuario.page.html',
  styleUrls: ['./usuario.page.scss'],
  standalone: false,
})
export class UsuarioPage implements OnInit {
  query: string = '';

  categoryId: number = 0;

  categories: Category[] = [];

  selectedBook: Book | null = null;

  currentUserId: number = 0;

  private readonly authService = inject(AuthService);

  private readonly router = inject(Router);

  private readonly catalogService = inject(CatalogService);

  private readonly loanService = inject(LoanService);

  private readonly alertController = inject(AlertController);

  ngOnInit() {
    this.categories = this.catalogService.getCategories();

    const identifier = this.authService.getCurrentUser()?.identifier ?? '';

    this.currentUserId = this.loanService.getUserByIdentifier(identifier)?.id ?? 0;
  }

  filteredBooks(): Book[] {
    return this.catalogService.searchBooks(this.query, this.categoryId);
  }

  categoryName(categoryId: number): string {
    const category = this.categories.find((c) => c.id === categoryId);

    return category ? category.name : 'Sin categoría';
  }

  showDetail(book: Book) {
    this.selectedBook = book;
  }

  closeDetail() {
    this.selectedBook = null;
  }

  logout() {
    this.authService.logout();
  }

  hasPendingRequest(bookId: number): boolean {
    return this.loanService
      .getRequestsByUser(this.currentUserId)
      .some((request) => request.bookId === bookId && request.status === 'pending');
  }

  async requestLoan(book: Book) {
    if (!book.available || this.hasPendingRequest(book.id)) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Solicitar préstamo',
      message: `¿Deseas solicitar "${book.title}"? La recoges en el mostrador cuando el administrador la apruebe.`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Solicitar',
          handler: () => {
            const request = this.loanService.requestLoan(book.id, this.currentUserId);

            if (request) {
              this.showMessage(
                'Solicitud enviada',
                `Solicitaste "${book.title}". El administrador la procesará en el mostrador.`,
              );
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private async showMessage(header: string, message: string) {
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
