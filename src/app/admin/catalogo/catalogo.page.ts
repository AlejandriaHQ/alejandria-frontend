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

  editingCategory: Category | null = null;

  newTitle: string = '';

  newAuthor: string = '';

  newIsbn: string = '';

  newCategoryId: number = 0;

  newYear: number;

  newCover: string = '';

  loading: boolean = false;

  private readonly booksSubject = new BehaviorSubject<Book[]>([]);

  readonly books$: Observable<Book[]> = this.booksSubject.asObservable();

  users: User[] = [];

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

    this.users = this.loanService.getUsers();
  }

  /** Recarga la lista visible de libros según los filtros actuales. */
  filteredBooks() {
    this.loading = true;

    this.catalogService.searchBooksAsync(this.query, this.categoryId).subscribe({
      next: (books) => {
        this.booksSubject.next(books);
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.showMessage('Error al cargar libros', this.toMessage(error));
      },
    });
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

    const data = {
      title: this.newTitle.trim(),
      author: this.newAuthor.trim(),
      isbn: this.newIsbn.trim(),
      categoryId: this.newCategoryId,
      year: this.newYear,
      cover: this.newCover || undefined,
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

    this.newCategory = '';
  }

  addCategory() {
    const name = this.newCategory.trim();

    if (!name) {
      return;
    }

    const request$ = this.editingCategory
      ? this.catalogService.updateCategory(this.editingCategory.id, name)
      : this.catalogService.addCategory(name);

    request$.subscribe({
      next: () => {
        this.editingCategory = null;
        this.newCategory = '';
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
  }

  closeLendModal() {
    this.libroParaPrestar = null;
  }

  async confirmLend(user: User) {
    if (!this.libroParaPrestar) {
      return;
    }

    const loan = this.loanService.createLoan(this.libroParaPrestar.id, user.id);

    if (!loan) {
      await this.showMessage(
        'No se pudo prestar',
        'Verifica que el libro esté disponible y que el usuario no tenga 3 préstamos activos ni vencidos sin devolver.',
      );

      return;
    }

    await this.showMessage(
      'Préstamo registrado',
      `"${this.libroParaPrestar.title}" prestado a ${user.name} por 7 días.`,
    );

    this.closeLendModal();
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
