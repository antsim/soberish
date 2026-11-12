import { Pipe, PipeTransform } from '@angular/core';
import { Messages } from '../../core/i18n/messages.en';
import { formatDuration } from './format';

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
