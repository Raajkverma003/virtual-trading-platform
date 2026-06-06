import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5050/api/leaderboard';

  getLeaderboard(): Observable<any> {
    return this.http.get(this.apiUrl);
  }
}
