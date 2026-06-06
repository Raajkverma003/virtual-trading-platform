import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { AuthService } from '../../core/services/auth.service';

interface LeaderboardEntry {
  _id: string;
  username: string;
  cash: number;
  holdingsValue: number;
  netWorth: number;
  rank?: number;
}

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.css'
})
export class LeaderboardComponent implements OnInit {
  private leaderboardService = inject(LeaderboardService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  entries = signal<LeaderboardEntry[]>([]);
  podium = signal<LeaderboardEntry[]>([]);
  loading = signal<boolean>(true);

  ngOnInit(): void {
    this.fetchLeaderboard();
  }

  private fetchLeaderboard(): void {
    this.leaderboardService.getLeaderboard().subscribe({
      next: (res: any) => {
        const fullEntries = res.data || [];
        this.entries.set(fullEntries);
        // Expose top 3 for podium
        this.podium.set(fullEntries.slice(0, 3));
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open('Error loading leaderboard.', 'Dismiss', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  isCurrentUser(username: string): boolean {
    const user = this.authService.currentUser();
    return user ? user.username.toLowerCase() === username.toLowerCase() : false;
  }

  getRankClass(rank: number): string {
    if (rank === 1) return 'rank-badge-gold';
    if (rank === 2) return 'rank-badge-silver';
    if (rank === 3) return 'rank-badge-bronze';
    return 'rank-badge-other';
  }
}
