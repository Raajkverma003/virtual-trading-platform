import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TradeService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5050/api/trades';

  placeOrder(order: { symbol: string, type: 'BUY' | 'SELL', orderType: 'MARKET' | 'LIMIT', shares: number, limitPrice?: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/order`, order);
  }

  getTransactionHistory(): Observable<any> {
    return this.http.get(`${this.apiUrl}/history`);
  }

  getPendingOrders(): Observable<any> {
    return this.http.get(`${this.apiUrl}/pending`);
  }

  cancelOrder(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cancel/${id}`);
  }
}
