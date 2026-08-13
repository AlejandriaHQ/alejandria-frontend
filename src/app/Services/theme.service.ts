import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly themeKey = 'alejandria_tema';

  isDark: boolean = false;

  constructor() {
    this.isDark = localStorage.getItem(this.themeKey) === 'dark';

    this.apply();
  }

  toggleTheme() {
    this.isDark = !this.isDark;

    localStorage.setItem(this.themeKey, this.isDark ? 'dark' : 'light');

    this.apply();
  }

  private apply() {
    const root = document.documentElement;

    if (this.isDark) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }
}
