import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HOUR } from '../../core/bac/bac';
import { Drink, DrinkDraft, DrinkPreset } from '../../core/models/drink.model';
import { Clock } from '../../core/platform/clock';
import { Toaster } from '../../core/platform/toaster';
import { DrinksStore } from '../../core/state/drinks-store';
import { ProfileStore } from '../../core/state/profile-store';
import { RecentDrinksStore } from '../../core/state/recent-drinks-store';
import { SpanChoice } from '../../core/state/chart-viewport';
import { SessionStore } from '../../core/state/session-store';
import { DurationPipe } from '../../shared/util/pipes';
import { formatPermille } from '../../shared/util/format';
import { BacChart } from './components/bac-chart';
import { BacReadout } from './components/bac-readout';
import { DrinkEditor } from './components/drink-editor';
import { DrinkList } from './components/drink-list';
import { QuickAdd } from './components/quick-add';

type EditorState =
  | { readonly mode: 'closed' }
  | { readonly mode: 'add'; readonly seed: DrinkDraft | null }
  | { readonly mode: 'edit'; readonly drink: Drink };

/** Tonight's screen: current BAC, the curve, and everything that edits it. */
@Component({
  selector: 'app-tracker-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BacChart, BacReadout, DrinkEditor, DrinkList, DurationPipe, QuickAdd, RouterLink],
  templateUrl: './tracker-page.html',
  styleUrl: './tracker-page.scss',
})
export class TrackerPage implements OnInit {
  protected readonly session = inject(SessionStore);
  protected readonly drinks = inject(DrinksStore);
  protected readonly profiles = inject(ProfileStore);
  protected readonly recentDrinks = inject(RecentDrinksStore);
  protected readonly clock = inject(Clock);
  readonly #toaster = inject(Toaster);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);

  protected readonly editor = signal<EditorState>({ mode: 'closed' });

  protected readonly editing = computed(() => {
    const state = this.editor();
    return state.mode === 'edit' ? state.drink : null;
  });

  protected readonly seed = computed(() => {
    const state = this.editor();
    return state.mode === 'add' ? state.seed : null;
  });

  /** Range chips, narrowed to the ones that actually zoom this session. */
  protected readonly ranges = computed(() => {
    const sessionMs = this.session.chartBounds().to - this.session.chartBounds().from;
    const windowMs = this.session.chartWindow().to - this.session.chartWindow().from;
    const whole = this.session.showingWholeSession();
    const options: { label: string; choice: SpanChoice; active: boolean }[] = [];
    for (const hours of [3, 6, 12]) {
      const span = hours * HOUR;
      if (span >= sessionMs) continue;
      options.push({
        label: `${hours}h`,
        choice: span,
        active: !whole && Math.abs(windowMs - span) < 60_000,
      });
    }
    options.push({ label: 'Session', choice: 'session', active: whole });
    return options;
  });

  protected readonly stats = computed(() => [
    { label: 'Units', value: this.session.totalStandardDrinks().toFixed(1) },
    { label: 'Drinks', value: `${this.drinks.count()}` },
    { label: 'Peak', value: formatPermille(this.session.peak()) },
    {
      label: 'Session',
      value: this.session.elapsedMs() ? formatShort(this.session.elapsedMs()) : '—',
    },
  ]);

  ngOnInit(): void {
    // The manifest shortcut deep-links straight into the add sheet.
    if (this.#route.snapshot.queryParamMap.has('add')) {
      this.editor.set({ mode: 'add', seed: null });
      void this.#router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  protected setRange(choice: SpanChoice): void {
    this.session.setChartSpan(choice);
  }

  protected onPan(deltaMs: number): void {
    this.session.panChart(deltaMs);
  }

  protected onZoom(gesture: { factor: number; focusRatio: number }): void {
    this.session.zoomChart(gesture.factor, gesture.focusRatio);
  }

  protected async quickAdd(preset: DrinkPreset): Promise<void> {
    const drink = await this.drinks.add({
      label: preset.label,
      icon: preset.icon,
      volumeMl: preset.volumeMl,
      abv: preset.abv,
      consumedAt: Date.now(),
    });
    this.clock.sync();
    this.#toaster.success(`${preset.icon} ${preset.label} logged`, {
      label: 'Undo',
      run: () => void this.drinks.remove(drink.id),
    });
  }

  protected openCustom(): void {
    this.editor.set({ mode: 'add', seed: this.#lastAsSeed() });
  }

  protected openEdit(drink: Drink): void {
    this.editor.set({ mode: 'edit', drink });
  }

  protected close(): void {
    this.editor.set({ mode: 'closed' });
  }

  protected async save(draft: DrinkDraft): Promise<void> {
    const state = this.editor();
    if (state.mode === 'edit') {
      await this.drinks.update(state.drink.id, draft);
      this.#toaster.success('Drink updated');
    } else {
      await this.drinks.add(draft);
      await this.recentDrinks.remember(draft);
      this.#toaster.success(`${draft.icon} ${draft.label} logged`);
    }
    this.clock.sync();
    this.close();
  }

  protected async remove(drink: Drink): Promise<void> {
    await this.drinks.remove(drink.id);
    this.close();
    this.#toaster.show(`${drink.label} deleted`, 'info', {
      label: 'Undo',
      run: () => void this.drinks.restore(drink.id),
    });
  }

  protected async removeById(id: string): Promise<void> {
    const drink = this.drinks.drinks().find((candidate) => candidate.id === id);
    if (drink) await this.remove(drink);
  }

  /** Repeating the last drink is the most likely custom add. */
  #lastAsSeed(): DrinkDraft | null {
    const last = this.drinks.lastDrink();
    if (!last) return null;
    return {
      label: last.label,
      icon: last.icon,
      volumeMl: last.volumeMl,
      abv: last.abv,
      consumedAt: Date.now(),
    };
  }
}

function formatShort(ms: number): string {
  const hours = Math.floor(ms / HOUR);
  const minutes = Math.round((ms % HOUR) / 60_000);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
