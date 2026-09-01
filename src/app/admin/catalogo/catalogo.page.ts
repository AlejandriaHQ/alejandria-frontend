import { Component, OnInit, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AlertController } from '@ionic/angular';
import { CatalogService } from '../../Services/catalog.service';
import { LoanService } from '../../Services/loan.service';
import { Category } from '../../models/categoria.model';
import { Book } from '../../models/libro.model';
import { User } from '../../models/usuario.model';

@Component({
  selector: 'app-catalogo',
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
  standalone: false,
})
export class CatalogoPage implements OnInit {
  query: string = '';

  categoryId: number = 0;

  categories: Category[] = [];

  showForm: boolean = false;

  formInvalid: boolean = false;

  editingBook: Book | null = null;

  selectedBook: Book | null = null;

  showCategories: boolean = false;

  newCategory: string = '';

  newCategoryDescription: string = '';

  newCategoryActive: boolean = true;

  editingCategory: Category | null = null;

  newTitle: string = '';

  newAuthor: string = '';

  newIsbn: string = '';

  newCategoryId: number = 0;

  newYear: number;

  newCover: string = '';

  // Stock total editable al crear/editar un libro (mínimo 1).
  newCantidad: number = 1;

  loading: boolean = false;

  /** Página actual de la lista de libros (paginación del backend). */
  currentPage: number = 1;

  /** Total de páginas disponibles según el backend. */
  maxPages: number = 1;

  /** Si existe una página anterior / siguiente. */
  hasPrevious: boolean = false;

  hasNext: boolean = false;

  private readonly booksSubject = new BehaviorSubject<Book[]>([]);

  readonly books$: Observable<Book[]> = this.booksSubject.asObservable();

  users: User[] = [];

  loadingUsers: boolean = false;

  userSearchQuery: string = '';

  userCurrentPage: number = 1;

  userMaxPages: number = 1;

  userHasPrevious: boolean = false;

  userHasNext: boolean = false;

  libroParaPrestar: Book | null = null;

  private readonly catalogService = inject(CatalogService);

  private readonly loanService = inject(LoanService);

  private readonly alertController = inject(AlertController);

  constructor() {
    this.newYear = new Date().getFullYear();
  }

  ngOnInit() {
    this.loadCategories();

    this.filteredBooks();

    this.loadUsersList();
  }

  /** Carga asíncronamente la lista paginada de usuarios desde la API para el modal de préstamos. */
  loadUsersList(page: number = 1) {
    this.loadingUsers = true;
    this.userCurrentPage = page;

    this.loanService.searchUsersPage(this.userSearchQuery, page).subscribe({
      next: (result) => {
        this.users = result.users;
        this.userCurrentPage = result.currentPage;
        this.userMaxPages = result.maxPages;
        this.userHasPrevious = result.previous;
        this.userHasNext = result.next;
        this.loadingUsers = false;
      },
      error: () => {
        this.users = [];
        this.userMaxPages = 1;
        this.userHasPrevious = false;
        this.userHasNext = false;
        this.loadingUsers = false;
      },
    });
  }

  onUserSearch() {
    this.userCurrentPage = 1;
    this.loadUsersList(1);
  }

  nextUserPage() {
    if (this.userHasNext) {
      this.loadUsersList(this.userCurrentPage + 1);
    }
  }

  previousUserPage() {
    if (this.userHasPrevious) {
      this.loadUsersList(this.userCurrentPage - 1);
    }
  }

  /**
   * Recarga la lista visible de libros según los filtros actuales.
   *
   * Usa la paginación del backend: `page` indica cuál página pedir. Al cambiar
   * los filtros (searchbar / selector) se llama sin argumento y vuelve a la
   * página 1.
   */
  filteredBooks(page: number = 1) {
    this.loading = true;

    this.catalogService.searchBooksPage(this.query, this.categoryId, page).subscribe({
      next: (result) => {
        this.booksSubject.next(result.items);
        this.currentPage = result.currentPage;
        this.maxPages = result.maxPages;
        this.hasPrevious = result.previous;
        this.hasNext = result.next;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.showMessage('Error al cargar libros', this.toMessage(error));
      },
    });
  }

