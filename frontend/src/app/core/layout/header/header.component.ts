import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';
import { WebsocketService } from '../../services/websocket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  wsService = inject(WebsocketService);

  private priceSubscription!: Subscription;
  private statusInterval: any;

  // Real-time Indices
  nasdaqPrice = 18620.40;
  nasdaqChange = 112.50;
  nasdaqPercent = 0.61;

  sp500Price = 5342.10;
  sp500Change = 24.80;
  sp500Percent = 0.47;

  dowPrice = 39120.50;
  dowChange = -45.20;
  dowPercent = -0.12;

  // Market Status
  marketStatus: { status: string, timeString: string, isOpen: boolean } = {
    status: 'Closed',
    timeString: 'Loading...',
    isOpen: false
  };

  ngOnInit(): void {
    // Initial status check
    this.updateMarketStatus();

    // Update market status every 30 seconds
    this.statusInterval = setInterval(() => {
      this.updateMarketStatus();
    }, 30000);

    // Subscribe to real-time price updates
    this.priceSubscription = this.wsService.stockPrices$.subscribe((prices) => {
      if (!prices || prices.length === 0) return;

      // Calculate average change percentage of stocks to guide indices
      let totalChangePercent = 0;
      prices.forEach(p => {
        totalChangePercent += p.changePercent || 0;
      });
      const avgChangePercent = totalChangePercent / prices.length;

      // Dampened factor based on market movement
      const marketFactor = 1 + (avgChangePercent / 100) * 0.4;

      // NASDAQ
      const nasdaqNoise = (Math.random() * 0.08 - 0.04) / 100;
      this.nasdaqPrice = this.nasdaqPrice * marketFactor * (1 + nasdaqNoise);
      this.nasdaqPrice = Math.round(this.nasdaqPrice * 100) / 100;
      this.nasdaqChange = Math.round((this.nasdaqPrice - 18507.90) * 100) / 100;
      this.nasdaqPercent = Math.round((this.nasdaqChange / 18507.90) * 10000) / 100;

      // S&P 500
      const spNoise = (Math.random() * 0.05 - 0.025) / 100;
      this.sp500Price = this.sp500Price * marketFactor * (1 + spNoise);
      this.sp500Price = Math.round(this.sp500Price * 100) / 100;
      this.sp500Change = Math.round((this.sp500Price - 5317.30) * 100) / 100;
      this.sp500Percent = Math.round((this.sp500Change / 5317.30) * 10000) / 100;

      // Dow Jones
      const dowNoise = (Math.random() * 0.03 - 0.015) / 100;
      this.dowPrice = this.dowPrice * marketFactor * (1 + dowNoise);
      this.dowPrice = Math.round(this.dowPrice * 100) / 100;
      this.dowChange = Math.round((this.dowPrice - 39165.70) * 100) / 100;
      this.dowPercent = Math.round((this.dowChange / 39165.70) * 10000) / 100;
    });
  }

  ngOnDestroy(): void {
    if (this.priceSubscription) {
      this.priceSubscription.unsubscribe();
    }
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  }

  updateMarketStatus(): void {
    const now = new Date();
    let nyTime: Date;
    try {
      nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    } catch (e) {
      nyTime = now;
    }

    const day = nyTime.getDay(); // 0 = Sun, 6 = Sat
    const hours = nyTime.getHours();
    const minutes = nyTime.getMinutes();
    const currentTimeInMinutes = hours * 60 + minutes;

    const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM ET
    const marketCloseMinutes = 16 * 60;    // 4:00 PM ET

    const isWeekday = day >= 1 && day <= 5;
    const isMarketHours = currentTimeInMinutes >= marketOpenMinutes && currentTimeInMinutes < marketCloseMinutes;
    const isOpen = isWeekday && isMarketHours;

    if (isOpen) {
      const diff = marketCloseMinutes - currentTimeInMinutes;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      this.marketStatus = {
        status: 'Open',
        timeString: `Closes in ${h}h ${m}m`,
        isOpen: true
      };
    } else {
      let daysToAdd = 0;
      if (day === 0) {
        daysToAdd = 1;
      } else if (day === 6) {
        daysToAdd = 2;
      } else if (currentTimeInMinutes >= marketCloseMinutes) {
        daysToAdd = (day === 5) ? 3 : 1;
      } else if (currentTimeInMinutes < marketOpenMinutes) {
        daysToAdd = 0;
      }

      const targetDate = new Date(nyTime);
      targetDate.setDate(nyTime.getDate() + daysToAdd);
      targetDate.setHours(9, 30, 0, 0);

      const diffMs = targetDate.getTime() - nyTime.getTime();
      const totalMinutes = Math.floor(diffMs / (1000 * 60));

      if (totalMinutes < 0) {
        this.marketStatus = { status: 'Closed', timeString: 'Opens at 9:30 AM ET', isOpen: false };
        return;
      }

      const d = Math.floor(totalMinutes / (60 * 24));
      const h = Math.floor((totalMinutes % (60 * 24)) / 60);
      const m = totalMinutes % 60;

      let timeStr = '';
      if (d > 0) {
        timeStr = `Opens in ${d}d ${h}h`;
      } else {
        timeStr = `Opens in ${h}h ${m}m`;
      }

      this.marketStatus = {
        status: 'Closed',
        timeString: timeStr,
        isOpen: false
      };
    }
  }
}

