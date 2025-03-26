import { expect, test } from 'vitest';
import * as util from './utils';

test('calculateBearing', () => {
    expect(util.calculateBearing([0, 0], [1, 0])).toEqual(90);
    expect(util.calculateBearing([0, 0], [0, 1])).toEqual(0);
    expect(util.calculateBearing([0, 0], [-1, 0])).toEqual(270);
    expect(util.calculateBearing([0, 0], [0, -1])).toEqual(180);
});

