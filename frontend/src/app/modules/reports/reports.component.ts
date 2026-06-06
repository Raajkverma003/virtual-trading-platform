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
  template: `
    <div class="reports-container animate-fade-in">
      <div class="header-row">
        <h2>Tax & Performance Reports</h2>
        
        <!-- Filter Bar -->
        <div class="filter-bar">
          <div class="preset-group">
            <button mat-button class="preset-btn" [class.active]="datePreset() === '30days'" (click)="setPreset('30days')">30 Days</button>
            <button mat-button class="preset-btn" [class.active]="datePreset() === '90days'" (click)="setPreset('90days')">90 Days</button>
            <button mat-button class="preset-btn" [class.active]="datePreset() === 'thisyear'" (click)="setPreset('thisyear')">This Year</button>
            <button mat-button class="preset-btn" [class.active]="datePreset() === 'all'" (click)="setPreset('all')">All Time</button>
          </div>
          
          <div class="custom-dates">
            <input type="date" [(ngModel)]="startDate" (change)="onCustomDateChange()" aria-label="Start date" />
            <span>to</span>
            <input type="date" [(ngModel)]="endDate" (change)="onCustomDateChange()" aria-label="End date" />
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner-container">
          <mat-spinner diameter="50"></mat-spinner>
        </div>
      } @else {
        <!-- Metric Cards Grid -->
        <div class="kpi-grid">
          <mat-card class="kpi-card glass-card">
            <div class="kpi-icon-wrapper" [ngClass]="realizedPnl() >= 0 ? 'bg-green-tint' : 'bg-red-tint'">
              <mat-icon [ngClass]="realizedPnl() >= 0 ? 'text-green' : 'text-red'">monetization_on</mat-icon>
            </div>
            <div class="kpi-details">
              <span class="kpi-lbl">Realized P&L</span>
              <h3 [ngClass]="realizedPnl() >= 0 ? 'green-text' : 'red-text'">
                {{ realizedPnl() >= 0 ? '+' : '' }}{{ realizedPnl() | currency:'USD':'symbol':'1.2-2' }}
              </h3>
              <span class="sub-desc">Profit from closed positions</span>
            </div>
          </mat-card>

          <mat-card class="kpi-card glass-card">
            <div class="kpi-icon-wrapper" [ngClass]="unrealizedPnl() >= 0 ? 'bg-blue-tint' : 'bg-orange-tint'">
              <mat-icon [ngClass]="unrealizedPnl() >= 0 ? 'text-blue' : 'text-orange'">bubble_chart</mat-icon>
            </div>
            <div class="kpi-details">
              <span class="kpi-lbl">Unrealized P&L</span>
              <h3 [ngClass]="unrealizedPnl() >= 0 ? 'green-text' : 'red-text'">
                {{ unrealizedPnl() >= 0 ? '+' : '' }}{{ unrealizedPnl() | currency:'USD':'symbol':'1.2-2' }}
              </h3>
              <span class="sub-desc">Floating valuation profit</span>
            </div>
          </mat-card>

          <mat-card class="kpi-card glass-card">
            <div class="kpi-icon-wrapper bg-indigo-tint">
              <mat-icon class="text-indigo">emoji_events</mat-icon>
            </div>
            <div class="kpi-details">
              <span class="kpi-lbl">Probability of Winning</span>
              <h3 class="text-indigo">{{ winRate() | number:'1.1-1' }}%</h3>
              <span class="sub-desc">{{ winningTradesCount() }} of {{ totalClosedTradesCount() }} sells profitable</span>
            </div>
          </mat-card>

          <mat-card class="kpi-card glass-card">
            <div class="kpi-icon-wrapper bg-purple-tint">
              <mat-icon class="text-purple">receipt_long</mat-icon>
            </div>
            <div class="kpi-details">
              <span class="kpi-lbl">Est. Tax & Charges</span>
              <h3 class="text-purple">{{ totalTaxesAndFees() | currency:'USD':'symbol':'1.2-2' }}</h3>
              <span class="sub-desc">15% CapGains tax + SEC fee</span>
            </div>
          </mat-card>
        </div>

        <!-- Charts Section -->
        <div class="charts-row">
          <mat-card class="chart-card glass-card yearly-chart-card">
            <mat-card-header>
              <mat-card-title>Year-by-Year Performance</mat-card-title>
              <mat-card-subtitle>Annualized Net Realized Profit/Loss</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-wrapper">
              <canvas #yearlyChartCanvas></canvas>
            </mat-card-content>
          </mat-card>

          <mat-card class="chart-card glass-card winloss-chart-card">
            <mat-card-header>
              <mat-card-title>Win/Loss Ratio</mat-card-title>
              <mat-card-subtitle>Proportion of winning trade blocks</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-wrapper">
              <canvas #winlossChartCanvas></canvas>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Year by Year Summary Table -->
        <div class="reports-section table-section">
          <div class="section-title">
            <h3>Yearly Summary Report</h3>
          </div>
          <div class="table-container">
            <table class="reports-table">
              <thead>
                <tr>
                  <th>Calendar Year</th>
                  <th class="text-right">Realized P&L</th>
                  <th class="text-right">Trading Volume</th>
                  <th class="text-right">Est. Tax Paid</th>
                  <th class="text-right">Closed Trades</th>
                  <th class="text-right">Win Probability</th>
                </tr>
              </thead>
              <tbody>
                @if (yearlySummaries().length === 0) {
                  <tr>
                    <td colspan="6" class="text-center no-data">No annualized records to display.</td>
                  </tr>
                } @else {
                  @for (yr of yearlySummaries(); track yr.year) {
                    <tr>
                      <td class="font-bold">{{ yr.year }}</td>
                      <td class="text-right font-bold" [ngClass]="yr.pnl >= 0 ? 'green-text' : 'red-text'">
                        {{ yr.pnl >= 0 ? '+' : '' }}{{ yr.pnl | currency:'USD':'symbol':'1.2-2' }}
                      </td>
                      <td class="text-right">{{ yr.volume | currency:'USD':'symbol':'1.2-2' }}</td>
                      <td class="text-right text-purple font-medium">{{ yr.tax | currency:'USD':'symbol':'1.2-2' }}</td>
                      <td class="text-right">{{ yr.tradesCount }}</td>
                      <td class="text-right font-medium text-slate">{{ yr.winRate | number:'1.1-1' }}%</td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Detailed Closed Trades Ledger -->
        <div class="reports-section table-section">
          <div class="section-title">
            <h3>Completed Trade Ledger (FIFO Matched Sells)</h3>
          </div>
          <div class="table-container">
            <table class="reports-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Buy Date</th>
                  <th>Sell Date</th>
                  <th class="text-right">Shares</th>
                  <th class="text-right">Cost Price</th>
                  <th class="text-right">Sale Price</th>
                  <th class="text-right">CapGains Tax</th>
                  <th class="text-right">Net Realized P&L</th>
                  <th class="text-center">Outcome</th>
                </tr>
              </thead>
              <tbody>
                @if (filteredTrades().length === 0) {
                  <tr>
                    <td colspan="9" class="text-center no-data">No closed matched transactions within selected date range.</td>
                  </tr>
                } @else {
                  @for (trade of filteredTrades(); track trade.id) {
                    <tr>
                      <td class="font-bold">{{ trade.symbol }}</td>
                      <td class="date-col">{{ trade.buyDate | date:'shortDate' }}</td>
                      <td class="date-col">{{ trade.sellDate | date:'shortDate' }}</td>
                      <td class="text-right">{{ trade.shares }}</td>
                      <td class="text-right">{{ trade.buyPrice | currency:'USD':'symbol':'1.2-2' }}</td>
                      <td class="text-right">{{ trade.sellPrice | currency:'USD':'symbol':'1.2-2' }}</td>
                      <td class="text-right text-purple">{{ trade.tax | currency:'USD':'symbol':'1.2-2' }}</td>
                      <td class="text-right font-bold" [ngClass]="trade.pnl >= 0 ? 'green-text' : 'red-text'">
                        {{ trade.pnl >= 0 ? '+' : '' }}{{ trade.pnl | currency:'USD':'symbol':'1.2-2' }}
                      </td>
                      <td class="text-center">
                        <span class="outcome-badge" [ngClass]="trade.pnl >= 0 ? 'win' : 'loss'">
                          {{ trade.pnl >= 0 ? 'WIN' : 'LOSS' }}
                        </span>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .reports-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      box-sizing: border-box;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      border-bottom: 1px solid #edf2f7;
      padding-bottom: 16px;
    }

    .header-row h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
    }

    .filter-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .preset-group {
      display: flex;
      background-color: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      height: 38px;
    }

    .preset-btn {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      border-radius: 0;
      padding: 0 16px;
      height: 100%;
    }

    .preset-btn.active {
      background-color: #fff3f0;
      color: #ff5722 !important;
    }

    .custom-dates {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0 12px;
      height: 36px;
    }

    .custom-dates input[type="date"] {
      border: none;
      outline: none;
      font-family: inherit;
      font-size: 13px;
      color: #334155;
      cursor: pointer;
    }

    .custom-dates span {
      font-size: 12px;
      color: #94a3b8;
    }

    .spinner-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 300px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .kpi-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.01);
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 16px;
    }

    .kpi-icon-wrapper {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .kpi-icon-wrapper mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .bg-green-tint { background-color: #ecfdf5; }
    .text-green { color: #10b981; }

    .bg-red-tint { background-color: #fef2f2; }
    .text-red { color: #ef4444; }

    .bg-blue-tint { background-color: #eff6ff; }
    .text-blue { color: #3b82f6; }

    .bg-orange-tint { background-color: #fff7ed; }
    .text-orange { color: #f97316; }

    .bg-indigo-tint { background-color: #eef2ff; }
    .text-indigo { color: #6366f1; }

    .bg-purple-tint { background-color: #faf5ff; }
    .text-purple { color: #a855f7; }

    .kpi-details {
      display: flex;
      flex-direction: column;
    }

    .kpi-lbl {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
      margin-bottom: 2px;
    }

    .kpi-details h3 {
      font-size: 19px;
      font-weight: 800;
      margin: 0;
      color: #0f172a;
    }

    .sub-desc {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 2px;
    }

    .green-text { color: #10b981 !important; }
    .red-text { color: #ef4444 !important; }

    .charts-row {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 24px;
    }

    .chart-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: white;
      padding: 20px;
    }

    mat-card-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }

    mat-card-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }

    .chart-wrapper {
      margin-top: 16px;
      position: relative;
      height: 250px;
    }

    .reports-section {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
    }

    .section-title {
      border-bottom: 1px solid #edf2f7;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .section-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }

    .table-container {
      overflow-x: auto;
    }

    .reports-table {
      width: 100%;
      border-collapse: collapse;
    }

    .reports-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      padding: 12px 16px;
      border-bottom: 2px solid #f1f5f9;
      letter-spacing: 0.5px;
    }

    .reports-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
      color: #475569;
    }

    .no-data {
      padding: 30px;
      color: #94a3b8;
      font-style: italic;
    }

    .outcome-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 700;
      border-radius: 4px;
    }

    .outcome-badge.win {
      background-color: #ecfdf5;
      color: #10b981;
    }

    .outcome-badge.loss {
      background-color: #fef2f2;
      color: #ef4444;
    }

    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .font-bold { font-weight: 700; }
    .font-medium { font-weight: 500; }
    .text-slate { color: #1e293b; }
    .date-col { font-size: 13px; color: #64748b; }

    @media (max-width: 1100px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .charts-row { grid-template-columns: 1fr; }
    }

    @media (max-width: 640px) {
      .kpi-grid { grid-template-columns: 1fr; }
      .header-row { flex-direction: column; align-items: flex-start; }
    }
  `]
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
