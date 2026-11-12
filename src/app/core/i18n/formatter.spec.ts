import { formatterFor } from './formatter';

const at = (hours: number, minutes: number) => new Date(2026, 10, 13, hours, minutes).getTime();

describe('formatter', () => {
  it('writes Finnish numbers the Finnish way', () => {
    const fi = formatterFor('fi');
    expect(fi.permille(0.031)).toBe('0,31');
    expect(fi.permille(0.12)).toBe('1,20');
    expect(fi.decimal(3.25, 1)).toBe('3,3');
    expect(fi.abv(4.7)).toBe('4,7\u00a0%');
    expect(fi.clock(at(0, 15))).toBe('00.15');
    expect(fi.volume(330, 'metric')).toBe('330 ml');
  });

  it('keeps the decimal point and the colon in English', () => {
    const en = formatterFor('en');
    expect(en.permille(0.031)).toBe('0.31');
    expect(en.abv(12.5)).toBe('12.5%');
    expect(en.abv(40)).toBe('40%');
    expect(en.clock(at(0, 15))).toBe('00:15');
    expect(en.clock(at(19, 5))).toBe('19:05');
    expect(en.volume(355, 'imperial')).toBe('12 oz');
    expect(en.weight(80, 'imperial')).toBe('176 lb');
  });
});
