import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { CatalogService } from '../../Services/catalog.service';
import { Categoria } from '../../models/categoria.model';
import { Libro } from '../../models/libro.model';

@Component({
  selector: 'app-catalogo',
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
  standalone: false,
})
export class CatalogoPage implements OnInit {
  termino: string = '';

  categoriaId: number = 0;

  categorias: Categoria[] = [];

  mostrarFormulario: boolean = false;

  formularioInvalido: boolean = false;

  libroEnEdicion: Libro | null = null;

  libroSeleccionado: Libro | null = null;

  nuevoTitulo: string = '';

  nuevoAutor: string = '';

  nuevoIsbn: string = '';

  nuevaCategoriaId: number = 0;

  nuevoAnio: number;

  constructor(
    private catalogService: CatalogService,
    private alertController: AlertController,
  ) {
    this.nuevoAnio = new Date().getFullYear();
  }

  ngOnInit() {
    this.categorias = this.catalogService.listarCategorias();
  }

  librosFiltrados(): Libro[] {
    return this.catalogService.buscarLibros(this.termino, this.categoriaId);
  }

  nombreCategoria(categoriaId: number): string {
    const categoria = this.categorias.find((c) => c.id === categoriaId);

    return categoria ? categoria.nombre : 'Sin categoría';
  }

  alternarFormulario() {
    if (this.mostrarFormulario) {
      this.cancelarFormulario();
    } else {
      this.abrirFormularioNuevo();
    }
  }

  abrirFormularioNuevo() {
    this.libroEnEdicion = null;

    this.limpiarFormulario();

    this.mostrarFormulario = true;
  }

  abrirFormularioEdicion(libro: Libro) {
    this.libroEnEdicion = libro;

    this.formularioInvalido = false;

    this.nuevoTitulo = libro.titulo;
    this.nuevoAutor = libro.autor;
    this.nuevoIsbn = libro.isbn;
    this.nuevaCategoriaId = libro.categoriaId;
    this.nuevoAnio = libro.anio;

    this.mostrarFormulario = true;
  }

  cancelarFormulario() {
    this.mostrarFormulario = false;

    this.libroEnEdicion = null;

    this.limpiarFormulario();
  }

  verDetalle(libro: Libro) {
    this.libroSeleccionado = libro;
  }

  cerrarDetalle() {
    this.libroSeleccionado = null;
  }

  private limpiarFormulario() {
    this.nuevoTitulo = '';
    this.nuevoAutor = '';
    this.nuevoIsbn = '';
    this.nuevaCategoriaId = 0;
    this.nuevoAnio = new Date().getFullYear();
    this.formularioInvalido = false;
  }

  guardarLibro() {
    if (
      !this.nuevoTitulo.trim() ||
      !this.nuevoAutor.trim() ||
      !this.nuevoIsbn.trim() ||
      this.nuevaCategoriaId === 0
    ) {
      this.formularioInvalido = true;

      return;
    }

    const datos = {
      titulo: this.nuevoTitulo.trim(),
      autor: this.nuevoAutor.trim(),
      isbn: this.nuevoIsbn.trim(),
      categoriaId: this.nuevaCategoriaId,
      anio: this.nuevoAnio,
    };

    if (this.libroEnEdicion) {
      this.catalogService.editarLibro(this.libroEnEdicion.id, datos);
    } else {
      this.catalogService.agregarLibro({
        ...datos,
        disponible: true,
      });
    }

    this.cancelarFormulario();
  }

  async eliminarLibro(libro: Libro) {
    const alert = await this.alertController.create({
      header: 'Eliminar libro',
      message: `¿Seguro que deseas eliminar "${libro.titulo}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          handler: () => this.catalogService.eliminarLibro(libro.id),
        },
      ],
    });

    await alert.present();
  }
}
