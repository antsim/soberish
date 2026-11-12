import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The app's own line icons, for chrome only.
 *
 * Emoji stay where they are content — a drink is a 🍺 — but navigation and
 * controls drawn as emoji look different on every platform and cannot take the
 * accent colour, so those are strokes in `currentColor` instead.
 */
const PATHS = {
  glass: 'M7 3h10l-1.2 16.2a2 2 0 0 1-2 1.8h-3.6a2 2 0 0 1-2-1.8L7 3z M7.5 9h9',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4z M8 6H5a3 3 0 0 0 3 4 M16 6h3a3 3 0 0 1-3 4 M12 13v4 M8.5 20h7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20a7.5 7.5 0 0 1 15 0',
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M18 6L6 18',
  refresh: 'M20 11a8 8 0 1 0-2.3 6.3 M20 5v6h-6',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-grid;
      width: 1.5em;
      height: 1.5em;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly path = computed(() => PATHS[this.name()]);
}
