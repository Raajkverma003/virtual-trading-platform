import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Chart } from 'chart.js/auto';
import { PortfolioService } from '../../core/services/portfolio.service';
import { AuthService } from '../../core/services/auth.service';

interface HoldingItem {
  symbol: string;
  shares: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

interface PortfolioSummary {
  cash: number;
  totalHoldingsValue: number;
  netWorth: number;
  totalPnl: number;
  totalPnlPercent: number;
  holdings: HoldingItem[];
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.css'
})
export class PortfolioComponent implements OnInit, OnDestroy, AfterViewInit {
  private portfolioService = inject(PortfolioService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  summary = signal<PortfolioSummary | null>(null);
  loadingPortfolio = signal<boolean>(true);
  
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;
  private historyData: any[] = [];

  ngOnInit(): void {
    this.fetchPortfolio();
  }

  ngAfterViewInit(): void {
    // Canvas might not exist if loading, we render it after data arrives
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  private fetchPortfolio(): void {
    this.portfolioService.getPortfolio().subscribe({
      next: (res: any) => {
        this.summary.set(res.data);
        this.fetchHistoryAndPlot();
        this.loadingPortfolio.set(false);
      },
      error: () => {
        this.snackBar.open('Error loading portfolio stats.', 'Dismiss', { duration: 3000 });
        this.loadingPortfolio.set(false);
      }
    });
  }

  private fetchHistoryAndPlot(): void {
    this.portfolioService.getPortfolioHistory().subscribe({
      next: (res: any) => {
        this.historyData = res.data || [];
        setTimeout(() => {
          this.initChart();
        }, 100);
      },
      error: () => {
        console.warn('Error loading history chart logs.');
        setTimeout(() => {
          this.initChart();
        }, 100);
      }
    });
  }

  private initChart(): void {
    if (!this.chartCanvas) return;
    
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    let labels: string[] = [];
    let dataPoints: number[] = [];

    // Fallback if history is empty
    if (this.historyData.length === 0) {
      const currentNetWorth = this.summary()?.netWorth || 100000;
      // Synthesize a flat line or single step
      labels = ['Initial Base', 'Current'];
      dataPoints = [100000, currentNetWorth];
    } else {
      labels = this.historyData.map((item, idx) => {
        if (item.timestamp) {
          const date = new Date(item.timestamp);
          return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return `Log #${idx + 1}`;
      });
      dataPoints = this.historyData.map(item => item.netWorth);
    }

    // Chart design setup
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Net Worth ($)',
          data: dataPoints,
          borderColor: '#ff5722', // Theme Accent color
          backgroundColor: 'rgba(255, 87, 34, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointBackgroundColor: '#ff5722',
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let value = context.parsed.y ?? 0;
                return `Net Worth: $${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { size: 10 },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: {
              color: '#f1f5f9'
            },
            ticks: {
              font: { size: 10 },
              callback: (value) => `$${Number(value).toLocaleString()}`
            }
          }
        }
      }
    });
  }
}
