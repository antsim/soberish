import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Slow, blurred light behind the card, tinted by the band the night peaked in.
 *
 * Pure decoration, but it is most of what makes the card look like an event
 * rather than a settings screen.
 */
@Component({
  selector: 'app-recap-aurora',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <span class="blob blob--a"></span>
    <span class="blob blob--b"></span>
    <span class="blob blob--c"></span>
  `,
  styleUrl: './recap-aurora.scss',
})
export class RecapAurora {}
