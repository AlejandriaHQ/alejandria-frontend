import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly claveTema = 'alejandria_tema';

  esOscuro: boolean = false;

  constructor() {
    this.esOscuro = localStorage.getItem(this.claveTema) === 'dark';

    this.aplicar();
  }

  alternarTema() {
    this.esOscuro = !this.esOscuro;

    localStorage.setItem(this.claveTema, this.esOscuro ? 'dark' : 'light');

    this.aplicar();
  }

  private aplicar() {
    const raiz = document.documentElement;

    if (this.esOscuro) {
      raiz.setAttribute('data-theme', 'dark');
    } else {
      raiz.removeAttribute('data-theme');
    }
  }
}