  /** Navega a una página concreta si está dentro del rango. */
  goToPage(page: number) {
    if (page < 1 || page > this.maxPages) {
      return;
    }
    this.filteredBooks(page);
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  previousPage() {
    this.goToPage(this.currentPage - 1);
  }

  private loadCategories() {
    this.catalogService.loadCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error: unknown) => {
        this.showMessage('Error al cargar categorías', this.toMessage(error));
      },
    });
  }

  categoryName(categoryId: number): string {
    const category = this.categories.find((c) => c.id === categoryId);

    return category ? category.name : 'Sin categoría';
  }

  toggleForm() {
    if (this.showForm) {
      this.closeForm();
    } else {
      this.openNewBookForm();
    }
  }

  openNewBookForm() {
    this.editingBook = null;

    this.resetForm();

    this.showForm = true;
  }

  openEditBookForm(book: Book) {
    this.editingBook = book;

    this.formInvalid = false;

    this.newTitle = book.title;
    this.newAuthor = book.author;
    this.newIsbn = book.isbn;
    this.newCategoryId = book.categoryId;
    this.newYear = book.year;
    this.newCover = book.cover ?? '';
    // Precarga el stock actual del libro (1 si el backend no lo reportó).
    this.newCantidad = book.cantidad ?? 1;

    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;

    this.editingBook = null;

    this.resetForm();
  }

  private resetForm() {
    this.newTitle = '';
    this.newAuthor = '';
    this.newIsbn = '';
    this.newCategoryId = 0;
    this.newYear = new Date().getFullYear();
    this.newCover = '';
    this.newCantidad = 1;
    this.formInvalid = false;
  }

  saveBook() {
    if (
      !this.newTitle.trim() ||
      !this.newAuthor.trim() ||
      !this.newIsbn.trim() ||
      this.newCategoryId === 0
    ) {
      this.formInvalid = true;

      return;
    }

    // La cantidad mínima es 1: valores inválidos se corrigen al guardar.
    const cantidad = this.newCantidad && this.newCantidad > 0 ? this.newCantidad : 1;

    const data = {
      title: this.newTitle.trim(),
      author: this.newAuthor.trim(),
      isbn: this.newIsbn.trim(),
      categoryId: this.newCategoryId,
      year: this.newYear,
      cover: this.newCover || undefined,
      cantidad,
    };

    const request$ = this.editingBook
      ? this.catalogService.updateBook(this.editingBook.id, data)
      : this.catalogService.addBook(data);

    request$.subscribe({
      next: () => {
        this.closeForm();
        this.filteredBooks();
      },
      error: (error: unknown) => {
        this.showMessage('No se pudo guardar el libro', this.toMessage(error));
      },
    });
  }

  showDetail(book: Book) {
    this.selectedBook = book;
  }

  closeDetail() {
    this.selectedBook = null;
  }

  removeCover() {
    this.newCover = '';
  }

  openCategories() {
    this.showCategories = true;
  }

  closeCategories() {
    this.showCategories = false;

    this.editingCategory = null;

    this.resetCategoryForm();
  }

  /** Reinicia los campos del formulario de categorías (nueva categoría activa por defecto). */
  private resetCategoryForm() {
    this.newCategory = '';

    this.newCategoryDescription = '';

    this.newCategoryActive = true;
  }

  addCategory() {
    const name = this.newCategory.trim();

    if (!name) {
      return;
    }

    const request$ = this.editingCategory
      ? this.catalogService.updateCategory(this.editingCategory.id, {
          name,
          // Al editar se envía el valor real del campo (incluso vacío) para
          // permitir limpiar la descripción existente en el backend.
          description: this.newCategoryDescription.trim(),
          active: this.newCategoryActive,
        })
      : this.catalogService.addCategory({
          name,
          // Al crear, una descripción vacía se omite (el backend la deja nula).
          description: this.newCategoryDescription.trim() || undefined,
        });

    request$.subscribe({
      next: () => {
        this.editingCategory = null;
        this.resetCategoryForm();
        this.loadCategories();
      },
      error: (error: unknown) => {
        this.showMessage('No se pudo guardar la categoría', this.toMessage(error));
      },
    });
  }

  startEditCategory(category: Category) {
    this.editingCategory = category;

    this.newCategory = category.name;

    this.newCategoryDescription = category.description ?? '';

    this.newCategoryActive = category.active ?? true;
  }

  async deleteCategory(category: Category) {
    const alert = await this.alertController.create({
      header: 'Eliminar categoría',
      message: `¿Seguro que deseas eliminar "${category.name}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          handler: () => {
            this.catalogService.deleteCategory(category.id).subscribe({
              next: () => {
                this.loadCategories();
              },
              error: (error: unknown) => {
                this.showMessage('No se pudo eliminar la categoría', this.toMessage(error));
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }

  async deleteBook(book: Book) {
    const active = this.loanService.hasActiveLoansForBook(book.id);

    const pending = this.loanService.hasPendingRequestsForBook(book.id);

    if (active || pending) {
      await this.showMessage(
        'No se puede eliminar',
        active
          ? `"${book.title}" tiene préstamos sin devolver. Devuélvelos primero.`
          : `"${book.title}" tiene solicitudes pendientes. Resuélvelas primero.`,
      );

      return;
    }

    const alert = await this.alertController.create({
      header: 'Eliminar libro',
      message: `¿Seguro que deseas eliminar "${book.title}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          handler: () => {
            this.catalogService.deleteBook(book.id).subscribe({
              next: () => {
                this.filteredBooks();
              },
              error: (error: unknown) => {
                this.showMessage('No se pudo eliminar el libro', this.toMessage(error));
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }

  openLendModal(book: Book) {
    this.libroParaPrestar = book;
    this.userSearchQuery = '';
    this.userCurrentPage = 1;
    this.loadUsersList(1);
  }

  closeLendModal() {
    this.libroParaPrestar = null;
    this.userSearchQuery = '';
  }

  confirmLend(user: User) {
    if (!this.libroParaPrestar) {
      return;
    }

    const bookToLend = this.libroParaPrestar;
    this.loading = true;

    this.loanService.createLoanApi(bookToLend.id, user.id).subscribe({
      next: () => {
        this.loading = false;
        this.closeLendModal();
        this.filteredBooks(this.currentPage);

        const userNameDisplay =
          user.name ||
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          user.identifier;

        this.showMessage(
          'Préstamo registrado',
          `"${bookToLend.title}" prestado a ${userNameDisplay} por 7 días.`,
        );
      },
      error: (error: unknown) => {
        this.loading = false;
        this.showMessage('No se pudo realizar el préstamo', this.toMessage(error));
      },
    });
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
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
