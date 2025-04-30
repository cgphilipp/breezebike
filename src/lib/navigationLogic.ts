import * as api from '$lib/apis';
import * as util from '$lib/utils';
import { dev } from '$app/environment';
import { type LngLatLike } from 'maplibre-gl';
import type { LineString } from 'geojson'; // Removed FeatureCollection
import { get } from 'svelte/store';
import {
    appState, // writable
    cameraState, // $state
    currentUserLocation, // writable
    turnInstructions, // $state
    turnDisplayIconName, // writable
    turnDisplayString, // writable
    currentUserBearing, // writable
    fromInput, // $state
    toInput, // $state
    currentRoutingProfile, // writable
    loadingRoute, // writable
    pathGeoJson, // writable
    currentBounds, // writable
    gpsWatchId, // writable
    loadingGps, // writable
    wakeLock, // writable
    isOffPath, // writable - NEW
    OFF_PATH_THRESHOLD_METERS, // constant - NEW
    DEFAULT_ZOOM,
    NAVIGATION_ZOOM
} from './navigationState.svelte';

export function handleUserLocationChanged(location: LngLatLike) {
    const currentAppState = get(appState);
    if (currentAppState !== "Routing" && currentAppState !== "FinishedRouting") {
        return;
    }

    // todo: provide ability to go into "custom" camera mode while navigating
    cameraState.center = location; // $state object property mutation is fine

    if (currentAppState !== 'Routing') {
        return;
    }

    // --- Off-path check ---
    const currentPathGeoJson = get(pathGeoJson);
    if (currentPathGeoJson && currentPathGeoJson.features.length > 0) {
        const routeGeometry = currentPathGeoJson.features[0].geometry;
        if (routeGeometry.type === 'LineString') {
            const distanceOffPath = util.distanceToLineStringVertices(location, routeGeometry as LineString);
            const isCurrentlyOffPath = distanceOffPath > OFF_PATH_THRESHOLD_METERS;
            if (get(isOffPath) !== isCurrentlyOffPath) {
                isOffPath.set(isCurrentlyOffPath); // Update state only if it changes
                console.log(`User is ${isCurrentlyOffPath ? 'OFF' : 'ON'} path (Distance: ${distanceOffPath}m)`);
            }
        }
    }
    // --- End Off-path check ---


    // turnInstructions is $state, direct access is fine
    const targetId = api.determineCurrentWaypointId(location, turnInstructions);
    const currentTurnInstruction = turnInstructions[targetId];
    const distanceMeters = util.distanceMeter(location, currentTurnInstruction.coordinate);
    let iconName = "";
    switch (currentTurnInstruction.instruction) {
        case "straight":
            iconName = "arrow-narrow-up";
            break;
        case "right":
            iconName = "corner-up-right";
            break;
        case "left":
            iconName = "corner-up-left";
            break;
        case "keep right":
        case "slight right":
            iconName = "arrow-bear-right";
            break;
        case "keep left":
        case "slight left":
            iconName = "arrow-bear-left";
            break;
        case "sharp right":
            iconName = "arrow-sharp-turn-right";
            break;
        case "sharp left":
            iconName = "arrow-sharp-turn-left";
            break;
        default:
            iconName = "";
    }
    turnDisplayIconName.set(iconName); // Use .set() for writable store

    const displayDistance = util.roundRemainingDistance(distanceMeters);
    let displayStr = "";
    if (iconName === "") {
        displayStr = currentTurnInstruction.instruction + " in " + displayDistance + "m";
    } else {
        displayStr = displayDistance + "m";
    }
    turnDisplayString.set(displayStr); // Use .set() for writable store

    if (targetId > 0) {
        const lastTurnInstruction = turnInstructions[targetId - 1];
        cameraState.bearing = util.calculateBearing( // $state object property mutation is fine
            lastTurnInstruction.coordinate, // $state array element access is fine
            currentTurnInstruction.coordinate, // $state array element access is fine
        );
    }

    // hacky :)
    if (currentTurnInstruction.instruction === "Destination" && distanceMeters < 10) {
        finishRouting();
    }
}

