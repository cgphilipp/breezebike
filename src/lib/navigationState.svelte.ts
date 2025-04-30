import type * as api from "$lib/apis";
import { type LngLatLike, type LngLatBoundsLike } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { writable } from "svelte/store";

// --- Types ---

export type InputField = {
    input: string;
    focused: boolean;
    loadingSuggestion: boolean;
    location: LngLatLike | null; // not null if cached from autocompletion / current user geo location
    suggestions: Array<api.Suggestion>;
};

export type CameraState = {
    center: LngLatLike;
    zoom: number;
    bearing: number;
    pitch: number;
};

export type AppState = "SearchingRoute" | "DisplayingRoute" | "Routing" | "FinishedRouting";

// --- Constants ---

export const DEFAULT_ZOOM = 12;
export const NAVIGATION_ZOOM = 17;
export const MAX_ZOOM = 18;
export const OFF_PATH_THRESHOLD_METERS = 50; // Threshold in meters
export const colors = {
    primary: '#F34213',
    primaryLight: '#E0CA3C',
    secondary: '#3E2F5B',
    green: '#136F63',
    black: '#000F08',
    offwhite: '#EEEEEE'
};


// --- Shared State ---

// Use $state for objects/arrays where properties are mutated
export const cameraState: CameraState = $state({
    center: [10.840601938197864, 49.971698275409054], // Default center
    zoom: 5, // Default zoom
    bearing: 0,
    pitch: 0,
});

export const turnInstructions: Array<api.TurnInstruction> = $state([]);

export const fromInput: InputField = $state({
    input: '',
    focused: false,
    loadingSuggestion: false,
    location: null,
    suggestions: [],
});

export const toInput: InputField = $state({
    input: '',
    focused: false,
    loadingSuggestion: false,
    location: null,
    suggestions: [],
});

// Use writable stores for primitives or when replacing the whole value
export const appState = writable<AppState>("SearchingRoute");
export const currentRoutingProfile = writable<api.RoutingProfile | undefined>(undefined);
export const aboutModal = writable(false);
export const profileChooseModal = writable(true); // Start with profile selection
export const wakeLock = writable<WakeLockSentinel | null>(null);
export const pathGeoJson = writable<FeatureCollection | null>(null); // Also store as GeoJSON can be replaced entirely
export const turnDisplayString = writable("");
export const turnDisplayIconName = writable("");
export const currentBounds = writable<LngLatBoundsLike | undefined>(undefined);
export const currentUserLocation = writable<LngLatLike | undefined>(undefined);
export const currentUserBearing = writable(0);
export const gpsWatchId = writable<number | null>(null);
export const loadingRoute = writable(false);
export const loadingGps = writable(false);
export const isOffPath = writable(false); // NEW: State to track if user is off path
