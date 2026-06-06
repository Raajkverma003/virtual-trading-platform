import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { TradeService } from '../../core/services/trade.service';
import { WebsocketService } from '../../core/services/websocket.service';

interface OrderItem {
  _id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  shares: number;
  price?: number;
  limitPrice?: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  createdAt: string;
  timestamp?: string;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit, OnDestroy {
  private tradeService = inject(TradeService);
  private wsService = inject(WebsocketService);
  private snackBar = inject(MatSnackBar);

  activeTab = signal<'pending' | 'history'>('pending');
  pendingOrders = signal<OrderItem[]>([]);
  historyOrders = signal<OrderItem[]>([]);
  loadingPending = signal<boolean>(true);
  loadingHistory = signal<boolean>(true);
  cancellingId = signal<string | null>(null);

  private wsExecSub!: Subscription;
  private wsCancelSub!: Subscription;

  ngOnInit(): void {
    this.fetchPending();
    this.fetchHistory();
    this.subscribeToWsNotifications();
  }

  ngOnDestroy(): void {
    if (this.wsExecSub) this.wsExecSub.unsubscribe();
    if (this.wsCancelSub) this.wsCancelSub.unsubscribe();
  }

  setActiveTab(tab: 'pending' | 'history'): void {
    this.activeTab.set(tab);
    if (tab === 'pending') {
      this.fetchPending();
    } else {
      this.fetchHistory();
    }
  }

  private fetchPending(): void {
    this.loadingPending.set(true);
    this.tradeService.getPendingOrders().subscribe({
      next: (res: any) => {
        this.pendingOrders.set(res.data || []);
        this.loadingPending.set(false);
      },
      error: () => {
        this.snackBar.open('Error loading pending orders.', 'Dismiss', { duration: 3000 });
        this.loadingPending.set(false);
      }
    });
  }

  private fetchHistory(): void {
    this.loadingHistory.set(true);
    this.tradeService.getTransactionHistory().subscribe({
      next: (res: any) => {
        this.historyOrders.set(res.data || []);
        this.loadingHistory.set(false);
      },
      error: () => {
        this.snackBar.open('Error loading transaction log.', 'Dismiss', { duration: 3000 });
        this.loadingHistory.set(false);
      }
    });
  }

  private subscribeToWsNotifications(): void {
    // Refresh both views when any order is executed in real-time
    this.wsExecSub = this.wsService.orderExecuted$.subscribe((data: any) => {
      this.snackBar.open(`Limit Order Executed: ${data.symbol} ${data.type} ${data.shares} shares @ $${data.price}`, 'Close', {
        duration: 5000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      this.fetchPending();
      this.fetchHistory();
    });

    // Refresh when any order is cancelled in real-time
    this.wsCancelSub = this.wsService.orderCancelled$.subscribe((data: any) => {
      this.snackBar.open(`Limit Order Cancelled: ${data.symbol} ${data.type} ${data.shares} shares (Reason: ${data.reason || 'Manual'})`, 'Close', {
        duration: 5000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      this.fetchPending();
      this.fetchHistory();
    });
  }

  cancelLimitOrder(orderId: string): void {
    this.cancellingId.set(orderId);
    this.tradeService.cancelOrder(orderId).subscribe({
      next: (res: any) => {
        this.cancellingId.set(null);
        this.snackBar.open(res.message || 'Order cancelled successfully.', 'Dismiss', { duration: 3000 });
        this.fetchPending();
        this.fetchHistory();
      },
      error: (err) => {
        this.cancellingId.set(null);
        this.snackBar.open(err.error?.message || 'Error cancelling order.', 'Dismiss', { duration: 3000 });
      }
    });
  }
}
