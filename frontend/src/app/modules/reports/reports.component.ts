import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Chart } from 'chart.js/auto';
import { TradeService } from '../../core/services/trade.service';
import { StockService } from '../../core/services/stock.service';
import { PortfolioService } from '../../core/services/portfolio.service';

interface ClosedTrade {
  id: string;
  symbol: string;
  shares: number;
  buyPrice: number;
  sellPrice: number;
  buyDate: Date;
  sellDate: Date;
  pnl: number;
  tax: number;
  fee: number;
}

interface YearReport {
  year: number;
  pnl: number;
  volume: number;
  tax: number;
  tradesCount: number;
  winRate: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css'
})
export class ReportsComponent implements OnInit, OnDestroy, AfterViewInit {
  private tradeService = inject(TradeService);
  private stockService = inject(StockService);
  private portfolioService = inject(PortfolioService);
  private snackBar = inject(MatSnackBar);

  loading = signal<boolean>(true);
  
  // Date states
  datePreset = signal<'all' | '30days' | '90days' | 'thisyear'>('all');
  startDate: string = '';
  endDate: string = '';

  // Core reporting datasets
  private allTransactions: any[] = [];
  private allClosedTrades: ClosedTrade[] = [];
  
  // Computed output signals
  filteredTrades = signal<ClosedTrade[]>([]);
  realizedPnl = signal<number>(0);
  unrealizedPnl = signal<number>(0);
  winRate = signal<number>(0);
  winningTradesCount = signal<number>(0);
  totalClosedTradesCount = signal<number>(0);
  totalTaxesAndFees = signal<number>(0);
  
  // Annualized data
  yearlySummaries = signal<YearReport[]>([]);

  // Chart instances
  @ViewChild('yearlyChartCanvas') yearlyChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('winlossChartCanvas') winlossChartCanvas!: ElementRef<HTMLCanvasElement>;
  
  private yearlyChart: Chart | null = null;
  private winlossChart: Chart | null = null;

  ngOnInit(): void {
    this.setPreset('all', false); // Start by pulling all records
    this.fetchData();
  }

