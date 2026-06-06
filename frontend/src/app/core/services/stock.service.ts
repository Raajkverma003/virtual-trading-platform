import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5050/api/stocks';

  getStocks(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  getStockBySymbol(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${symbol}`);
  }
}
