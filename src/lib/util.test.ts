import { expect, test } from 'vitest';
import * as util from './utils';

test('calculateBearing', () => {
    expect(util.calculateBearing([0, 0], [1, 0])).toEqual(90);
    expect(util.calculateBearing([0, 0], [0, 1])).toEqual(0);
    expect(util.calculateBearing([0, 0], [-1, 0])).toEqual(270);
    expect(util.calculateBearing([0, 0], [0, -1])).toEqual(180);
});

test('roundRemainingDistance', () => {
    expect(util.roundRemainingDistance(0)).toEqual(0);
    expect(util.roundRemainingDistance(1)).toEqual(0);
    expect(util.roundRemainingDistance(16)).toEqual(10);
    expect(util.roundRemainingDistance(90)).toEqual(75);
    expect(util.roundRemainingDistance(155)).toEqual(150);
    expect(util.roundRemainingDistance(1075)).toEqual(1000);
});
