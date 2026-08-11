import { Injectable } from '@angular/core';
import { Categoria } from '../models/categoria.model';
import { Libro } from '../models/libro.model';

@Injectable({
  providedIn: 'root'
})
export class CatalogService {

  private categorias: Categoria[] = [
    { id: 1, nombre: 'Novela' },
    { id: 2, nombre: 'Ciencia' },
    { id: 3, nombre: 'Historia' }
  ];

  private libros: Libro[] = [
    {
      id: 1,
      titulo: 'Cien años de soledad',
      autor: 'Gabriel García Márquez',
      isbn: '978-0307474728',
      categoriaId: 1,
      anio: 1967,
      disponible: true
    },
    {
      id: 2,
      titulo: 'Don Quijote de la Mancha',
      autor: 'Miguel de Cervantes',
      isbn: '978-8420412146',
      categoriaId: 1,
      anio: 1605,
      disponible: false
    },
    {
      id: 3,
      titulo: 'Introducción a la programación',
      autor: 'Libro académico',
      isbn: '978-0000000000',
      categoriaId: 2,
      anio: 2018,
      disponible: true
    },
    {
      id: 4,
      titulo: 'Una breve historia del tiempo',
      autor: 'Stephen Hawking',
      isbn: '978-0553380163',
      categoriaId: 2,
      anio: 1988,
      disponible: true
    },
    {
      id: 5,
      titulo: 'Sapiens: De animales a dioses',
      autor: 'Yuval Noah Harari',
      isbn: '978-8499926223',
      categoriaId: 3,
      anio: 2011,
      disponible: false
    }
  ];

  listarCategorias(): Categoria[] {
    return this.categorias;
  }

  listarLibros(): Libro[] {
    return this.libros;
  }

  buscarLibros(
    termino?: string,
    categoriaId?: number
  ): Libro[] {

    const texto = (termino || '').trim().toLowerCase();

    const categoria = categoriaId ?? 0;

    return this.libros.filter(libro => {

      const coincideCategoria =
        categoria === 0 || libro.categoriaId === categoria;

      const coincideTexto =
        texto === '' ||
        libro.titulo.toLowerCase().includes(texto) ||
        libro.autor.toLowerCase().includes(texto);

      return coincideCategoria && coincideTexto;
    });
  }

  agregarLibro(
    libro: Omit<Libro, 'id'>
  ): Libro {

    const siguienteId =
      this.libros.reduce((max, actual) => Math.max(max, actual.id), 0) + 1;

    const nuevoLibro: Libro = {
      ...libro,
      id: siguienteId
    };

    this.libros.push(nuevoLibro);

    return nuevoLibro;
  }

}
