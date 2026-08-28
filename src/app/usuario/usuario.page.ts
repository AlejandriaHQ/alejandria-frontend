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
import { Loan } from '../models/prestamo.model';
import { LoanRequest } from '../models/solicitud-prestamo.model';
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

  books: Book[] = [];

  /** Página actual de la lista de libros (paginación del backend). */
  currentPage: number = 1;

  /** Total de páginas disponibles según el backend. */
  maxPages: number = 1;

  /** Si existe una página anterior / siguiente. */
  hasPrevious: boolean = false;

  hasNext: boolean = false;

  // Indicador de carga del catálogo (categorías + libros).
  loading: boolean = false;

  // Contador de cargas de catálogo en vuelo (categorías + libros): permite
  // apagar el spinner solo cuando ambas peticiones hayan terminado.
  private pendingCatalogLoads: number = 0;

  pendingRequests: LoanRequest[] = [];

  // Préstamos del socio sin devolver (activos o vencidos): se usan para saber
  // qué títulos ya tiene y deshabilitar su solicitud.
  activeLoans: Loan[] = [];

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
    // Carga asíncrona desde la API: categorías, libros y solicitudes propias.
    // Los getters síncronos legacy (getCategories/searchBooks/getRequestsByUser)
    // leen cachés vacías porque la vista de usuario nunca los hidrataba.
    this.loadCategories();
    this.loadBooks();
    this.loadRequests();

    const tokenUserId = this.resolveTokenUserId();
    if (tokenUserId) {
      this.currentUserId = tokenUserId;
      this.loadActiveLoans();
    } else {
      // Fallback: resolver el id del usuario autenticado desde /usuarios/me/.
      // La caché de usuarios (getUserByIdentifier) solo se hidrata para admin y
      // ya no se puede usar aquí para un usuario normal.
      this.userService.getCurrentUserProfile().subscribe({
        next: (me) => {
          this.currentUserId = me.id;
          this.loadActiveLoans();
        },
        error: () => {
          this.currentUserId = 0;
        },
      });
    }
  }

  /** Carga las categorías desde `/biblioteca/categorias/` (asíncrono). */
  private loadCategories(): void {
    this.startCatalogLoad();
    this.catalogService.loadCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.finishCatalogLoad();
      },
      error: () => {
        this.categories = [];
        this.finishCatalogLoad();
      },
    });
  }

  /** Busca libros con los filtros actuales (query/categoría) y la página solicitada (asíncrono). */
  private loadBooks(page = 1): void {
    this.startCatalogLoad();
    this.catalogService.searchBooksPage(this.query, this.categoryId, page).subscribe({
      next: (result) => {
        this.books = result.items;
        this.currentPage = result.currentPage;
        this.maxPages = result.maxPages;
        this.hasPrevious = result.previous;
        this.hasNext = result.next;
        this.finishCatalogLoad();
      },
      error: () => {
        this.books = [];
        this.maxPages = 1;
        this.hasPrevious = false;
        this.hasNext = false;
        this.finishCatalogLoad();
      },
    });
  }

  /** Marca el inicio de una carga de catálogo (categorías o libros). */
  private startCatalogLoad(): void {
    this.pendingCatalogLoads += 1;
    this.loading = true;
  }

  /** Marca el final de una carga de catálogo y apaga el spinner al terminar todas. */
  private finishCatalogLoad(): void {
    this.pendingCatalogLoads = Math.max(0, this.pendingCatalogLoads - 1);
    if (this.pendingCatalogLoads === 0) {
      this.loading = false;
    }
  }

  /** Carga las solicitudes del usuario autenticado (el backend filtra por rol). */
  private loadRequests(): void {
    this.loanService.getRequests().subscribe({
      next: (requests) => {
        this.pendingRequests = requests;
      },
      error: () => {
        this.pendingRequests = [];
      },
    });
  }

  /**
   * Carga los préstamos sin devolver del socio (activos o vencidos) para saber
   * qué títulos ya tiene prestados y deshabilitar su solicitud en el catálogo.
   */
  private loadActiveLoans(): void {
    if (this.currentUserId <= 0) {
      this.activeLoans = [];
      return;
    }

    this.loanService.getLoansByUser(this.currentUserId).subscribe({
      next: (loans) => {
        // Solo cuentan los ejemplares sin devolver (activos o vencidos).
        this.activeLoans = loans.filter(
          (loan) => loan.status === 'active' || loan.status === 'overdue',
        );
      },
      error: () => {
        this.activeLoans = [];
      },
    });
  }

  /** Dispara una nueva búsqueda cuando cambian los filtros (searchbar / selector). */
  onSearch(): void {
    this.currentPage = 1;
    this.loadBooks(1);
  }

  /** Navega a la página siguiente si existe. */
  nextPage(): void {
    if (this.hasNext) {
      this.loadBooks(this.currentPage + 1);
    }
  }

  /** Navega a la página anterior si existe. */
  previousPage(): void {
    if (this.hasPrevious) {
      this.loadBooks(this.currentPage - 1);
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
    return this.books;
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
    return this.pendingRequests.some(
      (request) => request.bookId === bookId && request.status === 'pending',
    );
  }

  /**
   * ¿El socio ya tiene este título como préstamo activo (sin devolver) o como
   * solicitud pendiente? En ambos casos no puede volver a solicitarlo.
   */
  hasActiveLoan(bookId: number): boolean {
    return (
      this.activeLoans.some((loan) => loan.bookId === bookId) ||
      this.hasPendingRequest(bookId)
    );
  }

  /** ¿Puede el socio solicitar este título? (disponible y no lo tiene ya). */
  canRequest(book: Book): boolean {
    return book.available && !this.hasActiveLoan(book.id);
  }

  async requestLoan(book: Book) {
    if (!this.canRequest(book)) {
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
            // POST /biblioteca/solicitudes/: el backend fuerza el `id_usuario`
            // cuando el rol es 'user', así que `this.currentUserId` se envía
            // como referencia y no se puede alterar desde el cliente.
            this.loanService.requestLoanApi(book.id, this.currentUserId).subscribe({
              next: () => {
                this.showMessage(
                  'Solicitud enviada',
                  `Solicitaste "${book.title}". El administrador la procesará en el mostrador.`,
                );
                this.loadRequests();
              },
              error: (error: unknown) => {
                this.showMessage('No se pudo enviar la solicitud', this.toMessage(error));
              },
            });
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

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
