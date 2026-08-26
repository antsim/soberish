import { Pipe, PipeTransform } from '@angular/core';
import { UnitSystem } from '../../core/models/profile.model';
import { formatBac, formatDuration, formatVolume } from './format';

@Pipe({ name: 'bac' })
export class BacPipe implements PipeTransform {
  transform(value: number): string {
    return formatBac(value);
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
