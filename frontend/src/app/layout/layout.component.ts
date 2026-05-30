import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      @if (menuOpen()) {
        <div class="sidebar-backdrop" (click)="closeMenu()"></div>
      }

      <aside class="sidebar" [class.open]="menuOpen()">
        <div class="sidebar-header">
          <span class="logo">Hirely</span>
          <button type="button" class="close-btn" (click)="closeMenu()" aria-label="Close menu">✕</button>
        </div>
        <nav class="nav">
          <a routerLink="/dashboard" routerLinkActive="active" (click)="closeMenu()">Dashboard</a>
          <a routerLink="/jobs" routerLinkActive="active" (click)="closeMenu()">Jobs</a>
          <a routerLink="/saved-jobs" routerLinkActive="active" (click)="closeMenu()">Saved Jobs</a>
          <a routerLink="/profile" routerLinkActive="active" (click)="closeMenu()">Profile</a>
          <a routerLink="/preferences" routerLinkActive="active" (click)="closeMenu()">Preferences</a>
          <a routerLink="/settings" routerLinkActive="active" (click)="closeMenu()">Settings</a>
          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active" (click)="closeMenu()">Admin</a>
          }
        </nav>
        <div class="sidebar-footer">
          <button type="button" class="theme-btn" (click)="theme.toggle()">
            {{ theme.isDark() ? '☀️ Light' : '🌙 Dark' }}
          </button>
          <button type="button" class="logout-btn" (click)="logout()">Logout</button>
        </div>
      </aside>

      <div class="content">
        <header class="mobile-header">
          <button type="button" class="menu-btn" (click)="toggleMenu()" aria-label="Open menu">☰</button>
          <span class="mobile-logo">Hirely</span>
        </header>
        <main class="main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout { display: flex; min-height: 100vh; min-height: 100dvh; }
    .sidebar {
      width: 240px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      padding: 20px 0;
      position: fixed;
      height: 100vh;
      height: 100dvh;
      z-index: 200;
      transition: transform 0.25s ease;
    }
    .sidebar-header {
      padding: 0 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo { font-size: 22px; font-weight: 700; color: var(--accent); }
    .close-btn {
      display: none;
      background: none;
      border: none;
      font-size: 20px;
      color: var(--text-secondary);
      padding: 4px 8px;
    }
    .nav { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 0 12px; overflow-y: auto; }
    .nav a { padding: 10px 12px; border-radius: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500; transition: all 0.15s; }
    .nav a:hover { background: var(--bg-tertiary); color: var(--text-primary); }
    .nav a.active { background: rgba(79,70,229,0.1); color: var(--accent); }
    .sidebar-footer { padding: 16px 20px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px; }
    .theme-btn, .logout-btn { background: none; border: 1px solid var(--border-color); padding: 8px; border-radius: 8px; color: var(--text-secondary); font-size: 13px; }
    .content { flex: 1; margin-left: 240px; min-width: 0; display: flex; flex-direction: column; }
    .mobile-header {
      display: none;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .menu-btn {
      background: none;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 18px;
      color: var(--text-primary);
    }
    .mobile-logo { font-size: 18px; font-weight: 700; color: var(--accent); }
    .main { flex: 1; padding: 32px; background: var(--bg-secondary); min-height: 100vh; min-height: 100dvh; }
    .sidebar-backdrop { display: none; }

    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); box-shadow: 4px 0 24px rgba(0,0,0,0.15); }
      .close-btn { display: block; }
      .content { margin-left: 0; }
      .mobile-header { display: flex; }
      .main { padding: 16px; }
      .sidebar-backdrop {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 150;
      }
    }
  `],
})
export class LayoutComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  private router = inject(Router);
  menuOpen = signal(false);

  toggleMenu() {
    this.menuOpen.update((v) => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