export async function calculateRoute() {
    // fromInput and toInput are $state, direct property access/mutation is fine
    console.log(`Routing from ${fromInput.input} to ${toInput.input}...`);
    const location = get(currentUserLocation); // Read store value

    if (fromInput.location === null) {
        fromInput.location = await api.geocode(fromInput.input, location);
    }
    if (toInput.location === null) {
        toInput.location = await api.geocode(toInput.input, location);
    }

    if (!fromInput.location) {
        alert(`Could not find coords for ${fromInput.input}`);
        return;
    }
    if (!toInput.location) {
        alert(`Could not find coords for ${toInput.input}`);
        return;
    }
    const profile = get(currentRoutingProfile); // Read store value
    if (profile === undefined) {
        alert(`Please select a routing profile.`);
        return;
    }

    console.log(`Fetched coords ${fromInput.location} -> ${toInput.location}`);
    loadingRoute.set(true); // Use .set() for writable store

    try {
        const response = await api.fetchRoutingAPI(fromInput.location, toInput.location, profile);
        pathGeoJson.set(response.geojson); // Use .set() for writable store
        // turnInstructions is $state, direct assignment is fine if replacing array
        turnInstructions.length = 0; // Clear existing
        turnInstructions.push(...response.turnInstructions); // Add new ones

        const geojson = get(pathGeoJson); // Read store value
        if (geojson && geojson.features.length > 0) {
            const geometry = geojson.features[0].geometry;
            if (geometry.type !== "LineString") {
                console.error("Route geometry is not a LineString");
                loadingRoute.set(false); // Use .set() for writable store
                return;
            }
            const lineString = geometry as LineString;
            const boundsPaddingPercent = 0.2;
            const bounds = util.getBoundsFromPath(lineString, boundsPaddingPercent);
            currentBounds.set(bounds); // Use .set() for writable store
            console.log(`Setting bounds to ${bounds}`);

            appState.set("DisplayingRoute"); // Use .set() for writable store
        } else {
            console.warn("No route features found in response.");
        }
    } catch (error) {
        console.error("Error fetching route:", error);
        alert("Failed to calculate route. Please try again.");
    } finally {
        loadingRoute.set(false); // Use .set() for writable store
    }
}

