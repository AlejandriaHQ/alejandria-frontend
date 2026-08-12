import { Injectable } from '@angular/core';
import { Categoria } from '../models/categoria.model';
import { Libro } from '../models/libro.model';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private categorias: Categoria[] = [
    { id: 1, nombre: 'Novela' },
    { id: 2, nombre: 'Ciencia' },
    { id: 3, nombre: 'Historia' },
  ];

  private libros: Libro[] = [
    {
      id: 1,
      titulo: 'Cien años de soledad',
      autor: 'Gabriel García Márquez',
      isbn: '978-0307474728',
      categoriaId: 1,
      anio: 1967,
      disponible: true,
      descripcion:
        'La historia de la familia Buendía en Macondo, obra maestra del realismo mágico.',
      portada: 'assets/img/covers/cien-anos-de-soledad.jpg',
    },
    {
      id: 2,
      titulo: 'Don Quijote de la Mancha',
      autor: 'Miguel de Cervantes',
      isbn: '978-8420412146',
      categoriaId: 1,
      anio: 1605,
      disponible: false,
      descripcion: 'Las aventuras del ingenioso hidalgo y su fiel escudero Sancho Panza.',
      portada: 'assets/img/covers/don-quijote.jpg',
    },
    {
      id: 3,
      titulo: 'Introducción a la programación',
      autor: 'Libro académico',
      isbn: '978-0000000000',
      categoriaId: 2,
      anio: 2018,
      disponible: true,
      descripcion: 'Manual académico con los fundamentos de la programación.',
      portada: 'assets/img/covers/introduccion-a-la-programacion.jpg',
    },
    {
      id: 4,
      titulo: 'Una breve historia del tiempo',
      autor: 'Stephen Hawking',
      isbn: '978-0553380163',
      categoriaId: 2,
      anio: 1988,
      disponible: true,
      descripcion:
        'El clásico de divulgación científica sobre el universo, del genial Stephen Hawking.',
      portada: 'assets/img/covers/breve-historia-del-tiempo.jpg',
    },
    {
      id: 5,
      titulo: 'Sapiens: De animales a dioses',
      autor: 'Yuval Noah Harari',
      isbn: '978-8499926223',
      categoriaId: 3,
      anio: 2011,
      disponible: false,
      descripcion: 'Un recorrido por la historia de la humanidad, de los homínidos a los dioses.',
      portada: 'assets/img/covers/sapiens.jpg',
    },
  ];

  listarCategorias(): Categoria[] {
    return this.categorias;
  }

  listarLibros(): Libro[] {
    return this.libros;
  }

  buscarLibros(termino?: string, categoriaId?: number): Libro[] {
    const categoria = categoriaId ?? 0;

    const tokens = this.normalizar(termino || '')
      .split(/\s+/)
      .filter(Boolean);

    return this.libros.filter((libro) => {
      const coincideCategoria = categoria === 0 || libro.categoriaId === categoria;

      if (!coincideCategoria) {
        return false;
      }

      if (tokens.length === 0) {
        return true;
      }

      const textoLibro = this.normalizar(`${libro.titulo} ${libro.autor} ${libro.isbn}`);

      return tokens.every((token) => textoLibro.includes(token));
    });
  }

  private normalizar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  agregarLibro(libro: Omit<Libro, 'id'>): Libro {
    const siguienteId = this.libros.reduce((max, actual) => Math.max(max, actual.id), 0) + 1;

    const nuevoLibro: Libro = {
      ...libro,
      id: siguienteId,
    };

    this.libros.push(nuevoLibro);

    return nuevoLibro;
  }

  editarLibro(id: number, datos: Partial<Libro>): Libro | null {
    const indice = this.libros.findIndex((libro) => libro.id === id);

    if (indice === -1) {
      return null;
    }

    this.libros[indice] = {
      ...this.libros[indice],
      ...datos,
    };

    return this.libros[indice];
  }

  eliminarLibro(id: number): boolean {
    const indice = this.libros.findIndex((libro) => libro.id === id);

    if (indice === -1) {
      return false;
    }

    this.libros.splice(indice, 1);

    return true;
  }
}
