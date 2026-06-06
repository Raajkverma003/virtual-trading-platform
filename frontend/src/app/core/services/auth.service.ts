import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = 'http://localhost:5050/api/auth';

  currentUser = signal<any>(null);
  token = signal<string | null>(localStorage.getItem('token'));

  constructor() {
    if (this.token()) {
      this.getProfile().subscribe({
        next: (res: any) => {
          this.currentUser.set(res.data);
        },
        error: () => {
          this.logout();
        }
      });
    }
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData).pipe(
      tap((res: any) => {
        if (res.token) {
          this.handleAuthSuccess(res.token, res);
        }
      })
    );
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((res: any) => {
        if (res.token) {
          this.handleAuthSuccess(res.token, res);
        }
      })
    );
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`);
  }

  logout(): void {
    localStorage.removeItem('token');
    this.token.set(null);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.token();
  }

  private handleAuthSuccess(token: string, userResponse: any): void {
    localStorage.setItem('token', token);
    this.token.set(token);
    // User info maps to the registration or login schema
    this.currentUser.set(userResponse.data || userResponse);
  }
}
