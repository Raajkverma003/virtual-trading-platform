import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WatchlistService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5050/api/watchlist';

  getWatchlists(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  createWatchlist(name: string): Observable<any> {
    return this.http.post(this.apiUrl, { name });
  }

  deleteWatchlist(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  addSymbol(watchlistId: string, symbol: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${watchlistId}/symbols`, { symbol });
  }

  removeSymbol(watchlistId: string, symbol: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${watchlistId}/symbols/${symbol}`);
  }
}