  ngAfterViewInit(): void {
    // Render charts on demand after data finishes loading
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private destroyCharts(): void {
    if (this.yearlyChart) this.yearlyChart.destroy();
    if (this.winlossChart) this.winlossChart.destroy();
  }

  setPreset(preset: 'all' | '30days' | '90days' | 'thisyear', triggerRecalc = true): void {
    this.datePreset.set(preset);
    
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    let start: Date | null = null;
    
    if (preset === '30days') {
      start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (preset === '90days') {
      start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (preset === 'thisyear') {
      start = new Date(today.getFullYear(), 0, 1);
    }

    this.startDate = start ? start.toISOString().substring(0, 10) : '';
    this.endDate = end.toISOString().substring(0, 10);

    if (triggerRecalc) {
      this.recalculateReport();
    }
  }

  onCustomDateChange(): void {
    this.datePreset.set('all'); // Clear quick presets when user modifies custom inputs
    this.recalculateReport();
  }

  private fetchData(): void {
    this.loading.set(true);
    // Fetch transaction history
    this.tradeService.getTransactionHistory().subscribe({
      next: (res: any) => {
        this.allTransactions = res.data || [];
        this.runFIFOAndCalculate();
      },
      error: () => {
        this.snackBar.open('Error loading transaction history.', 'Dismiss', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  private runFIFOAndCalculate(): void {
    // 1. Process FIFO queue for all paired closed trades
    this.matchTradesFIFO();

    // 2. Fetch current prices for active holdings (unrealized calculations)
    this.stockService.getStocks().subscribe({
      next: (res: any) => {
        const stocks = res.data || [];
        const currentPrices: Record<string, number> = {};
        stocks.forEach((s: any) => {
          currentPrices[s.symbol] = s.price;
        });

        this.calculateUnrealized(currentPrices);
        this.recalculateReport();
        this.loading.set(false);
      },
      error: () => {
        console.warn('Error fetching live stock prices for reports. Unrealized P&L may be incomplete.');
        this.calculateUnrealized({});
        this.recalculateReport();
        this.loading.set(false);
      }
    });
  }

  private matchTradesFIFO(): void {
    // Filter COMPLETED transactions and sort chronologically (oldest first)
    const txns = this.allTransactions
      .filter(t => t.status === 'COMPLETED')
      .sort((a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime());

    const buyQueues: Record<string, Array<{ shares: number; price: number; date: Date }>> = {};
    const closed: ClosedTrade[] = [];

    txns.forEach(txn => {
      const symbol = txn.symbol.toUpperCase();
      const type = txn.type;
      const shares = txn.shares;
      const price = txn.price;
      const date = new Date(txn.timestamp || txn.createdAt);

      if (type === 'BUY') {
        if (!buyQueues[symbol]) buyQueues[symbol] = [];
        buyQueues[symbol].push({ shares, price, date });
      } else if (type === 'SELL') {
        let remainingSellShares = shares;
        const queue = buyQueues[symbol] || [];

        while (remainingSellShares > 0 && queue.length > 0) {
          const buyChunk = queue[0];
          
          if (buyChunk.shares <= remainingSellShares) {
            // Sell chunk completely satisfies this buy chunk
            const matchedShares = buyChunk.shares;
            const pnl = matchedShares * (price - buyChunk.price);
            const tax = pnl > 0 ? pnl * 0.15 : 0; // 15% Capital Gains Tax on profits
            const fee = matchedShares * price * 0.00002; // 0.002% SEC-simulated transaction fee

            closed.push({
              id: txn._id + '-' + Math.random().toString(36).substring(2, 6),
              symbol: symbol,
              shares: matchedShares,
              buyPrice: buyChunk.price,
              sellPrice: price,
              buyDate: buyChunk.date,
              sellDate: date,
              pnl: Math.round(pnl * 100) / 100,
              tax: Math.round(tax * 100) / 100,
              fee: Math.round(fee * 100) / 100
            });

            remainingSellShares -= matchedShares;
            queue.shift(); // Remove completed buy chunk
          } else {
            // Sell chunk only partially matches this buy chunk
            const matchedShares = remainingSellShares;
            const pnl = matchedShares * (price - buyChunk.price);
            const tax = pnl > 0 ? pnl * 0.15 : 0;
            const fee = matchedShares * price * 0.00002;

            closed.push({
              id: txn._id + '-' + Math.random().toString(36).substring(2, 6),
              symbol: symbol,
              shares: matchedShares,
              buyPrice: buyChunk.price,
              sellPrice: price,
              buyDate: buyChunk.date,
              sellDate: date,
              pnl: Math.round(pnl * 100) / 100,
              tax: Math.round(tax * 100) / 100,
              fee: Math.round(fee * 100) / 100
            });

            buyChunk.shares -= matchedShares; // Decrement matched shares in queue
            remainingSellShares = 0;
          }
        }
      }
    });

    this.allClosedTrades = closed;
  }

  private calculateUnrealized(currentPrices: Record<string, number>): void {
    // Recalculate remaining shares in buyQueues to compute floating unrealized P&L
    const buyQueues: Record<string, Array<{ shares: number; price: number; date: Date }>> = {};

    const txns = this.allTransactions
      .filter(t => t.status === 'COMPLETED')
      .sort((a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime());

    // Replay queue
    txns.forEach(txn => {
      const symbol = txn.symbol.toUpperCase();
      const type = txn.type;
      const shares = txn.shares;
      const price = txn.price;
      const date = new Date(txn.timestamp || txn.createdAt);

      if (type === 'BUY') {
        if (!buyQueues[symbol]) buyQueues[symbol] = [];
        buyQueues[symbol].push({ shares, price, date });
      } else if (type === 'SELL') {
        let remainingSellShares = shares;
        const queue = buyQueues[symbol] || [];
        while (remainingSellShares > 0 && queue.length > 0) {
          const buyChunk = queue[0];
          if (buyChunk.shares <= remainingSellShares) {
            remainingSellShares -= buyChunk.shares;
            queue.shift();
          } else {
            buyChunk.shares -= remainingSellShares;
            remainingSellShares = 0;
          }
        }
      }
    });

    // Sum unrealized values
    let totalUnrealizedPnl = 0;
    Object.keys(buyQueues).forEach(symbol => {
      const queue = buyQueues[symbol];
      const currentPrice = currentPrices[symbol] || 0;
      if (currentPrice === 0) return; // Skip if stock price not seeded/found

      queue.forEach(chunk => {
        if (chunk.shares > 0) {
          totalUnrealizedPnl += chunk.shares * (currentPrice - chunk.price);
        }
      });
    });

    this.unrealizedPnl.set(Math.round(totalUnrealizedPnl * 100) / 100);
  }

  private recalculateReport(): void {
    const start = this.startDate ? new Date(this.startDate) : null;
    // Set custom end date boundary to 23:59:59 to cover whole day
    const end = this.endDate ? new Date(new Date(this.endDate).setHours(23, 59, 59, 999)) : null;

    // Filter closed trades based on Sell Date
    const filtered = this.allClosedTrades.filter(t => {
      const sellDate = new Date(t.sellDate);
      if (start && sellDate < start) return false;
      if (end && sellDate > end) return false;
      return true;
    });

    // Order filtered ledger chronologically by sellDate descending (newest first)
    this.filteredTrades.set([...filtered].sort((a,b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()));

    // 1. Sum basic metrics
    let realizedPnlSum = 0;
    let taxSum = 0;
    let feeSum = 0;
    let winningCount = 0;

    filtered.forEach(t => {
      realizedPnlSum += t.pnl;
      taxSum += t.tax;
      feeSum += t.fee;
      if (t.pnl > 0) {
        winningCount++;
      }
    });

    this.realizedPnl.set(Math.round(realizedPnlSum * 100) / 100);
    this.totalClosedTradesCount.set(filtered.length);
    this.winningTradesCount.set(winningCount);
    
    const calculatedWinRate = filtered.length > 0 ? (winningCount / filtered.length) * 100 : 0;
    this.winRate.set(calculatedWinRate);
    this.totalTaxesAndFees.set(Math.round((taxSum + feeSum) * 100) / 100);

    // 2. Compute Annualized grouping
    const yearGroups: Record<number, { pnl: number; volume: number; tax: number; total: number; wins: number }> = {};
    
    filtered.forEach(t => {
      const yr = new Date(t.sellDate).getFullYear();
      if (!yearGroups[yr]) {
        yearGroups[yr] = { pnl: 0, volume: 0, tax: 0, total: 0, wins: 0 };
      }
      yearGroups[yr].pnl += t.pnl;
      yearGroups[yr].volume += (t.shares * t.sellPrice);
      yearGroups[yr].tax += t.tax + t.fee;
      yearGroups[yr].total++;
      if (t.pnl > 0) {
        yearGroups[yr].wins++;
      }
    });

    const yearlyReportArray: YearReport[] = Object.keys(yearGroups).map(yrKey => {
      const yr = parseInt(yrKey);
      const val = yearGroups[yr];
      return {
        year: yr,
        pnl: Math.round(val.pnl * 100) / 100,
        volume: Math.round(val.volume * 100) / 100,
        tax: Math.round(val.tax * 100) / 100,
        tradesCount: val.total,
        winRate: val.total > 0 ? (val.wins / val.total) * 100 : 0
      };
    }).sort((a,b) => b.year - a.year); // Show newest year first in list

    this.yearlySummaries.set(yearlyReportArray);

    // 3. Render charts
    setTimeout(() => {
      this.initCharts(yearlyReportArray, winningCount, filtered.length - winningCount);
    }, 100);
  }

  private initCharts(annualData: YearReport[], wins: number, losses: number): void {
    this.destroyCharts();

    // 1. Year by Year Realized P&L Bar Chart
    if (this.yearlyChartCanvas) {
      const ctx = this.yearlyChartCanvas.nativeElement.getContext('2d');
      if (ctx) {
        // Sort ascending for chart chronological display (left-to-right)
        const chartData = [...annualData].sort((a,b) => a.year - b.year);
        const years = chartData.map(d => d.year.toString());
        const pnls = chartData.map(d => d.pnl);
        
        // Dynamic bar color based on profit/loss
        const backgroundColors = pnls.map(val => val >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)');
        const borderColors = pnls.map(val => val >= 0 ? '#10b981' : '#ef4444');

        this.yearlyChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: years.length > 0 ? years : [new Date().getFullYear().toString()],
            datasets: [{
              label: 'Realized P&L ($)',
              data: pnls.length > 0 ? pnls : [0],
              backgroundColor: backgroundColors.length > 0 ? backgroundColors : ['rgba(16, 185, 129, 0.7)'],
              borderColor: borderColors.length > 0 ? borderColors : ['#10b981'],
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                grid: { color: '#f1f5f9' },
                ticks: {
                  font: { size: 10 },
                  callback: (value) => `$${Number(value).toLocaleString()}`
                }
              },
              x: { grid: { display: false } }
            }
          }
        });
      }
    }

    // 2. Win/Loss Ratio Pie Chart
    if (this.winlossChartCanvas) {
      const ctx = this.winlossChartCanvas.nativeElement.getContext('2d');
      if (ctx) {
        const hasTrades = (wins + losses) > 0;
        const dataValues = hasTrades ? [wins, losses] : [0, 1]; // Draw gray if no trades
        const backgroundColors = hasTrades ? ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'] : ['#e2e8f0', '#cbd5e1'];
        const labels = hasTrades ? ['Profitable Sells (Wins)', 'Unprofitable Sells (Losses)'] : ['No Closed Positions', ''];

        this.winlossChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: dataValues,
              backgroundColor: backgroundColors,
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 12, font: { size: 10 } }
              }
            },
            cutout: '65%'
          }
        });
      }
    }
  }
}
