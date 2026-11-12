import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { I18n } from '../../../core/i18n/i18n.service';
import { BodyType, PROFILE_LIMITS } from '../../../core/models/profile.model';
import { ProfileStore } from '../../../core/state/profile-store';
import { DecimalField } from '../../../shared/ui/decimal-field';
import { Sheet } from '../../../shared/ui/sheet';

/**
 * The two first-run questions.
 *
 * Weight and body composition move the estimate more than anything else in
 * settings, and a first reading built on a guessed 80 kg is one the user has
 * no reason to trust. Asked once, up front, in kilograms — the unit setting
 * cannot have been changed yet on a profile that has never been saved.
 */
@Component({
  selector: 'app-setup-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalField, Sheet],
  template: `
    <app-sheet [title]="msg().setup.title" (dismissed)="dismissed.emit()">
      <p class="lead">{{ msg().setup.body }}</p>

      <div class="field">
        <label for="setup-weight">{{ msg().setup.weight }}</label>
        <app-decimal-field
          fieldId="setup-weight"
          [ariaLabel]="msg().profile.weightAria(msg().profile.kilograms)"
          [value]="weightKg()"
          [maximumFractionDigits]="0"
          (valueChange)="weightKg.set($event)"
        />
      </div>

      <div class="field">
        <label>{{ msg().profile.bodyComposition }}</label>
        <div class="segmented" role="group" [attr.aria-label]="msg().profile.bodyComposition">
          @for (option of bodyTypes(); track option.value) {
            <button
              type="button"
              [class.active]="bodyType() === option.value"
              [attr.aria-pressed]="bodyType() === option.value"
              (click)="bodyType.set(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>

      <div class="actions" sheet-actions>
        <button type="button" class="btn btn--ghost" (click)="dismissed.emit()">
          {{ msg().setup.later }}
        </button>
        <button type="button" class="btn btn--primary btn--block" (click)="save()">
          {{ msg().setup.done }}
        </button>
      </div>
    </app-sheet>
  `,
  styleUrl: './setup-sheet.scss',
})
export class SetupSheet {
  readonly #profiles = inject(ProfileStore);
  protected readonly msg = inject(I18n).messages;

  readonly dismissed = output<void>();

  protected readonly weightKg = signal(this.#profiles.profile().weightKg);
  protected readonly bodyType = signal<BodyType>(this.#profiles.profile().bodyType);

  protected readonly bodyTypes = computed(() => {
    const words = this.msg().profile;
    return [
      { value: 'female', label: words.female },
      { value: 'male', label: words.male },
      { value: 'unspecified', label: words.average },
    ] satisfies { value: BodyType; label: string }[];
  });

  protected async save(): Promise<void> {
    const { min, max } = PROFILE_LIMITS.weightKg;
    const weightKg = Math.min(max, Math.max(min, this.weightKg()));
    await this.#profiles.patch({ weightKg, bodyType: this.bodyType() });
    this.dismissed.emit();
  }
}
