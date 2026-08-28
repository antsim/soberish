import { Pipe, PipeTransform } from '@angular/core';
import { Messages } from '../../core/i18n/messages.en';
import { UnitSystem } from '../../core/models/profile.model';
import { formatDuration, formatPermille, formatVolume } from './format';

/** Renders a BAC percentage as promille, e.g. `0.082` → `0.82`. */
@Pipe({ name: 'permille' })
export class PermillePipe implements PipeTransform {
  transform(bacPercent: number): string {
    return formatPermille(bacPercent);
  }
}

/**
 * Takes the dictionary as an argument rather than injecting it, so the pipe
 * stays pure and still re-runs the moment the language changes.
 */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(ms: number | null, messages: Messages): string {
    return ms === null ? '—' : formatDuration(ms, messages.time);
  }
}

@Pipe({ name: 'volume' })
export class VolumePipe implements PipeTransform {
  transform(ml: number, units: UnitSystem): string {
    return formatVolume(ml, units);
  }
}
