import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { PortfolioService } from '../../core/services/portfolio.service';
import { WebsocketService } from '../../core/services/websocket.service';

interface PositionItem {
  _id: string;
  symbol: string;
  name: string;
  assetType: 'STOCK' | 'FUTURE' | 'OPTION';
  optionType?: 'CALL' | 'PUT' | null;
  strikePrice?: number | null;
  expiry?: string | null;
  quantity: number; // positive = buy/long, negative = sell/short
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
  flashState?: 'up' | 'down' | null;
}

@Component({
  selector: 'app-positions',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './positions.component.html',
  styleUrl: './positions.component.css'
})
export class PositionsComponent implements OnInit, OnDestroy {
  private portfolioService = inject(PortfolioService);
  private wsService = inject(WebsocketService);
  private snackBar = inject(MatSnackBar);

  positions = signal<PositionItem[]>([]);
  loading = signal<boolean>(true);
  settling = signal<boolean>(false);
  cashBalance = signal<number>(0);

  showConfirmSettle = signal<boolean>(false);

  private priceSub!: Subscription;

  // Computed signals for total metrics
  totalPnl = computed(() => {
    return this.positions().reduce((sum, pos) => sum + pos.pnl, 0);
  });

  getAssetPrice(assetType: string, stockPrice: number, optionType?: string | null, strikePrice?: number | null): number {
    if (assetType === 'STOCK') return stockPrice;
    if (assetType === 'FUTURE') return stockPrice + 1.50;
    if (assetType === 'OPTION') {
      const strike = strikePrice || 0;
      if (optionType === 'CALL') {
        return Math.max(0.05, stockPrice - strike) + 2.00;
      } else if (optionType === 'PUT') {
        return Math.max(0.05, strike - stockPrice) + 2.00;
      }
    }
    return stockPrice;
  }

  ngOnInit(): void {
    this.fetchPositions();
    this.subscribeToSocketPrices();
  }

  ngOnDestroy(): void {
    if (this.priceSub) {
      this.priceSub.unsubscribe();
    }
  }

  fetchPositions(): void {
    this.portfolioService.getPositions().subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.positions.set(res.data);
          this.cashBalance.set(res.balance || 0);
        }
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open('Error loading active positions.', 'Dismiss', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  onSettle(): void {
    this.showConfirmSettle.set(true);
  }

  onCancelSettle(): void {
    this.showConfirmSettle.set(false);
  }

  onConfirmSettle(): void {
    this.settling.set(true);
    this.portfolioService.settlePositions().subscribe({
      next: (res: any) => {
        this.snackBar.open(res.message || 'Settlement processed successfully!', 'Dismiss', { duration: 4000 });
        this.positions.set([]);
        this.settling.set(false);
        this.showConfirmSettle.set(false);
        this.fetchPositions();
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Error processing settlement.', 'Dismiss', { duration: 3000 });
        this.settling.set(false);
        this.showConfirmSettle.set(false);
      }
    });
  }

  private subscribeToSocketPrices(): void {
    this.priceSub = this.wsService.stockPrices$.subscribe((socketPrices: any[]) => {
      const currentPositions = this.positions();
      if (currentPositions.length === 0) return;

      let hasChanged = false;
      const updated = currentPositions.map(pos => {
        const update = socketPrices.find(sp => sp.symbol === pos.symbol);
        if (update) {
          const prevLtp = pos.ltp;
          const newStockPrice = update.price;
          
          const newLtp = this.getAssetPrice(pos.assetType, newStockPrice, pos.optionType, pos.strikePrice);
          if (Math.abs(prevLtp - newLtp) < 0.001) return pos;

          hasChanged = true;
          
          let flashState: 'up' | 'down' | null = null;
          if (newLtp > prevLtp) {
            flashState = 'up';
          } else if (newLtp < prevLtp) {
            flashState = 'down';
          }

          if (flashState) {
            setTimeout(() => {
              this.clearFlashState(pos._id);
            }, 1000);
          }

          // Compute P&L
          let pnl = 0;
          let pnlPercent = 0;
          if (pos.quantity > 0) {
            pnl = pos.quantity * (newLtp - pos.avgPrice);
            pnlPercent = pos.avgPrice > 0 ? ((newLtp - pos.avgPrice) / pos.avgPrice) * 100 : 0;
          } else if (pos.quantity < 0) {
            pnl = Math.abs(pos.quantity) * (pos.avgPrice - newLtp);
            pnlPercent = pos.avgPrice > 0 ? ((pos.avgPrice - newLtp) / pos.avgPrice) * 100 : 0;
          }

          return {
            ...pos,
            ltp: Math.round(newLtp * 100) / 100,
            pnl: Math.round(pnl * 100) / 100,
            pnlPercent: Math.round(pnlPercent * 100) / 100,
            flashState
          };
        }
        return pos;
      });

      if (hasChanged) {
        this.positions.set(updated);
      }
    });
  }

  private clearFlashState(id: string): void {
    const updated = this.positions().map(p => {
      if (p._id === id) {
        return { ...p, flashState: null };
      }
      return p;
    });
    this.positions.set(updated);
  }

  getAssetTypeLabel(pos: PositionItem): string {
    if (pos.assetType === 'STOCK') return 'Stock';
    if (pos.assetType === 'FUTURE') return 'Future';
    if (pos.assetType === 'OPTION') {
      return `Option (${pos.optionType})`;
    }
    return pos.assetType;
  }

  getExpiryLabel(pos: PositionItem): string {
    if (pos.assetType === 'STOCK') return 'N/A';
    return pos.expiry || 'N/A';
  }

  getStrikeLabel(pos: PositionItem): string {
    if (pos.assetType === 'OPTION' && pos.strikePrice) {
      return `$${pos.strikePrice.toFixed(2)}`;
    }
    return 'N/A';
  }
}
