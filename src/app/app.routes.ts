import { Routes } from '@angular/router';

/**
 * Three screens, three lazy chunks. The tracker is eager because it is the
 * landing screen and must paint instantly from cache when offline.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Soberish — tonight',
    loadComponent: () => import('./features/tracker/tracker-page').then((m) => m.TrackerPage),
  },
  {
    path: 'leaderboard',
    title: 'Soberish — top ‰',
    loadComponent: () =>
      import('./features/leaderboard/leaderboard-page').then((m) => m.LeaderboardPage),
  },
  {
    path: 'you',
    title: 'Soberish — you',
    loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
  },
  { path: '**', redirectTo: '' },
];
