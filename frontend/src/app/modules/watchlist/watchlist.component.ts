import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Subject, Subscription, switchMap, debounceTime, distinctUntilChanged, of, tap, catchError } from 'rxjs';
import { WatchlistService } from '../../core/services/watchlist.service';
import { AlpacaService } from '../../core/services/alpaca.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { TradeFormComponent } from '../dashboard/components/trade-form/trade-form.component';

interface PopulatedSymbol {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  flashState?: 'up' | 'down' | null;
}

interface Watchlist {
  _id: string;
  name: string;
  symbols: string[];
  populatedSymbols: PopulatedSymbol[];
}

interface SearchResult {
  symbol: string;
  name: string;
}

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  templateUrl: './watchlist.component.html',
  styleUrl: './watchlist.component.css'
})
export class WatchlistComponent implements OnInit, OnDestroy {
  private watchlistService = inject(WatchlistService);
  private alpacaService = inject(AlpacaService);
  private wsService = inject(WebsocketService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  watchlists = signal<Watchlist[]>([]);
  selectedWatchlist = signal<Watchlist | null>(null);
  loading = signal<boolean>(true);
  
  // Watchlist creation input
  newWatchlistName = signal<string>('');
  showCreateForm = signal<boolean>(false);

  // Symbol search inside active watchlist
  searchTerm = signal<string>('');
  showSearchSuggestions = signal<boolean>(false);
  searchResults = signal<SearchResult[]>([]);
  searchLoading = signal<boolean>(false);

  // Debounced search subject
  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;
  private priceSub!: Subscription;

  // Filtered results excluding already-added symbols
  get filteredSearchResults(): SearchResult[] {
    const activeWl = this.selectedWatchlist();
    const currentSymbols = activeWl ? activeWl.symbols : [];
    return this.searchResults().filter(s => !currentSymbols.includes(s.symbol));
  }

  ngOnInit(): void {
    this.fetchWatchlists();
    this.subscribeToSocketPrices();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    if (this.priceSub) {
      this.priceSub.unsubscribe();
    }
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  private setupSearch(): void {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(query => {
        if (query.trim().length > 0) {
          this.searchLoading.set(true);
        }
      }),
      switchMap(query => {
        const trimmed = query.trim();
        if (trimmed.length === 0) {
          this.searchLoading.set(false);
          return of({ data: [] });
        }
        return this.alpacaService.searchSymbols(trimmed).pipe(
          catchError(() => {
            this.searchLoading.set(false);
            return of({ data: [] });
          })
        );
      })
    ).subscribe((res: any) => {
      this.searchResults.set(res.data || []);
      this.searchLoading.set(false);
    });
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
    this.searchSubject.next(value);
    if (value.trim().length === 0) {
      this.searchResults.set([]);
    }
  }

  fetchWatchlists(selectId?: string): void {
    this.loading.set(true);
    this.watchlistService.getWatchlists().subscribe({
      next: (res: any) => {
        const data = res.data || [];
        this.watchlists.set(data);
        
        if (data.length > 0) {
          const toSelect = selectId 
            ? data.find((w: Watchlist) => w._id === selectId) 
            : data[0];
          this.selectWatchlist(toSelect || data[0]);
        } else {
          this.selectedWatchlist.set(null);
        }
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open('Error loading watchlists.', 'Dismiss', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  selectWatchlist(wl: Watchlist): void {
    this.selectedWatchlist.set(wl);
    this.searchTerm.set('');
    this.searchResults.set([]);
    this.showSearchSuggestions.set(false);
  }

  onCreateWatchlist(): void {
    const name = this.newWatchlistName().trim();
    if (!name) return;

    if (this.watchlists().length >= 5) {
      this.snackBar.open('Limit reached: Maximum of 5 watchlists allowed.', 'Dismiss', { duration: 3000 });
      return;
    }

    this.watchlistService.createWatchlist(name).subscribe({
      next: (res: any) => {
        this.snackBar.open('Watchlist created successfully.', 'Dismiss', { duration: 3000 });
        this.newWatchlistName.set('');
        this.showCreateForm.set(false);
        this.fetchWatchlists(res.data._id);
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Error creating watchlist.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  onDeleteWatchlist(id: string): void {
    if (!confirm('Are you sure you want to delete this watchlist?')) return;

    this.watchlistService.deleteWatchlist(id).subscribe({
      next: () => {
        this.snackBar.open('Watchlist deleted successfully.', 'Dismiss', { duration: 3000 });
        this.fetchWatchlists();
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Error deleting watchlist.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  onAddSymbol(symbol: string): void {
    const activeWl = this.selectedWatchlist();
    if (!activeWl) return;

    if (activeWl.symbols.length >= 50) {
      this.snackBar.open('Limit reached: Maximum of 50 symbols per watchlist.', 'Dismiss', { duration: 3000 });
      return;
    }

    this.watchlistService.addSymbol(activeWl._id, symbol).subscribe({
      next: (res: any) => {
        this.snackBar.open(`${symbol} added to watchlist.`, 'Dismiss', { duration: 2000 });
        this.searchTerm.set('');
        this.searchResults.set([]);
        this.showSearchSuggestions.set(false);
        
        const updated = res.data;
        this.watchlists.set(this.watchlists().map(w => w._id === updated._id ? updated : w));
        this.selectedWatchlist.set(updated);
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Error adding symbol.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  onRemoveSymbol(symbol: string, event: Event): void {
    event.stopPropagation();
    const activeWl = this.selectedWatchlist();
    if (!activeWl) return;

    this.watchlistService.removeSymbol(activeWl._id, symbol).subscribe({
      next: (res: any) => {
        this.snackBar.open(`${symbol} removed from watchlist.`, 'Dismiss', { duration: 2000 });
        
        const updated = res.data;
        this.watchlists.set(this.watchlists().map(w => w._id === updated._id ? updated : w));
        this.selectedWatchlist.set(updated);
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Error removing symbol.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  onBuy(sym: PopulatedSymbol, event: Event): void {
    event.stopPropagation();
    this.openTradeDialog(sym, 'BUY');
  }

  onSell(sym: PopulatedSymbol, event: Event): void {
    event.stopPropagation();
    this.openTradeDialog(sym, 'SELL');
  }

  private openTradeDialog(sym: PopulatedSymbol, action: 'BUY' | 'SELL'): void {
    const dialogRef = this.dialog.open(TradeFormComponent, {
      data: { stock: sym, action: action },
      width: '90vw',
      maxWidth: '480px',
      panelClass: 'trade-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(() => {
      // Balance updates automatically triggered inside TradeFormComponent using AuthService signals
    });
  }

  private subscribeToSocketPrices(): void {
    this.priceSub = this.wsService.stockPrices$.subscribe((socketPrices: any[]) => {
      const activeWl = this.selectedWatchlist();
      if (!activeWl) return;

      let hasChanged = false;
      const updatedSymbols = activeWl.populatedSymbols.map(sym => {
        const update = socketPrices.find(sp => sp.symbol === sym.symbol);
        if (update) {
          const prevPrice = sym.price;
          const newPrice = update.price;
          
          let flashState: 'up' | 'down' | null = null;
          if (newPrice > prevPrice) {
            flashState = 'up';
          } else if (newPrice < prevPrice) {
            flashState = 'down';
          }

          if (flashState) {
            setTimeout(() => {
              this.clearFlashState(sym.symbol);
            }, 1000);
          }

          hasChanged = true;
          return {
            ...sym,
            price: newPrice,
            change: update.change,
            changePercent: update.changePercent,
            flashState: flashState
          };
        }
        return sym;
      });

      if (hasChanged) {
        this.selectedWatchlist.set({
          ...activeWl,
          populatedSymbols: updatedSymbols
        });

        this.watchlists.set(this.watchlists().map(w => {
          if (w._id === activeWl._id) {
            return {
              ...w,
              populatedSymbols: updatedSymbols
            };
          }
          return w;
        }));
      }
    });
  }

  private clearFlashState(symbol: string): void {
    const activeWl = this.selectedWatchlist();
    if (!activeWl) return;

    const clearedSymbols = activeWl.populatedSymbols.map(s => {
      if (s.symbol === symbol) {
        return { ...s, flashState: null };
      }
      return s;
    });

    this.selectedWatchlist.set({
      ...activeWl,
      populatedSymbols: clearedSymbols
    });
  }
}
