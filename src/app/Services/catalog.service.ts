import { Injectable } from '@angular/core';
import { Category } from '../models/categoria.model';
import { Book } from '../models/libro.model';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly booksKey = 'alejandria_books';

  private readonly categoriesKey = 'alejandria_categories';

  private categories: Category[] = this.loadCategories();

  private books: Book[] = this.loadBooks();

  constructor() {
    if (!localStorage.getItem(this.categoriesKey)) {
      this.saveCategories();
    }

    if (!localStorage.getItem(this.booksKey)) {
      this.saveBooks();
    }
  }

  getCategories(): Category[] {
    return this.categories;
  }

  getBooks(): Book[] {
    return this.books;
  }

  searchBooks(query?: string, categoryId?: number): Book[] {
    const category = categoryId ?? 0;

    const tokens = this.normalize(query || '')
      .split(/\s+/)
      .filter(Boolean);

    return this.books.filter((book) => {
      const matchesCategory = category === 0 || book.categoryId === category;

      if (!matchesCategory) {
        return false;
      }

      if (tokens.length === 0) {
        return true;
      }

      const bookText = this.normalize(`${book.title} ${book.author} ${book.isbn}`);

      return tokens.every((token) => bookText.includes(token));
    });
  }

  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  addBook(book: Omit<Book, 'id'>): Book {
    const nextId = this.books.reduce((max, current) => Math.max(max, current.id), 0) + 1;

    const newBook: Book = {
      ...book,
      id: nextId,
    };

    this.books.push(newBook);

    this.saveBooks();

    return newBook;
  }

  updateBook(id: number, data: Partial<Book>): Book | null {
    const index = this.books.findIndex((book) => book.id === id);

    if (index === -1) {
      return null;
    }

    this.books[index] = {
      ...this.books[index],
      ...data,
    };

    this.saveBooks();

    return this.books[index];
  }

  deleteBook(id: number): boolean {
    const index = this.books.findIndex((book) => book.id === id);

    if (index === -1) {
      return false;
    }

    this.books.splice(index, 1);

    this.saveBooks();

    return true;
  }

  addCategory(name: string): Category {
    const nextId = this.categories.reduce((max, current) => Math.max(max, current.id), 0) + 1;

    const newCategory: Category = {
      id: nextId,
      name,
    };

    this.categories.push(newCategory);

    this.saveCategories();

    return newCategory;
  }

  updateCategory(id: number, name: string): Category | null {
    const category = this.categories.find((c) => c.id === id);

    if (!category) {
      return null;
    }

    category.name = name;

    this.saveCategories();

    return category;
  }

  deleteCategory(id: number): boolean {
    const inUse = this.books.some((book) => book.categoryId === id);

    if (inUse) {
      return false;
    }

    const index = this.categories.findIndex((c) => c.id === id);

    if (index === -1) {
      return false;
    }

    this.categories.splice(index, 1);

    this.saveCategories();

    return true;
  }

  private loadCategories(): Category[] {
    const stored = localStorage.getItem(this.categoriesKey);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Dato corrupto: se usan los valores iniciales
      }
    }

    return [
      { id: 1, name: 'Novela' },
      { id: 2, name: 'Ciencia' },
      { id: 3, name: 'Historia' },
    ];
  }

  private loadBooks(): Book[] {
    const stored = localStorage.getItem(this.booksKey);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Dato corrupto: se usan los valores iniciales
      }
    }

    return [
      {
        id: 1,
        title: 'Cien años de soledad',
        author: 'Gabriel García Márquez',
        isbn: '978-0307474728',
        categoryId: 1,
        year: 1967,
        available: true,
        description:
          'La historia de la familia Buendía en Macondo, obra maestra del realismo mágico.',
        cover: 'assets/img/covers/cien-anos-de-soledad.jpg',
      },
      {
        id: 2,
        title: 'Don Quijote de la Mancha',
        author: 'Miguel de Cervantes',
        isbn: '978-8420412146',
        categoryId: 1,
        year: 1605,
        available: false,
        description: 'Las aventuras del ingenioso hidalgo y su fiel escudero Sancho Panza.',
        cover: 'assets/img/covers/don-quijote.jpg',
      },
      {
        id: 3,
        title: 'Introducción a la programación',
        author: 'Libro académico',
        isbn: '978-0000000000',
        categoryId: 2,
        year: 2018,
        available: true,
        description: 'Manual académico con los fundamentos de la programación.',
        cover: 'assets/img/covers/introduccion-a-la-programacion.jpg',
      },
      {
        id: 4,
        title: 'Una breve historia del tiempo',
        author: 'Stephen Hawking',
        isbn: '978-0553380163',
        categoryId: 2,
        year: 1988,
        available: true,
        description:
          'El clásico de divulgación científica sobre el universo, del genial Stephen Hawking.',
        cover: 'assets/img/covers/breve-historia-del-tiempo.jpg',
      },
      {
        id: 5,
        title: 'Sapiens: De animales a dioses',
        author: 'Yuval Noah Harari',
        isbn: '978-8499926223',
        categoryId: 3,
        year: 2011,
        available: false,
        description: 'Un recorrido por la historia de la humanidad, de los homínidos a los dioses.',
        cover: 'assets/img/covers/sapiens.jpg',
      },
    ];
  }

  private saveCategories() {
    localStorage.setItem(this.categoriesKey, JSON.stringify(this.categories));
  }

  private saveBooks() {
    localStorage.setItem(this.booksKey, JSON.stringify(this.books));
  }
}
