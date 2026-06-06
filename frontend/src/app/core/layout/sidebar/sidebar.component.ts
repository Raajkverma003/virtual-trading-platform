import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatListModule,
    MatIconModule
  ],
  template: `
    <nav class="kite-sidebar">
      <mat-nav-list class="sidebar-list">
        <a mat-list-item routerLink="/dashboard" routerLinkActive="active-link">
          <mat-icon matListItemIcon>dashboard</mat-icon>
          <span matListItemTitle class="nav-label">Dashboard</span>
        </a>
        
        <a mat-list-item routerLink="/orders" routerLinkActive="active-link">
          <mat-icon matListItemIcon>assignment</mat-icon>
          <span matListItemTitle class="nav-label">Orders</span>
        </a>

        <a mat-list-item routerLink="/portfolio" routerLinkActive="active-link">
          <mat-icon matListItemIcon>pie_chart</mat-icon>
          <span matListItemTitle class="nav-label">Portfolio</span>
        </a>

        <a mat-list-item routerLink="/funds" routerLinkActive="active-link">
          <mat-icon matListItemIcon>account_balance_wallet</mat-icon>
          <span matListItemTitle class="nav-label">Funds</span>
        </a>

        <a mat-list-item routerLink="/leaderboard" routerLinkActive="active-link">
          <mat-icon matListItemIcon>emoji_events</mat-icon>
          <span matListItemTitle class="nav-label">Leaderboard</span>
        </a>

        <a mat-list-item routerLink="/reports" routerLinkActive="active-link">
          <mat-icon matListItemIcon>bar_chart</mat-icon>
          <span matListItemTitle class="nav-label">Reports</span>
        </a>
      </mat-nav-list>
    </nav>
  `,
  styles: [`
    .kite-sidebar {
      width: 220px;
      background-color: #ffffff;
      border-right: 1px solid #e0e0e0;
      height: calc(100vh - 60px);
      padding: 16px 0;
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .sidebar-list {
      padding: 0;
    }
    a.mat-mdc-list-item {
      height: 44px;
      color: #555555;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      margin: 4px 8px;
      border-radius: 4px;
      width: auto;
      display: flex;
    }
    a.mat-mdc-list-item:hover {
      background-color: #f9f9f9;
      color: #ff5722;
    }
    .active-link {
      background-color: #fff3f0 !important;
      color: #ff5722 !important;
    }
    .active-link mat-icon {
      color: #ff5722 !important;
    }
    .nav-label {
      font-weight: 500;
    }
    mat-icon {
      color: #777777;
    }
  `]
})
export class SidebarComponent {}
