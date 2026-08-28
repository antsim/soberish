import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { I18n } from '../../core/i18n/i18n.service';

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
        <button
          type="button"
          class="close"
          (click)="dismissed.emit()"
          [attr.aria-label]="msg().sheet.close"
        >
          ✕
        </button>
      </header>
      <div class="sheet__body">
        <ng-content />
      </div>
    </section>
  `,
  styleUrl: './sheet.scss',
})
export class Sheet {
  protected readonly msg = inject(I18n).messages;

  readonly title = input.required<string>();
  readonly dismissed = output<void>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    afterNextRender(() => this.panel().nativeElement.focus({ preventScroll: true }));
  }
}
