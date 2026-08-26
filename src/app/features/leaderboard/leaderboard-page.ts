import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { statusFor } from '../../core/bac/bac';
import { RankedEntry } from '../../core/models/leaderboard.model';
import { Connectivity } from '../../core/platform/connectivity';
import { AuthStore } from '../../core/supabase/auth-store';
import { LeaderboardService } from '../../core/supabase/leaderboard.service';
import { BacPipe } from '../../shared/util/pipes';
import { AuthCard } from '../auth/auth-card';

/** Who is still above 0.00% right now, ranked. */
@Component({
  selector: 'app-leaderboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthCard, BacPipe, DatePipe],
  templateUrl: './leaderboard-page.html',
  styleUrl: './leaderboard-page.scss',
})
export class LeaderboardPage implements OnInit, OnDestroy {
  protected readonly board = inject(LeaderboardService);
  protected readonly auth = inject(AuthStore);
  protected readonly network = inject(Connectivity);

  protected readonly medals = ['🥇', '🥈', '🥉'];

  protected readonly podium = computed(() => this.board.ranked().slice(0, 3));
  protected readonly rest = computed(() => this.board.ranked().slice(3));

  ngOnInit(): void {
    void this.board.connect();
  }

  ngOnDestroy(): void {
    void this.board.disconnect();
  }

  protected statusClass(entry: RankedEntry): string {
    return `tone-${statusFor(entry.liveBac)}`;
  }
}
