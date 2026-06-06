import { Injectable, signal, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private authService = inject(AuthService);
  private socket!: Socket;
  private serverUrl = 'http://localhost:5050';

  isConnected = signal<boolean>(false);
  
  private stockPricesSubject = new Subject<any[]>();
  stockPrices$ = this.stockPricesSubject.asObservable();

  private orderExecutedSubject = new Subject<any>();
  orderExecuted$ = this.orderExecutedSubject.asObservable();

  private orderCancelledSubject = new Subject<any>();
  orderCancelled$ = this.orderCancelledSubject.asObservable();

  constructor() {
    if (this.authService.token()) {
      this.connect();
    }
  }

  connect(): void {
    if (this.socket && this.socket.connected) return;

    this.socket = io(this.serverUrl);

    this.socket.on('connect', () => {
      console.log('WebSocket connected to backend');
      this.isConnected.set(true);

      const user = this.authService.currentUser();
      const userId = user ? user._id : null;
      if (userId) {
        this.joinUserRoom(userId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.isConnected.set(false);
    });

    // Listen to stock price broadcasts
    this.socket.on('stock-prices', (prices: any[]) => {
      this.stockPricesSubject.next(prices);
    });

    // Listen to limit order execution
    this.socket.on('order-executed', (data: any) => {
      this.orderExecutedSubject.next(data);
      const currentUser = this.authService.currentUser();
      if (currentUser && data.balance !== undefined) {
        this.authService.currentUser.set({
          ...currentUser,
          balance: data.balance
        });
      }
    });

    // Listen to order cancellation
    this.socket.on('order-cancelled', (data: any) => {
      this.orderCancelledSubject.next(data);
    });
  }

  joinUserRoom(userId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_user_room', userId);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected.set(false);
    }
  }
}
