import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { standardDrinks } from '../../../core/bac/bac';
import { Drink } from '../../../core/models/drink.model';
import { UnitSystem } from '../../../core/models/profile.model';
import { VolumePipe } from '../../../shared/util/pipes';

/** The session timeline, newest first, with edit and delete on every row. */
@Component({
  selector: 'app-drink-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, VolumePipe],
  template: `
    <ul class="list">
      @for (drink of ordered(); track drink.id) {
        <li class="row">
          <button
            type="button"
            class="row__main"
            (click)="edit.emit(drink)"
            [attr.aria-label]="'Edit ' + drink.label"
          >
            <span class="row__icon" aria-hidden="true">{{ drink.icon }}</span>
            <span class="row__text">
              <span class="row__title">{{ drink.label }}</span>
              <span class="row__meta tabular">
                {{ drink.volumeMl | volume: units() }} · {{ drink.abv }}% ·
                {{ unitsFor(drink).toFixed(1) }} units
              </span>
            </span>
            <span class="row__time tabular">{{ drink.consumedAt | date: 'HH:mm' }}</span>
          </button>
          <button
            type="button"
            class="row__delete"
            (click)="remove.emit(drink)"
            [attr.aria-label]="'Delete ' + drink.label"
          >
            ✕
          </button>
        </li>
      } @empty {
        <li class="empty">Nothing logged yet — tap a drink above to start the night.</li>
      }
    </ul>
  `,
  styleUrl: './drink-list.scss',
})
export class DrinkList {
  readonly drinks = input.required<readonly Drink[]>();
  readonly units = input.required<UnitSystem>();
  readonly edit = output<Drink>();
  readonly remove = output<Drink>();

  protected readonly ordered = computed(() =>
    [...this.drinks()].sort((a, b) => b.consumedAt - a.consumedAt),
  );

  protected unitsFor(drink: Drink): number {
    return standardDrinks(drink.volumeMl, drink.abv);
  }
}
