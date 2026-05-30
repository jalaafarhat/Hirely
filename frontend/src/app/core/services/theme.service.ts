import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(this.loadTheme());

  constructor() {
    effect(() => {
      const dark = this.isDark();
      document.documentElement.classList.toggle('dark', dark);
      localStorage.setItem('hirely_theme', dark ? 'dark' : 'light');
    });
  }

  private loadTheme(): boolean {
    const stored = localStorage.getItem('hirely_theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  toggle() {
    this.isDark.update((v) => !v);
  }
}
