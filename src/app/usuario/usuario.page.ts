import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../Services/auth.service';
import { CatalogService } from '../Services/catalog.service';
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

  constructor(
    private authService: AuthService,
    private router: Router,
    private catalogService: CatalogService,
  ) {}

  ngOnInit() {
    this.categories = this.catalogService.getCategories();
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
}
