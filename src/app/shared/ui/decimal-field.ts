import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { formatDecimalInput, parseDecimal } from '../util/decimal';

/**
 * A numeric text field that accepts whatever decimal separator the user types.
 *
 * The text is deliberately *not* a rendering of the model. Rewriting it on
 * every keystroke would erase a half-typed "4," the moment it parsed to 4, and
 * would stamp a "0" into a field the user had just cleared. Instead the text
 * is only re-synced when the model has moved somewhere the current text does
 * not already mean — a chip, a slider, or a clamped-back value.
 */
@Component({
  selector: 'app-decimal-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="text"
      inputmode="decimal"
      autocomplete="off"
      [id]="fieldId()"
      [attr.aria-label]="ariaLabel()"
      [value]="text()"
      (input)="onInput($event)"
      (blur)="normalise()"
    />
  `,
  styles: `
    :host,
    input {
      display: block;
      width: 100%;
    }
  `,
})
export class DecimalField {
  readonly value = input.required<number>();
  readonly fieldId = input('');
  readonly ariaLabel = input('');
  readonly maximumFractionDigits = input(2);

  /** Emitted only for text that actually parses; never for a partial entry. */
  readonly valueChange = output<number>();

  protected readonly text = signal('');

  constructor() {
    effect(() => {
      const value = this.value();
      untracked(() => {
        if (parseDecimal(this.text()) === value) return;
        this.text.set(formatDecimalInput(value, this.maximumFractionDigits()));
      });
    });
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.text.set(text);
    const parsed = parseDecimal(text);
    if (parsed !== null) this.valueChange.emit(parsed);
  }

  /** Leaving the field settles it back to the canonical rendering. */
  protected normalise(): void {
    this.text.set(formatDecimalInput(this.value(), this.maximumFractionDigits()));
  }
}
