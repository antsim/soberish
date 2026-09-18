import { ChangeDetectionStrategy, Component, OnInit, input, signal } from '@angular/core';

let nextId = 0;

/**
 * A row that folds a rarely-touched control away behind its own value.
 *
 * Closed is the resting state, so a form only shows what most people change
 * most of the time. The row keeps rendering the current setting while closed —
 * hiding a control must never cost the user the answer to "what is this set
 * to?", which is the failure mode that makes accordions feel like a maze.
 */
@Component({
  selector: 'app-disclosure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="head"
      [class.head--open]="open()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="panelId"
      (click)="toggle()"
    >
      @if (icon()) {
        <span class="head__icon" aria-hidden="true">{{ icon() }}</span>
      }
      <span class="head__label">{{ label() }}</span>
      <span class="head__value" [class.head__value--set]="highlight()">{{ value() }}</span>
      <span class="head__chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="panel" [id]="panelId" [hidden]="!open()">
      <ng-content />
    </div>
  `,
  styleUrl: './disclosure.scss',
})
export class Disclosure implements OnInit {
  readonly icon = input('');
  readonly label = input.required<string>();
  /** The current setting, rendered on the closed row. */
  readonly value = input('');
  /** Tints the value: this one is no longer at its default. */
  readonly highlight = input(false);
  /**
   * Whether to start open. Read once, on creation — a row the user has closed
   * must not spring back open the moment its value changes.
   */
  readonly startOpen = input(false);

  protected readonly panelId = `disclosure-${nextId++}`;

  readonly #open = signal(false);
  readonly open = this.#open.asReadonly();

  ngOnInit(): void {
    this.#open.set(this.startOpen());
  }

  protected toggle(): void {
    this.#open.update((open) => !open);
  }
}
