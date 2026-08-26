import { Pipe, PipeTransform } from '@angular/core';
import { UnitSystem } from '../../core/models/profile.model';
import { formatDuration, formatPermille, formatVolume } from './format';

/** Renders a BAC percentage as promille, e.g. `0.082` → `0.82`. */
@Pipe({ name: 'permille' })
export class PermillePipe implements PipeTransform {
  transform(bacPercent: number): string {
    return formatPermille(bacPercent);
  }
}

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(ms: number | null): string {
    return ms === null ? '—' : formatDuration(ms);
  }
}

@Pipe({ name: 'volume' })
export class VolumePipe implements PipeTransform {
  transform(ml: number, units: UnitSystem): string {
    return formatVolume(ml, units);
  }
}
