import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../Services/auth.service';
import { CatalogService } from '../Services/catalog.service';
import { LoanService } from '../Services/loan.service';
import { TokenService } from '../Services/token.service';
import { UserService } from '../Services/user.service';
import { Category } from '../models/categoria.model';
import { Book } from '../models/libro.model';
import { decodeJwtPayload } from '../utils/jwt.helper';

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

  private readonly tokenService = inject(TokenService);

  private readonly userService = inject(UserService);

  private readonly alertController = inject(AlertController);

  ngOnInit() {
    this.categories = this.catalogService.getCategories();

    const tokenUserId = this.resolveTokenUserId();
    if (tokenUserId) {
      this.currentUserId = tokenUserId;
    } else {
      // Fallback: resolver el id del usuario autenticado desde /usuarios/me/.
      // La caché de usuarios (getUserByIdentifier) solo se hidrata para admin y
      // ya no se puede usar aquí para un usuario normal.
      this.userService.getCurrentUserProfile().subscribe({
        next: (me) => {
          this.currentUserId = me.id;
        },
        error: () => {
          this.currentUserId = 0;
        },
      });
    }
  }

  /**
   * Resuelve el `user_id` del usuario autenticado desde el access token (claim
   * `user_id` de SimpleJWT), con respaldo en los claims persistidos por
   * TokenService. Si no está disponible, devuelve 0 y se recurre a
   * `getCurrentUserProfile()`.
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
