import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../Services/auth.service';
import { CatalogService } from '../Services/catalog.service';
import { Categoria } from '../models/categoria.model';
import { Libro } from '../models/libro.model';

@Component({
  selector: 'app-usuario',
  templateUrl: './usuario.page.html',
  styleUrls: ['./usuario.page.scss'],
  standalone: false,
})
export class UsuarioPage implements OnInit {
  termino: string = '';

  categoriaId: number = 0;

  categorias: Categoria[] = [];

  libroSeleccionado: Libro | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private catalogService: CatalogService,
  ) {}

  ngOnInit() {
    this.categorias = this.catalogService.listarCategorias();
  }

  verDetalle(libro: Libro) {
    this.libroSeleccionado = libro;
  }

  cerrarDetalle() {
    this.libroSeleccionado = null;
  }

  librosFiltrados(): Libro[] {
    return this.catalogService.buscarLibros(this.termino, this.categoriaId);
  }

  nombreCategoria(categoriaId: number): string {
    const categoria = this.categorias.find((c) => c.id === categoriaId);

    return categoria ? categoria.nombre : 'Sin categoría';
  }

  cerrarSesion() {
    this.authService.cerrarSesion();
  }
}