export function setupGeolocationWatch() {
    if (get(gpsWatchId) !== null) { // Read store value
        return;
    }

    if (navigator.geolocation) {
        const options: PositionOptions = { // Use const
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 1000,
        };
        const watchId = navigator.geolocation.watchPosition(
            (position: GeolocationPosition) => {
                const location = get(currentUserLocation);
                // in dev mode, let's ignore the GPS to allow us to drag for simulation
                if (dev && location !== undefined) {
                    return;
                }

                loadingGps.set(false);

                const newLocation: LngLatLike = [position.coords.longitude, position.coords.latitude];
                currentUserLocation.set(newLocation);
                if (position.coords.heading !== null) {
                    currentUserBearing.set(position.coords.heading);
                }

                handleUserLocationChanged(newLocation); // Pass the actual value
            },
            undefined,
            options,
        );
        gpsWatchId.set(watchId);
        loadingGps.set(true);
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

export function toHomeScreen() {
    appState.set("SearchingRoute"); // Use .set()

    const location = get(currentUserLocation); // Read store value
    if (location !== undefined) {
        cameraState.center = location; // $state object property mutation is fine
    }
    // cameraState is $state, direct property mutation is fine
    cameraState.zoom = DEFAULT_ZOOM;
    cameraState.bearing = 0;
    cameraState.pitch = 0;

    // fromInput is $state, direct property mutation is fine
    fromInput.input = "";
    fromInput.focused = false;
    fromInput.loadingSuggestion = false;
    fromInput.location = null;
    fromInput.suggestions = [];

    // toInput is $state, direct property mutation is fine
    toInput.input = "";
    toInput.focused = false;
    toInput.loadingSuggestion = false;
    toInput.location = null;
    toInput.suggestions = [];

    pathGeoJson.set(null); // Use .set()
    turnInstructions.length = 0; // Clear $state array
    currentBounds.set(undefined); // Use .set()

    const currentWakeLock = get(wakeLock); // Read store value
    if (currentWakeLock !== null) {
        currentWakeLock.release().then(() => wakeLock.set(null)); // Use .set() in callback
    }
    const currentGpsWatchId = get(gpsWatchId); // Read store value
    if (currentGpsWatchId !== null) {
        navigator.geolocation.clearWatch(currentGpsWatchId);
        gpsWatchId.set(null); // Use .set()
        loadingGps.set(false); // Use .set()
    }
}

export function startRouting() {
    setupGeolocationWatch(); // This function now handles store updates internally
    const currentWakeLock = get(wakeLock); // Read store value
    if (currentWakeLock === null) {
        util.requestWakeLock().then((wl) => wakeLock.set(wl)); // Use .set() in callback
    }

    appState.set("Routing"); // Use .set()
    const location = get(currentUserLocation); // Read store value
    if (location !== undefined) {
        cameraState.center = location; // $state object property mutation is fine
        handleUserLocationChanged(location); // update turn-by-turn, bearing, ...
    } else {
        // If no location yet, maybe center on the start of the route?
        const geojson = get(pathGeoJson); // Read store value
        if (geojson?.features?.[0]?.geometry?.type === "LineString") {
            const startCoord = geojson.features[0].geometry.coordinates[0];
            cameraState.center = [startCoord[0], startCoord[1]]; // $state object property mutation is fine
        }
    }

    // cameraState is $state, direct property mutation is fine
    cameraState.zoom = NAVIGATION_ZOOM;
    cameraState.pitch = 30;
}

export function finishRouting() {
    appState.set("FinishedRouting"); // Use .set()
    turnInstructions.length = 0; // Clear $state array
    pathGeoJson.set(null); // Use .set()

    // cameraState is $state, direct property mutation is fine
    cameraState.zoom = NAVIGATION_ZOOM; // Keep zoom level
    cameraState.bearing = 0; // Reset bearing
    cameraState.pitch = 0; // Reset pitch

    const currentWakeLock = get(wakeLock); // Read store value
    if (currentWakeLock !== null) {
        currentWakeLock.release().then(() => wakeLock.set(null)); // Use .set() in callback
    }
    const currentGpsWatchId = get(gpsWatchId); // Read store value
    if (currentGpsWatchId !== null) {
        navigator.geolocation.clearWatch(currentGpsWatchId);
        gpsWatchId.set(null); // Use .set()
        loadingGps.set(false); // Use .set()
    }
}

export function queryFromGeoposition() {
    setupGeolocationWatch(); // Handles store updates internally

    const location = get(currentUserLocation); // Read store value
    if (location === undefined) {
        // Wait a bit longer if GPS is still loading
        if (get(loadingGps)) { // Read store value
            setTimeout(queryFromGeoposition, 200);
        } else {
            alert("Could not get current location. Please ensure GPS is enabled and permissions are granted.");
        }
        return;
    }
    fromInput.input = "Current Location"; // Use a placeholder text
    fromInput.location = location; // Assign the read value
    fromInput.suggestions = []; // Clear suggestions
    fromInput.focused = false;
}

export function queryToGeoposition() {
    setupGeolocationWatch(); // Handles store updates internally

    const location = get(currentUserLocation); // Read store value
    if (location === undefined) {
        if (get(loadingGps)) { // Read store value
            setTimeout(queryToGeoposition, 200);
        } else {
            alert("Could not get current location. Please ensure GPS is enabled and permissions are granted.");
        }
        return;
    }
    toInput.input = "Current Location"; // Use a placeholder text
    toInput.location = location; // Assign the read value
    toInput.suggestions = []; // Clear suggestions
    toInput.focused = false;
}

export async function queryFromSuggestions() {
    // fromInput is $state, direct property access/mutation is fine
    if (!fromInput.input.trim()) {
        fromInput.suggestions = [];
        return;
    }
    console.log(`Querying from suggestion, input: ${fromInput.input}`);

    fromInput.loadingSuggestion = true;
    const locationFromStore = get(currentUserLocation); // Read store value
    try {
        const suggestions = await api.fetchSuggestions(fromInput.input, locationFromStore); // Use read value
        // fromInput is $state, direct property mutation is fine
        fromInput.suggestions = Array.from(suggestions.values());
    } catch (error) {
        console.error("Error while fetching suggestions:", error);
        fromInput.suggestions = []; // Clear suggestions on error
    } finally {
        fromInput.loadingSuggestion = false;
    }
}

export async function queryToSuggestions() {
    // toInput is $state, direct property access/mutation is fine
    if (!toInput.input.trim()) {
        toInput.suggestions = [];
        return;
    }
    console.log(`Querying to suggestion, input: ${toInput.input}`);

    toInput.loadingSuggestion = true;
    const locationFromStore = get(currentUserLocation); // Read store value
    try {
        const suggestions = await api.fetchSuggestions(toInput.input, locationFromStore); // Use read value
        // toInput is $state, direct property mutation is fine
        toInput.suggestions = Array.from(suggestions.values());
    } catch (error) {
        console.error("Error while fetching suggestions:", error);
        toInput.suggestions = []; // Clear suggestions on error
    } finally {
        toInput.loadingSuggestion = false;
    }
}

export function applyFromSuggestion(suggestion: api.Suggestion) {
    console.log(`Applying from suggestion: ${suggestion[0]}`);
    fromInput.input = suggestion[0];
    fromInput.location = suggestion[1];
    fromInput.focused = false;
    fromInput.suggestions = [];
}

export function applyToSuggestion(suggestion: api.Suggestion) {
    console.log(`Applying to suggestion: ${suggestion[0]}`);
    toInput.input = suggestion[0];
    toInput.location = suggestion[1];
    toInput.focused = false;
    toInput.suggestions = [];
}

export function handleFromFocus() {
    fromInput.focused = true;
    toInput.focused = false; // Ensure other input loses focus
}

export function handleToFocus() {
    toInput.focused = true;
    fromInput.focused = false; // Ensure other input loses focus
}

/**
 * Recalculates the route starting from the user's current location.
 * Updates the 'from' input and triggers the standard route calculation.
 * Resets the 'isOffPath' flag.
 */
export async function recalculateRouteFromCurrentLocation() {
    if (get(appState) !== "Routing") {
        return;
    }

    console.log('Recalculating route from current location...');
    const currentLocation = get(currentUserLocation);

    if (!currentLocation) {
        alert('Cannot recalculate route: Current location unknown.');
        // Optionally, try to query geoposition again?
        // queryFromGeoposition(); // This might show an alert if it fails too
        return;
    }

    // Update the 'from' input to the current location
    fromInput.input = 'Current Location'; // $state mutation
    fromInput.location = currentLocation; // $state mutation
    fromInput.suggestions = []; // $state mutation
    fromInput.focused = false; // $state mutation

    isOffPath.set(false);

    await calculateRoute();
    startRouting();
}
