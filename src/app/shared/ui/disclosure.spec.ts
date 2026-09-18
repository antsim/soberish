import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Disclosure } from './disclosure';

@Component({
  imports: [Disclosure],
  template: `
    <app-disclosure
      icon="⏱"
      [label]="'Pace'"
      [value]="value()"
      [highlight]="highlight()"
      [startOpen]="startOpen()"
    >
      <p id="body">panel</p>
    </app-disclosure>
  `,
})
class Host {
  readonly value = signal('In one go');
  readonly highlight = signal(false);
  readonly startOpen = signal(false);
}

describe('Disclosure', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      head: element.querySelector('button.head') as HTMLButtonElement,
      panel: element.querySelector('.panel') as HTMLElement,
      value: element.querySelector('.head__value') as HTMLElement,
    };
  }

  it('starts closed, showing its value rather than its controls', () => {
    const { head, panel, value } = render();

    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
    expect(value.textContent?.trim()).toBe('In one go');
  });

  it('points aria-controls at the panel it toggles', () => {
    const { head, panel } = render();

    expect(head.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.id).not.toBe('');
  });

  it('opens and closes on click', async () => {
    const { fixture, head, panel } = render();

    head.click();
    await fixture.whenStable();
    expect(panel.hidden).toBe(false);
    expect(head.getAttribute('aria-expanded')).toBe('true');

    head.click();
    await fixture.whenStable();
    expect(panel.hidden).toBe(true);
  });

  it('opens on creation when asked to', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.startOpen.set(true);
    fixture.detectChanges();

    const panel = (fixture.nativeElement as HTMLElement).querySelector('.panel') as HTMLElement;
    expect(panel.hidden).toBe(false);
  });

  it('keeps the row closed when its value changes underneath it', async () => {
    const { fixture, panel } = render();

    fixture.componentInstance.value.set('Over 30 min');
    await fixture.whenStable();

    // A row the user left closed must not spring open on a value change.
    expect(panel.hidden).toBe(true);
  });

  it('tints the value once it is off its default', async () => {
    const { fixture, value } = render();
    expect(value.classList.contains('head__value--set')).toBe(false);

    fixture.componentInstance.highlight.set(true);
    await fixture.whenStable();
    expect(value.classList.contains('head__value--set')).toBe(true);
  });
});
