import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-stock-metrics-widget',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './stock-metrics-widget.component.html',
  styleUrl: './stock-metrics-widget.component.css'
})
export class StockMetricsWidgetComponent {
  @Input() title!: string;
  @Input() stocks: any[] = [];
  @Input() metricType: 'change' | 'volume' = 'change';

  @Output() stockSelected = new EventEmitter<string>();

  selectStock(symbol: string): void {
    this.stockSelected.emit(symbol);
  }
}
