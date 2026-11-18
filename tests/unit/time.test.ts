import { parseLength, nextOccurrence, formatLength, formatClock } from '../../src/core/time';

describe('parseLength', () => {
  test('m:ss', () => expect(parseLength('3:15')).toBe(195));
  test('h:mm:ss with nbsp and spaces', () => expect(parseLength(' 1:02:03 ')).toBe(3723));
  test('under a minute', () => expect(parseLength('0:59')).toBe(59));
  test('LIVE is not a length', () => expect(parseLength('LIVE')).toBeNull());
  test('playlist counts are not lengths', () => expect(parseLength('12 videos')).toBeNull());
  test('empty', () => expect(parseLength('')).toBeNull());
});

describe('nextOccurrence', () => {
  const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m, 0, 0).getTime();
  test('until time after midnight is tomorrow', () => {
    expect(nextOccurrence('00:30', at(18, 23, 0))).toBe(at(19, 0, 30));
  });
  test('later today stays today', () => {
    expect(nextOccurrence('23:30', at(18, 23, 0))).toBe(at(18, 23, 30));
  });
  test('the current minute counts as passed', () => {
    expect(nextOccurrence('23:00', at(18, 23, 0))).toBe(at(19, 23, 0));
  });
});

describe('formatLength', () => {
  test('minutes', () => expect(formatLength(2880)).toBe('48 minutes'));
  test('one minute', () => expect(formatLength(60)).toBe('1 minute'));
  test('hours and minutes', () => expect(formatLength(3900)).toBe('1 hour 5 minutes'));
  test('whole hours', () => expect(formatLength(7200)).toBe('2 hours'));
});

describe('formatClock', () => {
  test('12-hour English', () => {
    expect(formatClock(new Date(2026, 10, 18, 21, 30).getTime(), 'en-US')).toBe('9:30 PM');
  });
});
