import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';

/**
 * A modal bottom sheet — the app's only overlay primitive.
 *
 * Content is projected, so add/edit/auth all share the same entrance
 * animation, backdrop, and dismissal behaviour.
 */
@Component({
  selector: 'app-sheet',
  host: {
    class: 'sheet-host',
    '(keydown.escape)': 'dismissed.emit()',
  },
  template: `
    <div class="backdrop" (click)="dismissed.emit()" aria-hidden="true"></div>
    <section
      class="sheet"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      #panel
      tabindex="-1"
    >
      <header class="sheet__head">
        <span class="grabber" aria-hidden="true"></span>
        <h2>{{ title() }}</h2>
        <button type="button" class="close" (click)="dismissed.emit()" aria-label="Close">✕</button>
      </header>
      <div class="sheet__body">
        <ng-content />
      </div>
    </section>
  `,
  styleUrl: './sheet.scss',
})
export class Sheet {
  readonly title = input.required<string>();
  readonly dismissed = output<void>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    afterNextRender(() => this.panel().nativeElement.focus({ preventScroll: true }));
  }
}
