import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule
  ],
  template: `
    <mat-toolbar class="kite-header">
      <div class="header-left">
        <span class="logo-text" routerLink="/dashboard">
          <span class="brand-blue">V-</span>Kite
        </span>
      </div>

      <div class="header-right" *ngIf="authService.currentUser()">
        <span class="connection-status" [title]="wsService.isConnected() ? 'Real-time feed active' : 'Live updates disconnected'">
          <span class="status-dot" [class.connected]="wsService.isConnected()"></span>
          {{ wsService.isConnected() ? 'Live' : 'Offline' }}
        </span>

        <span class="funds-badge">
          Funds: <strong class="funds-amount">{{ authService.currentUser().balance | currency:'USD':'symbol':'1.2-2' }}</strong>
        </span>

        <button mat-button [matMenuTriggerFor]="menu" class="user-menu-btn">
          <mat-icon>account_circle</mat-icon>
          <span class="username">{{ authService.currentUser().username }}</span>
        </button>
        <mat-menu #menu="matMenu" xPosition="before">
          <div class="menu-profile-info">
            <p class="profile-name">{{ authService.currentUser().username }}</p>
            <p class="profile-email">{{ authService.currentUser().email }}</p>
            <p class="profile-role" *ngIf="authService.currentUser().role">Role: <strong>{{ authService.currentUser().role }}</strong></p>
          </div>
          <hr class="menu-divider" />
          <button mat-menu-item (click)="authService.logout()">
            <mat-icon>exit_to_app</mat-icon>
            <span>Logout</span>
          </button>
        </mat-menu>
      </div>
    </mat-toolbar>
  `,
  styles: [`
    .kite-header {
      background-color: #ffffff;
      color: #333333;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 60px;
      padding: 0 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      z-index: 1000;
      position: relative;
    }
    .logo-text {
      font-size: 20px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.5px;
      color: #444;
      user-select: none;
    }
    .brand-blue {
      color: #ff5722; /* Kite Orange logo theme accent */
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 24px;
      font-size: 14px;
    }
    .connection-status {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #666;
      font-size: 12px;
      background-color: #f5f5f5;
      padding: 4px 10px;
      border-radius: 12px;
      user-select: none;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background-color: #ff5722;
      border-radius: 50%;
      display: inline-block;
    }
    .status-dot.connected {
      background-color: #4caf50;
      box-shadow: 0 0 6px #4caf50;
    }
    .funds-badge {
      color: #555555;
    }
    .funds-amount {
      color: #387ed1;
      font-weight: 600;
    }
    .user-menu-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #555;
    }
    .username {
      margin-left: 4px;
      font-weight: 500;
      text-transform: capitalize;
    }
    .menu-profile-info {
      padding: 12px 16px;
      min-width: 180px;
    }
    .profile-name {
      font-weight: 600;
      margin: 0;
      color: #333;
      text-transform: capitalize;
    }
    .profile-email {
      font-size: 12px;
      color: #777;
      margin: 4px 0 0 0;
    }
    .profile-role {
      font-size: 11px;
      color: #ff5722;
      margin: 4px 0 0 0;
    }
    .menu-divider {
      border: 0;
      border-top: 1px solid #eee;
      margin: 4px 0;
    }
  `]
})
export class HeaderComponent {
  authService = inject(AuthService);
  wsService = inject(WebsocketService);
}
