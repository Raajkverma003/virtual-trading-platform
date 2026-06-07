import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PortfolioService } from '../../core/services/portfolio.service';
import { WebsocketService } from '../../core/services/websocket.service';

interface HoldingItem {
  symbol: string;
  name: string;
  shares: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  dayChangePercent: number;
}

@Component({
  selector: 'app-holdings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatButtonModule
  ],
  templateUrl: './holdings.component.html',
  styleUrl: './holdings.component.css'
})
export class HoldingsComponent implements OnInit, OnDestroy {
  private portfolioService = inject(PortfolioService);
  private wsService = inject(WebsocketService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  holdings = signal<HoldingItem[]>([]);
  loading = signal<boolean>(true);
  searchTerm = signal<string>('');

  private priceSub!: Subscription;

  // Live filtered holdings based on search query
  filteredHoldings = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.holdings();
    return this.holdings().filter(h => {
      const symbolMatch = h.symbol ? h.symbol.toLowerCase().includes(term) : false;
      const nameMatch = h.name ? h.name.toLowerCase().includes(term) : false;
      return symbolMatch || nameMatch;
    });
  });

  // Overall current valuation of all active holdings in INR (formatted directly with ₹)
  overallCurrentValue = computed(() => {
    return this.holdings().reduce((sum, h) => sum + h.currentValue, 0);
  });

  // Overall all-time profit/loss in INR
  overallProfitLoss = computed(() => {
    return this.holdings().reduce((sum, h) => sum + h.pnl, 0);
  });

  // Overall average return percentage
  overallReturnPercent = computed(() => {
    const totalCost = this.holdings().reduce((sum, h) => sum + (h.shares * h.avgBuyPrice), 0);
    if (totalCost === 0) return 0;
    return (this.overallProfitLoss() / totalCost) * 100;
  });

  onBuyMore(symbol: string): void {
    this.router.navigate(['/dashboard'], { queryParams: { symbol: symbol.toUpperCase(), action: 'BUY' } });
  }

  onSell(symbol: string): void {
    this.router.navigate(['/dashboard'], { queryParams: { symbol: symbol.toUpperCase(), action: 'SELL' } });
  }

  onAnalyze(symbol: string): void {
    this.router.navigate(['/dashboard'], { queryParams: { symbol: symbol.toUpperCase() } });
  }

  ngOnInit(): void {
    this.fetchHoldings();
    this.subscribeToSocketPrices();
  }

  ngOnDestroy(): void {
    if (this.priceSub) {
      this.priceSub.unsubscribe();
    }
  }

  private fetchHoldings(): void {
    this.portfolioService.getPortfolio().subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.holdings.set(res.data.holdings || []);
        }
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open('Error loading holdings data.', 'Dismiss', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  private subscribeToSocketPrices(): void {
    this.priceSub = this.wsService.stockPrices$.subscribe((socketPrices: any[]) => {
      const currentHoldings = this.holdings();
      if (currentHoldings.length === 0) return;

      const updated = currentHoldings.map(h => {
        const update = socketPrices.find(sp => sp.symbol === h.symbol);
        if (update) {
          const newPrice = update.price;
          const newValue = h.shares * newPrice;
          const cost = h.shares * h.avgBuyPrice;
          const pnl = newValue - cost;
          const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
          return {
            ...h,
            currentPrice: newPrice,
            currentValue: Math.round(newValue * 100) / 100,
            pnl: Math.round(pnl * 100) / 100,
            pnlPercent: Math.round(pnlPercent * 100) / 100,
            dayChangePercent: Math.round(update.changePercent * 100) / 100
          };
        }
        return h;
      });

      this.holdings.set(updated);
    });
  }
}
