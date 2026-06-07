import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

declare const TradingView: any;

@Component({
  selector: 'app-chart-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  templateUrl: './chart-dialog.component.html',
  styleUrl: './chart-dialog.component.css'
})
export class ChartDialogComponent implements OnInit, AfterViewInit {
  dialogRef = inject(MatDialogRef<ChartDialogComponent>);
  data = inject<{ symbol: string }>(MAT_DIALOG_DATA);

  ngOnInit(): void {
    this.loadTradingViewScript();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initWidget();
    }, 100);
  }

  private loadTradingViewScript(): void {
    if (typeof TradingView !== 'undefined') {
      this.initWidget();
      return;
    }
    
    // Check if script is already present but loading
    if (document.getElementById('tradingview-widget-script')) {
      return;
    }

    const script = document.createElement('script');
    script.id = 'tradingview-widget-script';
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.onload = () => {
      this.initWidget();
    };
    script.onerror = () => {
      console.error('Error loading TradingView script.');
    };
    document.head.appendChild(script);
  }

  private initWidget(): void {
    if (typeof TradingView === 'undefined') return;
    
    const symbol = this.data.symbol.toUpperCase();
    const prefixedSymbol = `NASDAQ:${symbol}`;

    new TradingView.widget({
      autosize: true,
      symbol: prefixedSymbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'light',
      style: '1',
      locale: 'en',
      toolbar_bg: '#f1f3f6',
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      container_id: 'tradingview_chart_container'
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
