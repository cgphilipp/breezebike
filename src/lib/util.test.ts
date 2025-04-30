import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import * as util from './utils';
import type { LineString } from 'geojson';

// Mock navigator.wakeLock for requestWakeLock tests
const mockWakeLock = {
    release: vi.fn().mockResolvedValue(undefined),
};
const mockWakeLockRequest = vi.fn();

// Assign the mock to the global navigator object before tests run
// We need to use 'any' because the global navigator type might not include wakeLock
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalNavigator = globalThis.navigator as any;
if (!globalNavigator.wakeLock) {
    globalNavigator.wakeLock = {};
}
globalNavigator.wakeLock.request = mockWakeLockRequest;


beforeEach(() => {
    vi.useFakeTimers();
    mockWakeLockRequest.mockClear();
    mockWakeLock.release.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks(); // Restore original timers and mocks
});


test('debounce', () => {
    const callback = vi.fn();
    const debouncedCallback = util.debounce(callback, 500);

    debouncedCallback();
    debouncedCallback();
    debouncedCallback();

    // Callback should not have been called yet
    expect(callback).not.toHaveBeenCalled();

    // Fast-forward time by 499ms
    vi.advanceTimersByTime(499);
    expect(callback).not.toHaveBeenCalled();

    // Fast-forward time by 1ms to reach the 500ms threshold
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);

    // Call again
    debouncedCallback();
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(2);
});

test('requestWakeLock success', async () => {
    mockWakeLockRequest.mockResolvedValue(mockWakeLock);

    const wakeLock = await util.requestWakeLock();

    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    expect(wakeLock).toBe(mockWakeLock);
    // You could potentially spy on console.log if needed, but checking the return value is often sufficient
});

test('requestWakeLock failure', async () => {
    const error = new Error('Wake Lock API not supported');
    mockWakeLockRequest.mockRejectedValue(error);
    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const wakeLock = await util.requestWakeLock();

    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    expect(wakeLock).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(`Error while requesting wake lock: ${error}`);

    consoleErrorSpy.mockRestore(); // Clean up the spy
});


test('getBoundsFromPath', () => {
    const path: LineString = {
        type: 'LineString',
        coordinates: [
            [10, 20],
            [12, 25],
            [8, 22]
        ]
    };
    const padding = 0.1; // 10%

    // Expected minLng=8, maxLng=12, minLat=20, maxLat=25
    // diffX = 12 - 8 = 4
    // diffY = 25 - 20 = 5
    // paddingX = 4 * 0.1 = 0.4
    // paddingY = 5 * 0.1 = 0.5
    // Expected bounds: [8 - 0.4, 20 - 0.5, 12 + 0.4, 25 + 0.5] = [7.6, 19.5, 12.4, 25.5]
    const expectedBounds = [7.6, 19.5, 12.4, 25.5];

    const bounds = util.getBoundsFromPath(path, padding);

    expect(bounds[0]).toBeCloseTo(expectedBounds[0]);
    expect(bounds[1]).toBeCloseTo(expectedBounds[1]);
    expect(bounds[2]).toBeCloseTo(expectedBounds[2]);
    expect(bounds[3]).toBeCloseTo(expectedBounds[3]);
});

test('getBoundsFromPath with single point', () => {
    const path: LineString = {
        type: 'LineString',
        coordinates: [
            [10, 20]
        ]
    };
    const padding = 0.1;
    // diffX = 0, diffY = 0
    // Expected bounds: [10, 20, 10, 20]
    const expectedBounds = [10, 20, 10, 20];
    const bounds = util.getBoundsFromPath(path, padding);
    expect(bounds).toEqual(expectedBounds);
});


test('distanceMeter', () => {
    const point1 = { lng: 0, lat: 0 };
    const point2 = { lng: 1, lat: 0 };
    const point3 = { lng: 0, lat: 1 };

    expect(util.distanceMeter(point1, point1)).toEqual(0);
    // Approximate distance for 1 degree longitude at equator
    expect(util.distanceMeter(point1, point2)).toBeCloseTo(111320, -3); // ~111km, check within 1km accuracy
    // Approximate distance for 1 degree latitude
    expect(util.distanceMeter(point1, point3)).toBeCloseTo(111195, -3); // ~111km, check within 1km accuracy

    // Test with LngLat array format
    expect(util.distanceMeter([0, 0], [1, 0])).toBeCloseTo(111320, -3);
});

test('coordinateToSegmentDistance', () => {
    const startSegment = { lng: 0, lat: 0 };
    const endSegment = { lng: 10, lat: 0 };

    // Point directly above the middle of the segment
    const point1 = { lng: 5, lat: 5 };
    // Distance should be based on the perpendicular projection (5,0) -> distance is 5 lat units
    // The function returns squared distance in coordinate units (degrees)
    expect(util.coordinateToSegmentDistance(point1, startSegment, endSegment)).toBeCloseTo(5 * 5); // 25

    // Point closer to the start endpoint
    const point2 = { lng: -2, lat: 3 };
    // Closest point on the segment is the start point (0,0)
    // Squared distance = (-2-0)^2 + (3-0)^2 = 4 + 9 = 13
    expect(util.coordinateToSegmentDistance(point2, startSegment, endSegment)).toBeCloseTo(13);

    // Point closer to the end endpoint
    const point3 = { lng: 12, lat: 4 };
    // Closest point on the segment is the end point (10,0)
    // Squared distance = (12-10)^2 + (4-0)^2 = 4 + 16 = 20
    expect(util.coordinateToSegmentDistance(point3, startSegment, endSegment)).toBeCloseTo(20);

    // Point on the segment
    const point4 = { lng: 7, lat: 0 };
    expect(util.coordinateToSegmentDistance(point4, startSegment, endSegment)).toBeCloseTo(0);
});

test('distanceToLineStringVertices', () => {
    const point = { lng: 0, lat: 0 };
    const line: LineString = {
        type: 'LineString',
        coordinates: [
            [1, 0],   // ~111km
            [0, 2],   // ~222km
            [-0.5, 0] // ~55km
        ]
    };

    const expectedMinDistance = util.distanceMeter(point, [-0.5, 0]); // Distance to the closest vertex
    expect(util.distanceToLineStringVertices(point, line)).toBeCloseTo(expectedMinDistance);

    // Test with empty LineString
    const emptyLine: LineString = { type: 'LineString', coordinates: [] };
    expect(util.distanceToLineStringVertices(point, emptyLine)).toBe(Infinity);

    // Test with LineString having one point
    const singlePointLine: LineString = { type: 'LineString', coordinates: [[1, 1]] };
    const expectedDistSingle = util.distanceMeter(point, [1, 1]);
    expect(util.distanceToLineStringVertices(point, singlePointLine)).toBeCloseTo(expectedDistSingle);
});


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
