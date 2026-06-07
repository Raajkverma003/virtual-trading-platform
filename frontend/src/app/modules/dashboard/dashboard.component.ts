import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { StockMetricsWidgetComponent } from './components/stock-metrics-widget/stock-metrics-widget.component';
import { TradeFormComponent } from './components/trade-form/trade-form.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { StockService } from '../../core/services/stock.service';
import { AuthService } from '../../core/services/auth.service';
import { WebsocketService } from '../../core/services/websocket.service';

interface StockData {
  _id?: string;
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  flashState?: 'up' | 'down' | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    StockMetricsWidgetComponent,
    TradeFormComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private stockService = inject(StockService);
  private snackBar = inject(MatSnackBar);
  
  authService = inject(AuthService);
  wsService = inject(WebsocketService);
  private route = inject(ActivatedRoute);

  stocks = signal<StockData[]>([]);
  selectedStock = signal<StockData | null>(null);
  loadingStocks = signal<boolean>(true);
  tradeType = signal<'BUY' | 'SELL'>('BUY');
  mostBought = signal<any[]>([]);

  // Computed signals for real-time top 5 gainers and losers
  gainers = computed(() => {
    return [...this.stocks()]
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 5);
  });

  losers = computed(() => {
    return [...this.stocks()]
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 5);
  });

  private priceSub!: Subscription;

  ngOnInit(): void {
    this.fetchStocks();
    this.subscribeToSocketPrices();
    this.fetchMostBought();
  }

  ngOnDestroy(): void {
    if (this.priceSub) {
      this.priceSub.unsubscribe();
    }
  }

  private fetchStocks(): void {
    this.stockService.getStocks().subscribe({
      next: (res: any) => {
        this.stocks.set(res.data || []);
        this.loadingStocks.set(false);
        
        // Read query parameters to automatically select stock and action
        const symbolParam = this.route.snapshot.queryParamMap.get('symbol');
        const actionParam = this.route.snapshot.queryParamMap.get('action');
        
        if (symbolParam) {
          const matched = this.stocks().find(s => s.symbol.toUpperCase() === symbolParam.toUpperCase());
          if (matched) {
            this.selectStock(matched);
            if (actionParam === 'BUY' || actionParam === 'SELL') {
              this.setTradeType(actionParam);
            }
            return;
          }
        }

        // Default to first stock if any exists
        if (this.stocks().length > 0) {
          this.selectStock(this.stocks()[0]);
        }
      },
      error: () => {
        this.snackBar.open('Error loading stock list.', 'Dismiss', { duration: 3000 });
        this.loadingStocks.set(false);
      }
    });
  }

  private subscribeToSocketPrices(): void {
    this.priceSub = this.wsService.stockPrices$.subscribe((socketPrices: any[]) => {
      const currentStocks = this.stocks();
      const updatedStocks = currentStocks.map(stock => {
        const matchingUpdate = socketPrices.find(sp => sp.symbol === stock.symbol);
        if (matchingUpdate) {
          const prevPrice = stock.price;
          const newPrice = matchingUpdate.price;
          
          let flashState: 'up' | 'down' | null = null;
          if (newPrice > prevPrice) {
            flashState = 'up';
          } else if (newPrice < prevPrice) {
            flashState = 'down';
          }

          // Clear flash state after 1 sec
          setTimeout(() => {
            this.clearFlashState(stock.symbol);
          }, 1000);

          return {
            ...stock,
            price: newPrice,
            change: matchingUpdate.change,
            changePercent: matchingUpdate.changePercent,
            flashState: flashState
          };
        }
        return stock;
      });

      this.stocks.set(updatedStocks);

      // Keep selectedStock in sync with live updates
      const selected = this.selectedStock();
      if (selected) {
        const updatedSelected = updatedStocks.find(s => s.symbol === selected.symbol);
        if (updatedSelected) {
          this.selectedStock.set(updatedSelected);
        }
      }

      // Keep mostBought in sync with live updates
      const currentMostBought = this.mostBought();
      if (currentMostBought.length > 0) {
        const updatedMostBought = currentMostBought.map(stock => {
          const matchingUpdate = socketPrices.find(sp => sp.symbol === stock.symbol);
          if (matchingUpdate) {
            return {
              ...stock,
              price: matchingUpdate.price,
              change: matchingUpdate.change,
              changePercent: matchingUpdate.changePercent
            };
          }
          return stock;
        });
        this.mostBought.set(updatedMostBought);
      }
    });
  }

  private fetchMostBought(): void {
    this.stockService.getMostBoughtStocks().subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.mostBought.set(res.data);
        }
      },
      error: (err) => {
        console.error('Error fetching most bought stocks:', err);
      }
    });
  }

  selectFromWidget(symbol: string): void {
    const matched = this.stocks().find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
    if (matched) {
      this.selectStock(matched);
    }
  }

  private clearFlashState(symbol: string): void {
    const updated = this.stocks().map(stock => {
      if (stock.symbol === symbol) {
        return { ...stock, flashState: null };
      }
      return stock;
    });
    this.stocks.set(updated);
  }

  selectStock(stock: StockData): void {
    this.selectedStock.set(stock);
  }

  setTradeType(type: 'BUY' | 'SELL'): void {
    this.tradeType.set(type);
  }
}
