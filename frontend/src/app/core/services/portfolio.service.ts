import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5050/api/portfolio';

  getPortfolio(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  getPortfolioHistory(): Observable<any> {
    return this.http.get(`${this.apiUrl}/history`);
  }

  getPositions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/positions`);
  }

  settlePositions(): Observable<any> {
    return this.http.post(`${this.apiUrl}/positions/settle`, {});
  }
}
