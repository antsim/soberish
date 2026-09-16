import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { standardDrinks } from '../../../core/bac/bac';
import { I18n } from '../../../core/i18n/i18n.service';
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
            [attr.aria-label]="msg().drinkList.edit(drink.label)"
          >
            <span class="row__icon" aria-hidden="true">{{ drink.icon }}</span>
            <span class="row__text">
              <span class="row__title">{{ drink.label }}</span>
              <span class="row__meta tabular">
                {{ drink.volumeMl | volume: units() }} · {{ drink.abv }}% ·
                {{ msg().drinkList.units(unitsFor(drink).toFixed(1)) }}
                @if (drink.durationMinutes > 0) {
                  · {{ msg().editor.minutes(drink.durationMinutes) }}
                }
              </span>
            </span>
            <span class="row__time tabular">{{ drink.consumedAt | date: 'HH:mm' }}</span>
          </button>
          <button
            type="button"
            class="row__delete"
            (click)="remove.emit(drink)"
            [attr.aria-label]="msg().drinkList.delete(drink.label)"
          >
            ✕
          </button>
        </li>
      } @empty {
        <li class="empty">{{ msg().drinkList.empty }}</li>
      }
    </ul>
  `,
  styleUrl: './drink-list.scss',
})
export class DrinkList {
  protected readonly msg = inject(I18n).messages;

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
