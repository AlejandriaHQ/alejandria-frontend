import { Component, OnInit } from '@angular/core';
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

  newAvailable: boolean = true;

  users: User[] = [];

  libroParaPrestar: Book | null = null;

  constructor(
    private catalogService: CatalogService,
    private loanService: LoanService,
    private alertController: AlertController,
  ) {
    this.newYear = new Date().getFullYear();
  }

  ngOnInit() {
    this.categories = this.catalogService.getCategories();

    this.users = this.loanService.getUsers();
  }

  filteredBooks(): Book[] {
    return this.catalogService.searchBooks(this.query, this.categoryId);
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
    this.newAvailable = book.available;

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
    this.newAvailable = true;
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
      available: this.newAvailable,
    };

    if (this.editingBook) {
      this.catalogService.updateBook(this.editingBook.id, data);
    } else {
      this.catalogService.addBook(data);
    }

    this.closeForm();
  }

  showDetail(book: Book) {
    this.selectedBook = book;
  }

  closeDetail() {
    this.selectedBook = null;
  }

  onCoverSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      this.newCover = reader.result as string;
    };

    reader.readAsDataURL(file);

    input.value = '';
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

    if (this.editingCategory) {
      this.catalogService.updateCategory(this.editingCategory.id, name);
    } else {
      this.catalogService.addCategory(name);
    }

    this.editingCategory = null;

    this.newCategory = '';

    this.categories = this.catalogService.getCategories();
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
            const deleted = this.catalogService.deleteCategory(category.id);

            if (!deleted) {
              this.showCategoryInUseError(category);
            }

            this.categories = this.catalogService.getCategories();
          },
        },
      ],
    });

    await alert.present();
  }

  private async showCategoryInUseError(category: Category) {
    const alert = await this.alertController.create({
      header: 'No se puede eliminar',
      message: `La categoría "${category.name}" tiene libros asignados. Reasigna o elimina esos libros primero.`,
      buttons: [
        {
          text: 'Entendido',
          role: 'cancel',
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
            const deleted = this.catalogService.deleteBook(book.id);

            if (!deleted) {
              this.showMessage('No se pudo eliminar', 'El libro no se encontró.');
            }
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
