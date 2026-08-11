import { Component, OnInit } from '@angular/core';
import { CatalogService } from '../../Services/catalog.service';
import { Categoria } from '../../models/categoria.model';
import { Libro } from '../../models/libro.model';

@Component({
  selector: 'app-catalogo',
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
  standalone: false
})
export class CatalogoPage implements OnInit {

  termino: string = '';

  categoriaId: number = 0;

  categorias: Categoria[] = [];

  mostrarFormulario: boolean = false;

  nuevoTitulo: string = '';

  nuevoAutor: string = '';

  nuevoIsbn: string = '';

  nuevaCategoriaId: number = 0;

  nuevoAnio: number;

  constructor(
    private catalogService: CatalogService
  ) {
    this.nuevoAnio = new Date().getFullYear();
  }

  ngOnInit() {
    this.categorias = this.catalogService.listarCategorias();
  }

  librosFiltrados(): Libro[] {
    return this.catalogService.buscarLibros(
      this.termino,
      this.categoriaId
    );
  }

  nombreCategoria(categoriaId: number): string {
    const categoria =
      this.categorias.find(c => c.id === categoriaId);

    return categoria ? categoria.nombre : 'Sin categoría';
  }

  alternarFormulario() {
    this.mostrarFormulario = !this.mostrarFormulario;
  }

  agregarLibro() {

    if (
      !this.nuevoTitulo.trim() ||
      !this.nuevoAutor.trim() ||
      !this.nuevoIsbn.trim() ||
      this.nuevaCategoriaId === 0
    ) {
      return;
    }

    this.catalogService.agregarLibro({
      titulo: this.nuevoTitulo.trim(),
      autor: this.nuevoAutor.trim(),
      isbn: this.nuevoIsbn.trim(),
      categoriaId: this.nuevaCategoriaId,
      anio: this.nuevoAnio,
      disponible: true
    });

    this.nuevoTitulo = '';
    this.nuevoAutor = '';
    this.nuevoIsbn = '';
    this.nuevaCategoriaId = 0;
    this.nuevoAnio = new Date().getFullYear();

    this.mostrarFormulario = false;
  }

}
