import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { StockMetricsWidgetComponent } from './components/stock-metrics-widget/stock-metrics-widget.component';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { StockService } from '../../core/services/stock.service';
import { TradeService } from '../../core/services/trade.service';
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
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    StockMetricsWidgetComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private stockService = inject(StockService);
  private tradeService = inject(TradeService);
  private snackBar = inject(MatSnackBar);
  
  authService = inject(AuthService);
  wsService = inject(WebsocketService);
  private route = inject(ActivatedRoute);

  stocks = signal<StockData[]>([]);
  selectedStock = signal<StockData | null>(null);
  loadingStocks = signal<boolean>(true);
  loadingTrade = signal<boolean>(false);
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
  tradeForm!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.fetchStocks();
    this.subscribeToSocketPrices();
    this.fetchMostBought();
  }

  ngOnDestroy(): void {
    if (this.priceSub) {
      this.priceSub.unsubscribe();
    }
  }

  private initForm(): void {
    this.tradeForm = this.fb.group({
      orderType: ['MARKET', Validators.required],
      shares: [null, [Validators.required, Validators.min(1)]],
      limitPrice: [null]
    });

    // Toggle limitPrice validators based on orderType
    this.tradeForm.get('orderType')?.valueChanges.subscribe(type => {
      const limitPriceCtrl = this.tradeForm.get('limitPrice');
      if (type === 'LIMIT') {
        limitPriceCtrl?.setValidators([Validators.required, Validators.min(0.01)]);
      } else {
        limitPriceCtrl?.clearValidators();
      }
      limitPriceCtrl?.updateValueAndValidity();
    });
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
    // Reset shares form inputs when selected stock changes
    this.tradeForm.get('shares')?.reset();
    this.tradeForm.get('limitPrice')?.reset();
  }

  setTradeType(type: 'BUY' | 'SELL'): void {
    this.tradeType.set(type);
  }

  estimatedCost(): number {
    const shares = this.tradeForm.get('shares')?.value || 0;
    const isLimit = this.tradeForm.get('orderType')?.value === 'LIMIT';
    const price = isLimit 
      ? this.tradeForm.get('limitPrice')?.value || 0
      : this.selectedStock()?.price || 0;
    return shares * price;
  }

  isOverdrawn(): boolean {
    if (this.tradeType() === 'SELL') return false;
    const user = this.authService.currentUser();
    const balance = user ? user.balance : 0;
    return this.estimatedCost() > balance;
  }

  submitOrder(): void {
    if (this.tradeForm.invalid) return;
    const selected = this.selectedStock();
    if (!selected) return;

    this.loadingTrade.set(true);
    const formValue = this.tradeForm.value;

    const payload = {
      symbol: selected.symbol,
      type: this.tradeType(),
      orderType: formValue.orderType,
      shares: formValue.shares,
      limitPrice: formValue.orderType === 'LIMIT' ? formValue.limitPrice : undefined
    };

    this.tradeService.placeOrder(payload).subscribe({
      next: (res: any) => {
        this.loadingTrade.set(false);
        this.snackBar.open(res.message || 'Order submitted successfully!', 'Dismiss', {
          duration: 4000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });

        // Update the current user balance from response
        const currentUser = this.authService.currentUser();
        if (currentUser && res.balance !== undefined) {
          this.authService.currentUser.set({
            ...currentUser,
            balance: res.balance
          });
        } else if (currentUser && res.data && res.data.balance !== undefined) {
          // Fallback if balance is inside data object
          this.authService.currentUser.set({
            ...currentUser,
            balance: res.data.balance
          });
        }

        // Reset the input fields
        this.tradeForm.get('shares')?.reset();
        this.tradeForm.get('limitPrice')?.reset();
      },
      error: (err) => {
        this.loadingTrade.set(false);
        this.snackBar.open(err.error?.message || 'Error placing order.', 'Dismiss', {
          duration: 4000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }
}
