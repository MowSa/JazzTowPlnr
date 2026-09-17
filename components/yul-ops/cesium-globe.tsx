'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { CESIUM_CDN_BASE, YUL } from '@/lib/yul-ops/constants';
import { airportByCode, MAP_CITIES } from '@/lib/yul-ops/airports';
import {
  advanceTrack,
  syncTracks,
  type AircraftTrack,
} from '@/lib/yul-ops/interpolate';
import type { FeedFreshnessContext } from '@/lib/yul-ops/freshness';
import { aircraftVisual } from '@/lib/yul-ops/visual';
import {
  flightLabel,
  formatAgo,
  formatFt,
  formatKm,
  routeLabel,
} from '@/lib/yul-ops/format';
import { flightPhase, flightPhaseLabel } from '@/lib/yul-ops/status';
import type { LiveAircraft } from '@/lib/yul-ops/types';

type CesiumNS = typeof import('cesium');
type Viewer = InstanceType<CesiumNS['Viewer']>;
type Cartesian2 = InstanceType<CesiumNS['Cartesian2']>;

const INBOUND = '#5ee0a0';
const OUTBOUND = '#5aa8ff';
const STALE = '#93a1b3';
const STALE_LABEL = ' · STALE';
const YUL_OVERVIEW_HEIGHT_M = 2_800_000;
const YUL_OVERVIEW_PITCH_DEG = -90;
const GLOBE_HEIGHT_M = 16_000_000;
const ZOOM_MIN_HEIGHT_M = 800;
const ZOOM_MAX_HEIGHT_M = 40_000_000;
const FOLLOW_RANGE_DEFAULT = 36_000;
const FOLLOW_RANGE_MIN = 4_000;
const FOLLOW_RANGE_MAX = 280_000;

export type GlobeHandle = {
  flyHome: () => void;
  flyYul: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setSceneMode: (mode: '2D' | '3D') => void;
};

function ensureCss() {
  const href = `${CESIUM_CDN_BASE}Widgets/widgets.css`;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

async function loadCesium() {
  (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
    CESIUM_CDN_BASE;
  ensureCss();
  return import('cesium');
}

const iconCache = new Map<string, HTMLCanvasElement>();

function aircraftIcon(fill: string, selected: boolean) {
  const key = `${fill}:${selected}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.translate(64, 64);
  if (selected) {
    ctx.shadowColor = 'rgba(255,255,255,0.7)';
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = selected ? '#ffffff' : fill;
  ctx.strokeStyle = selected ? 'rgba(255,255,255,0.95)' : 'rgba(6,10,18,0.55)';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.bezierCurveTo(5, -36, 6.2, -22, 6.4, -10);
  ctx.lineTo(7.2, 2);
  ctx.lineTo(40, 16);
  ctx.quadraticCurveTo(44, 18.5, 42, 22);
  ctx.lineTo(7.4, 14);
  ctx.lineTo(6.6, 24);
  ctx.lineTo(16, 36);
  ctx.quadraticCurveTo(18, 39, 15, 40);
  ctx.lineTo(0, 32);
  ctx.lineTo(-15, 40);
  ctx.quadraticCurveTo(-18, 39, -16, 36);
  ctx.lineTo(-6.6, 24);
  ctx.lineTo(-7.4, 14);
  ctx.lineTo(-42, 22);
  ctx.quadraticCurveTo(-44, 18.5, -40, 16);
  ctx.lineTo(-7.2, 2);
  ctx.lineTo(-6.4, -10);
  ctx.bezierCurveTo(-6.2, -22, -5, -36, 0, -42);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.fillStyle = selected
    ? 'rgba(255,255,255,0.55)'
    : 'rgba(255,255,255,0.22)';
  ctx.fillRect(-2.1, -28, 4.2, 48);
  iconCache.set(key, canvas);
  return canvas;
}

const cssColorCache = new Map<string, InstanceType<CesiumNS['Color']>>();

function cssColor(Cesium: CesiumNS, css: string) {
  const cached = cssColorCache.get(css);
  if (cached) return cached;
  const color = Cesium.Color.fromCssColorString(css);
  cssColorCache.set(css, color);
  return color;
}

function cart(
  Cesium: CesiumNS,
  longitude: number,
  latitude: number,
  altitudeFt: number,
  result?: InstanceType<CesiumNS['Cartesian3']>,
) {
  return Cesium.Cartesian3.fromDegrees(
    longitude,
    latitude,
    Math.max(120, altitudeFt * 0.3048),
    Cesium.Ellipsoid.WGS84,
    result,
  );
}

type GlobeEntityPair = {
  body: InstanceType<CesiumNS['Entity']>;
  trail: InstanceType<CesiumNS['Entity']>;
  arc: InstanceType<CesiumNS['Entity']>;
  scratch: InstanceType<CesiumNS['Cartesian3']>;
  position: InstanceType<CesiumNS['ConstantPositionProperty']>;
  rotation: InstanceType<CesiumNS['ConstantProperty']>;
  scale: InstanceType<CesiumNS['ConstantProperty']>;
  image: InstanceType<CesiumNS['ConstantProperty']>;
  labelText: InstanceType<CesiumNS['ConstantProperty']>;
  labelShow: InstanceType<CesiumNS['ConstantProperty']>;
  labelFont: InstanceType<CesiumNS['ConstantProperty']>;
  trailPositions: InstanceType<CesiumNS['ConstantProperty']>;
  trailShow: InstanceType<CesiumNS['ConstantProperty']>;
  trailWidth: InstanceType<CesiumNS['ConstantProperty']>;
  trailMaterial: InstanceType<CesiumNS['PolylineOutlineMaterialProperty']>;
  arcPositions: InstanceType<CesiumNS['ConstantProperty']>;
  arcShow: InstanceType<CesiumNS['ConstantProperty']>;
  arcWidth: InstanceType<CesiumNS['ConstantProperty']>;
  arcMaterial: InstanceType<CesiumNS['PolylineOutlineMaterialProperty']>;
  styleKey?: string;
  trailStyleKey?: string;
  arcStyleKey?: string;
};

function yulDestination(Cesium: CesiumNS, heightM: number) {
  return Cesium.Cartesian3.fromDegrees(YUL.longitude, YUL.latitude, heightM);
}

function releaseCamera(Cesium: CesiumNS | null, viewer: Viewer) {
  viewer.trackedEntity = undefined;
  if (!Cesium) return;
  if (viewer.scene.mode === Cesium.SceneMode.MORPHING) return;
  if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) return;
  const camera = viewer.camera;
  if (
    Cesium.Matrix4.equalsEpsilon(
      camera.transform,
      Cesium.Matrix4.IDENTITY,
      Cesium.Math.EPSILON8,
    )
  ) {
    return;
  }
  const position = Cesium.Cartesian3.clone(camera.positionWC);
  const direction = Cesium.Cartesian3.clone(camera.directionWC);
  const up = Cesium.Cartesian3.clone(camera.upWC);
  camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  camera.position = position;
  camera.direction = direction;
  camera.up = up;
}

function yulNadirView(Cesium: CesiumNS, heightM: number) {
  return {
    destination: yulDestination(Cesium, heightM),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(YUL_OVERVIEW_PITCH_DEG),
      roll: 0,
    },
  };
}

function followAircraft(
  Cesium: CesiumNS,
  viewer: Viewer,
  position: InstanceType<CesiumNS['Cartesian3']>,
  headingDeg: number,
  rangeM: number,
) {
  viewer.camera.lookAt(
    position,
    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(headingDeg),
      Cesium.Math.toRadians(-28),
      rangeM,
    ),
  );
}

function adjustFollowRange(range: number, inward: boolean) {
  const next = range * (inward ? 0.72 : 1.32);
  return Math.min(FOLLOW_RANGE_MAX, Math.max(FOLLOW_RANGE_MIN, next));
}

function configureGlobeControls(Cesium: CesiumNS, viewer: Viewer) {
  const controller = viewer.scene.screenSpaceCameraController;
  controller.enableInputs = true;
  controller.enableRotate = true;
  controller.enableZoom = true;
  controller.enableTilt = true;
  controller.enableLook = true;
  controller.enableTranslate = true;
  controller.enableCollisionDetection = true;
  controller.maximumTiltAngle = undefined;
  controller.inertiaSpin = 0.9;
  controller.inertiaTranslate = 0.9;
  controller.inertiaZoom = 0.8;
  controller.minimumZoomDistance = 1;
  controller.maximumZoomDistance = Number.POSITIVE_INFINITY;
  controller.rotateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
  controller.translateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
  controller.zoomEventTypes = [
    Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.PINCH,
  ];
  controller.tiltEventTypes = [
    Cesium.CameraEventType.RIGHT_DRAG,
    Cesium.CameraEventType.MIDDLE_DRAG,
    Cesium.CameraEventType.PINCH,
  ];
  viewer.scene.canvas.addEventListener('contextmenu', (event) =>
    event.preventDefault(),
  );
}

function placeInitialYulView(Cesium: CesiumNS, viewer: Viewer) {
  viewer.camera.setView(yulNadirView(Cesium, YUL_OVERVIEW_HEIGHT_M));
}

function flyToOverview(
  Cesium: CesiumNS,
  viewer: Viewer,
  heightM: number,
  duration: number,
) {
  releaseCamera(Cesium, viewer);
  viewer.camera.cancelFlight();
  viewer.camera.flyTo({
    ...yulNadirView(Cesium, heightM),
    duration,
    complete: () => releaseCamera(Cesium, viewer),
    cancel: () => releaseCamera(Cesium, viewer),
  });
}

function flyToGlobe(Cesium: CesiumNS, viewer: Viewer, duration = 1.6) {
  releaseCamera(Cesium, viewer);
  viewer.camera.cancelFlight();
  viewer.camera.flyTo({
    destination: yulDestination(Cesium, GLOBE_HEIGHT_M),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
    duration,
    complete: () => releaseCamera(Cesium, viewer),
    cancel: () => releaseCamera(Cesium, viewer),
  });
}

function zoomByHeight(Cesium: CesiumNS, viewer: Viewer, inward: boolean) {
  if (viewer.scene.mode === Cesium.SceneMode.MORPHING) return;
  releaseCamera(Cesium, viewer);
  viewer.camera.cancelFlight();
  const cartographic = viewer.camera.positionCartographic;
  const nextHeight = Math.min(
    ZOOM_MAX_HEIGHT_M,
    Math.max(
      ZOOM_MIN_HEIGHT_M,
      cartographic.height * (inward ? 0.72 : 1.38),
    ),
  );
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      nextHeight,
    ),
    orientation: {
      heading: viewer.camera.heading,
      pitch: viewer.camera.pitch,
      roll: viewer.camera.roll,
    },
  });
}

type ImageryLayerT = InstanceType<CesiumNS['ImageryLayer']>;

const NIGHT_LIGHTS_FADE_START_M = 1_400_000;
const NIGHT_LIGHTS_FADE_END_M = 5_000_000;
const NIGHT_LIGHTS_MAX_ALPHA = 0.7;

function styleAerialLayer(layer: ImageryLayerT) {
  layer.brightness = 0.74;
  layer.saturation = 0.52;
  layer.contrast = 1.18;
  layer.gamma = 0.94;
  layer.hue = 0.02;
}

function esriAerialProvider(Cesium: CesiumNS) {
  return new Cesium.UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maximumLevel: 19,
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('imagery timeout')),
      ms,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function createAerialLayer(Cesium: CesiumNS, useIon: boolean) {
  if (useIon) {
    try {
      const provider = await withTimeout(
        Cesium.createWorldImageryAsync({
          style: Cesium.IonWorldImageryStyle.AERIAL,
        }),
        8_000,
      );
      const layer = new Cesium.ImageryLayer(provider);
      styleAerialLayer(layer);
      return layer;
    } catch (error) {
      console.warn(
        'Cesium ion World Imagery unavailable, using Esri World Imagery',
        error,
      );
    }
  }
  const layer = new Cesium.ImageryLayer(esriAerialProvider(Cesium));
  styleAerialLayer(layer);
  return layer;
}

function addNightLightsOverlay(Cesium: CesiumNS, viewer: Viewer) {
  try {
    const lights = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
        credit: 'NASA GIBS VIIRS',
        maximumLevel: 8,
      }),
    );
    lights.brightness = 1.12;
    lights.saturation = 0.65;
    lights.alpha = 0;
    lights.show = false;
    return lights;
  } catch {
    return undefined;
  }
}

function nightLightsAlpha(heightM: number) {
  if (heightM <= NIGHT_LIGHTS_FADE_START_M) return 0;
  if (heightM >= NIGHT_LIGHTS_FADE_END_M) return NIGHT_LIGHTS_MAX_ALPHA;
  return (
    NIGHT_LIGHTS_MAX_ALPHA *
    ((heightM - NIGHT_LIGHTS_FADE_START_M) /
      (NIGHT_LIGHTS_FADE_END_M - NIGHT_LIGHTS_FADE_START_M))
  );
}

function updateNightLights(layer: ImageryLayerT | undefined, heightM: number) {
  if (!layer) return;
  const alpha = nightLightsAlpha(heightM);
  if (Math.abs(layer.alpha - alpha) < 0.012) return;
  layer.alpha = alpha;
  layer.show = alpha > 0.02;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tooltipHtml(aircraft: LiveAircraft, stale = false) {
  const rows: Array<[string, string]> = [];
  const route = routeLabel(aircraft.origin, aircraft.destination);
  if (aircraft.callsign && aircraft.callsign !== flightLabel(aircraft)) {
    rows.push(['Callsign', aircraft.callsign]);
  }
  if (aircraft.aircraftType) rows.push(['Type', aircraft.aircraftType]);
  const distance = formatKm(aircraft.distanceFromYulKm);
  if (distance) rows.push(['From YUL', distance]);
  if (aircraft.lastUpdated)
    rows.push(['Updated', formatAgo(aircraft.lastUpdated)]);
  const phase = stale
    ? 'STALE — position frozen'
    : flightPhaseLabel(flightPhase(aircraft));
  return `
    <div class="yul-globe-tip-head">
      <strong>${escapeHtml(flightLabel(aircraft))}</strong>
      <span>${escapeHtml(phase)}</span>
    </div>
    ${route ? `<div class="yul-globe-tip-route">${escapeHtml(route)}</div>` : ''}
    <dl class="yul-globe-tip-meta">
      ${rows
        .map(
          ([label, value]) =>
            `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`,
        )
        .join('')}
    </dl>
  `;
}

function flightIdFromPick(
  picked: { id?: { id?: string } | string } | undefined,
) {
  const raw = typeof picked?.id === 'string' ? picked.id : picked?.id?.id;
  if (!raw || raw === 'yul-airport' || raw.startsWith('city-'))
    return undefined;
  return String(raw).replace(/-trail$|-arc$/, '');
}

function flightIdAt(scene: Viewer['scene'], position: Cartesian2) {
  const stacked = scene.drillPick(position, 12) as Array<{
    id?: { id?: string } | string;
  }>;
  for (const item of stacked) {
    const id = flightIdFromPick(item);
    if (id) return id;
  }
  return undefined;
}

function hideTooltip(el: HTMLDivElement | null) {
  if (!el) return;
  el.hidden = true;
}

function showTooltip(
  el: HTMLDivElement | null,
  wrap: HTMLDivElement | null,
  aircraft: LiveAircraft,
  x: number,
  y: number,
  stale = false,
) {
  if (!el || !wrap) return;
  el.innerHTML = tooltipHtml(aircraft, stale);
  el.hidden = false;
  const pad = 12;
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const maxX = wrap.clientWidth - width - pad;
  const maxY = wrap.clientHeight - height - pad;
  el.style.left = `${Math.max(pad, Math.min(x + 16, maxX))}px`;
  el.style.top = `${Math.max(pad, Math.min(y + 16, maxY))}px`;
}

export const CesiumGlobe = forwardRef<
  GlobeHandle,
  {
    aircraft: LiveAircraft[];
    feed?: FeedFreshnessContext | null;
    selectedId: string | null;
    follow: boolean;
    trails: boolean;
    showRoute: boolean;
    onSelect: (id: string | null) => void;
  }
>(function CesiumGlobe(
  { aircraft, feed, selectedId, follow, trails, showRoute, onSelect },
  ref,
) {
  const [startupError, setStartupError] = useState<string | null>(null);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const cesiumRef = useRef<CesiumNS | null>(null);
  const tracks = useRef(new Map<string, AircraftTrack>());
  const entities = useRef(new Map<string, GlobeEntityPair>());
  const aircraftRef = useRef(aircraft);
  const feedRef = useRef(feed);
  const selectedRef = useRef(selectedId);
  const followRef = useRef(follow);
  const trailsRef = useRef(trails);
  const routeRef = useRef(showRoute);
  const onSelectRef = useRef(onSelect);
  const followRangeRef = useRef(FOLLOW_RANGE_DEFAULT);

  useEffect(() => {
    aircraftRef.current = aircraft;
    feedRef.current = feed;
    selectedRef.current = selectedId;
    followRef.current = follow;
    trailsRef.current = trails;
    routeRef.current = showRoute;
    onSelectRef.current = onSelect;
  }, [aircraft, feed, selectedId, follow, trails, showRoute, onSelect]);

  useImperativeHandle(ref, () => ({
    flyHome() {
      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;
      if (viewer && Cesium) flyToGlobe(Cesium, viewer);
    },
    flyYul() {
      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;
      if (viewer && Cesium)
        flyToOverview(Cesium, viewer, YUL_OVERVIEW_HEIGHT_M, 1.6);
    },
    zoomIn() {
      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;
      if (!viewer || !Cesium) return;
      if (followRef.current) {
        followRangeRef.current = adjustFollowRange(
          followRangeRef.current,
          true,
        );
        return;
      }
      zoomByHeight(Cesium, viewer, true);
    },
    zoomOut() {
      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;
      if (!viewer || !Cesium) return;
      if (followRef.current) {
        followRangeRef.current = adjustFollowRange(
          followRangeRef.current,
          false,
        );
        return;
      }
      zoomByHeight(Cesium, viewer, false);
    },
    setSceneMode(mode) {
      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;
      if (!viewer || !Cesium) return;
      releaseCamera(Cesium, viewer);
      if (mode === '2D' && viewer.scene.mode !== Cesium.SceneMode.SCENE2D) {
        viewer.scene.morphTo2D(1.2);
      } else if (
        mode === '3D' &&
        viewer.scene.mode !== Cesium.SceneMode.SCENE3D
      ) {
        viewer.scene.morphTo3D(1.2);
      }
    },
  }));

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;
    viewer.scene.screenSpaceCameraController.enableZoom = !follow;
    if (follow) {
      followRangeRef.current = FOLLOW_RANGE_DEFAULT;
      return;
    }
    releaseCamera(Cesium, viewer);
  }, [follow, selectedId]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let input: InstanceType<CesiumNS['ScreenSpaceEventHandler']> | undefined;
    let viewer: Viewer | null = null;
    let resizeObserver: ResizeObserver | undefined;
    const entityMap = entities.current;
    const trackMap = tracks.current;

    void (async () => {
      try {
        if (!root.current) return;
        const Cesium = await loadCesium();
        if (cancelled || !root.current) return;
        cesiumRef.current = Cesium;
        let useIon = false;
        try {
          const tokenResponse = await fetch('/api/cesium/token', {
            cache: 'no-store',
          });
          const tokenJson = (await tokenResponse.json()) as {
            token?: string | null;
          };
          if (tokenJson.token) {
            Cesium.Ion.defaultAccessToken = tokenJson.token;
            useIon = true;
          }
        } catch {
          /* Ion remains optional. */
        }

        const aerial = await createAerialLayer(Cesium, useIon);
        if (cancelled || !root.current) {
          aerial.destroy();
          return;
        }
        const map = new Cesium.Viewer(root.current, {
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          baseLayer: aerial,
          contextOptions: { webgl: { preserveDrawingBuffer: true } },
        });
        viewer = map;
        if (cancelled) {
          map.destroy();
          viewer = null;
          return;
        }
        map.scene.globe.baseColor = Cesium.Color.fromCssColorString('#071018');
        map.scene.backgroundColor = Cesium.Color.fromCssColorString('#02040a');
        map.clock.currentTime = Cesium.JulianDate.fromIso8601(
          '2026-01-10T05:30:00Z',
        );
        map.clock.shouldAnimate = false;
        map.scene.globe.enableLighting = false;
        map.scene.globe.dynamicAtmosphereLighting = true;
        (
          map.scene.globe as { atmosphereLightIntensity?: number }
        ).atmosphereLightIntensity = 8;
        if (map.scene.skyAtmosphere) {
          map.scene.skyAtmosphere.show = true;
          map.scene.skyAtmosphere.hueShift = -0.04;
          map.scene.skyAtmosphere.saturationShift = -0.08;
          map.scene.skyAtmosphere.brightnessShift = -0.12;
        }
        map.scene.fog.enabled = true;
        map.scene.fog.density = 0.00018;
        const nightLights = addNightLightsOverlay(Cesium, map);
        updateNightLights(nightLights, map.camera.positionCartographic.height);
        map.entities.add({
          id: 'yul-airport',
          position: Cesium.Cartesian3.fromDegrees(
            YUL.longitude,
            YUL.latitude,
            120,
          ),
          ellipse: {
            semiMajorAxis: 28000,
            semiMinorAxis: 28000,
            material:
              Cesium.Color.fromCssColorString('#4ea2ff').withAlpha(0.16),
          },
          point: {
            pixelSize: 18,
            color: Cesium.Color.fromCssColorString('#9ad4ff'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: 'YUL\nMontréal',
            font: '600 13px Inter, sans-serif',
            pixelOffset: new Cesium.Cartesian2(0, -30),
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#071018cc'),
            backgroundPadding: new Cesium.Cartesian2(8, 6),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        for (const city of MAP_CITIES) {
          if (city.iata === 'YUL') continue;
          map.entities.add({
            id: `city-${city.iata}`,
            position: Cesium.Cartesian3.fromDegrees(
              city.longitude,
              city.latitude,
              40,
            ),
            label: {
              text: city.name,
              font: '500 12px Inter, sans-serif',
              fillColor: Cesium.Color.WHITE.withAlpha(0.72),
              pixelOffset: new Cesium.Cartesian2(0, -8),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              scaleByDistance: new Cesium.NearFarScalar(2e5, 1, 1.6e6, 0.2),
            },
          });
        }
        configureGlobeControls(Cesium, map);
        map.resize();
        placeInitialYulView(Cesium, map);
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          map.resize();
          placeInitialYulView(Cesium, map);
        });
        viewerRef.current = map;
        if (root.current) {
          resizeObserver = new ResizeObserver(() => {
            map.resize();
          });
          resizeObserver.observe(root.current);
        }

        input = new Cesium.ScreenSpaceEventHandler(map.scene.canvas);
        input.setInputAction((event: { position: Cartesian2 }) => {
          const flightId = flightIdAt(map.scene, event.position);
          // Clicking empty map clears the selection (and its overlay card).
          onSelectRef.current(flightId ?? null);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        const canvasPoint = (event: MouseEvent) => {
          const rect = map.scene.canvas.getBoundingClientRect();
          return new Cesium.Cartesian2(
            event.clientX - rect.left,
            event.clientY - rect.top,
          );
        };
        const onMouseMove = (event: MouseEvent) => {
          const flightId = flightIdAt(map.scene, canvasPoint(event));
          const track = flightId ? tracks.current.get(flightId) : undefined;
          const snapshot = track?.snapshot;
          if (!snapshot) {
            hideTooltip(tipRef.current);
            return;
          }
          const rect = wrapRef.current?.getBoundingClientRect();
          const x = rect ? event.clientX - rect.left : event.offsetX;
          const y = rect ? event.clientY - rect.top : event.offsetY;
          showTooltip(
            tipRef.current,
            wrapRef.current,
            snapshot,
            x,
            y,
            track?.stale,
          );
        };
        map.scene.canvas.addEventListener('mousemove', onMouseMove);
        map.scene.canvas.addEventListener('mouseleave', () =>
          hideTooltip(tipRef.current),
        );
        const onWheel = (event: WheelEvent) => {
          if (!followRef.current) return;
          event.preventDefault();
          followRangeRef.current = adjustFollowRange(
            followRangeRef.current,
            event.deltaY < 0,
          );
        };
        map.scene.canvas.addEventListener('wheel', onWheel, { passive: false });

        const tick = () => {
          if (cancelled) return;
          updateNightLights(
            nightLights,
            map.camera.positionCartographic.height,
          );
          const now = Date.now();
          syncTracks(
            tracks.current,
            aircraftRef.current,
            now,
            feedRef.current ?? undefined,
          );
          // Profile: scripts/profile-cesium-alloc.mjs — 24 aircraft × 120 frames,
          // new ConstantProperty/Position every frame was ~6× slower than setValue.
          for (const [id, track] of tracks.current) {
            const pose = advanceTrack(track, now, feedRef.current ?? undefined);
            let pair = entities.current.get(id);
            const selected = selectedRef.current === id;
            const stale = track.stale;
            const fill = stale
              ? STALE
              : track.snapshot.direction === 'INBOUND'
                ? INBOUND
                : OUTBOUND;
            const color = cssColor(Cesium, fill);
            const styleKey = `${stale}:${selected}:${track.snapshot.direction}`;
            const arrow =
              (track.snapshot.verticalSpeedFpm ?? 0) >= 0 ? '↑' : '↓';
            const compact = flightLabel(track.snapshot);
            const label =
              `${compact}\n${arrow} ${formatFt(track.snapshot.altitudeFt) || ''}${stale ? STALE_LABEL : ''}`.trim();
            if (!pair) {
              aircraftVisual(track.snapshot.aircraftType);
              const scratch = new Cesium.Cartesian3();
              cart(
                Cesium,
                pose.longitude,
                pose.latitude,
                pose.altitudeFt,
                scratch,
              );
              const position = new Cesium.ConstantPositionProperty(scratch);
              const rotation = new Cesium.ConstantProperty(
                Cesium.Math.toRadians(-pose.headingDeg),
              );
              const scale = new Cesium.ConstantProperty(selected ? 1.28 : 1);
              const image = new Cesium.ConstantProperty(
                aircraftIcon(fill, selected),
              );
              const labelText = new Cesium.ConstantProperty(label);
              const labelShow = new Cesium.ConstantProperty(
                stale || selected || aircraftRef.current.length <= 10,
              );
              const labelFont = new Cesium.ConstantProperty(
                selected
                  ? '600 12px Inter, sans-serif'
                  : '600 11px Inter, sans-serif',
              );
              const trailPositions = new Cesium.ConstantProperty([]);
              const trailShow = new Cesium.ConstantProperty(false);
              const trailWidth = new Cesium.ConstantProperty(
                selected ? 4.2 : 2.8,
              );
              const trailMaterial = new Cesium.PolylineOutlineMaterialProperty({
                color: color.withAlpha(selected ? 0.95 : 0.78),
                outlineWidth: 1,
                outlineColor: cssColor(Cesium, '#071018').withAlpha(0.45),
              });
              const arcPositions = new Cesium.ConstantProperty([]);
              const arcShow = new Cesium.ConstantProperty(false);
              const arcWidth = new Cesium.ConstantProperty(
                selected ? 3.4 : 2.2,
              );
              const arcMaterial = new Cesium.PolylineOutlineMaterialProperty({
                color: color.withAlpha(selected ? 0.7 : 0.42),
                outlineWidth: 1,
                outlineColor: cssColor(Cesium, '#071018').withAlpha(0.35),
              });
              const body = map.entities.add({
                id,
                position,
                billboard: {
                  image,
                  width: 38,
                  height: 38,
                  rotation,
                  scale,
                  alignedAxis: Cesium.Cartesian3.UNIT_Z,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
                label: {
                  text: labelText,
                  font: labelFont,
                  show: labelShow,
                  pixelOffset: new Cesium.Cartesian2(0, 26),
                  fillColor: Cesium.Color.WHITE,
                  showBackground: true,
                  backgroundColor: Cesium.Color.fromCssColorString('#071018d6'),
                  backgroundPadding: new Cesium.Cartesian2(7, 4),
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                  scaleByDistance: new Cesium.NearFarScalar(
                    8e4,
                    1,
                    1.5e6,
                    0.25,
                  ),
                },
              });
              const trail = map.entities.add({
                id: `${id}-trail`,
                polyline: {
                  positions: trailPositions,
                  show: trailShow,
                  width: trailWidth,
                  material: trailMaterial,
                  arcType: Cesium.ArcType.GEODESIC,
                },
              });
              const arc = map.entities.add({
                id: `${id}-arc`,
                polyline: {
                  positions: arcPositions,
                  show: arcShow,
                  width: arcWidth,
                  material: arcMaterial,
                  arcType: Cesium.ArcType.GEODESIC,
                },
              });
              pair = {
                body,
                trail,
                arc,
                scratch,
                position,
                rotation,
                scale,
                image,
                labelText,
                labelShow,
                labelFont,
                trailPositions,
                trailShow,
                trailWidth,
                trailMaterial,
                arcPositions,
                arcShow,
                arcWidth,
                arcMaterial,
                styleKey,
                trailStyleKey: styleKey,
                arcStyleKey: styleKey,
              };
              entities.current.set(id, pair);
            }
            cart(
              Cesium,
              pose.longitude,
              pose.latitude,
              pose.altitudeFt,
              pair.scratch,
            );
            pair.position.setValue(pair.scratch);
            pair.rotation.setValue(Cesium.Math.toRadians(-pose.headingDeg));
            pair.labelText.setValue(label);
            pair.labelShow.setValue(
              stale || selected || aircraftRef.current.length <= 10,
            );
            if (pair.styleKey !== styleKey) {
              pair.image.setValue(aircraftIcon(fill, selected));
              pair.scale.setValue(selected ? 1.28 : 1);
              pair.labelFont.setValue(
                selected
                  ? '600 12px Inter, sans-serif'
                  : '600 11px Inter, sans-serif',
              );
              pair.styleKey = styleKey;
            }
            const origin = airportByCode(track.snapshot.origin);
            const destination = airportByCode(track.snapshot.destination);
            const here = Cesium.Cartesian3.clone(pair.scratch);
            const flown = origin
              ? [cart(Cesium, origin.longitude, origin.latitude, 800), here]
              : trailsRef.current
                ? track.trail.map((sample) =>
                    cart(
                      Cesium,
                      sample.longitude,
                      sample.latitude,
                      sample.altitudeFt,
                    ),
                  )
                : [];
            const showTrail = trailsRef.current && flown.length >= 2;
            pair.trailShow.setValue(showTrail);
            pair.trailPositions.setValue(flown);
            if (pair.trailStyleKey !== styleKey) {
              pair.trailStyleKey = styleKey;
              pair.trailWidth.setValue(selected ? 4.2 : 2.8);
              pair.trailMaterial.color = new Cesium.ConstantProperty(
                color.withAlpha(selected ? 0.95 : 0.78),
              );
            }
            const showArc = Boolean(routeRef.current && destination);
            pair.arcShow.setValue(showArc);
            if (destination) {
              pair.arcPositions.setValue([
                here,
                cart(Cesium, destination.longitude, destination.latitude, 800),
              ]);
            }
            if (pair.arcStyleKey !== styleKey) {
              pair.arcStyleKey = styleKey;
              pair.arcWidth.setValue(selected ? 3.4 : 2.2);
              pair.arcMaterial.color = new Cesium.ConstantProperty(
                color.withAlpha(selected ? 0.7 : 0.42),
              );
            }
          }
          for (const [id, pair] of entities.current) {
            if (tracks.current.has(id)) continue;
            map.entities.remove(pair.body);
            map.entities.remove(pair.trail);
            map.entities.remove(pair.arc);
            entities.current.delete(id);
          }
          if (followRef.current && selectedRef.current) {
            const track = tracks.current.get(selectedRef.current);
            if (track?.pose) {
              followAircraft(
                Cesium,
                map,
                Cesium.Cartesian3.fromDegrees(
                  track.pose.longitude,
                  track.pose.latitude,
                  Math.max(120, track.pose.altitudeFt * 0.3048),
                ),
                track.pose.headingDeg,
                followRangeRef.current,
              );
            }
          }
          frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
      } catch (error) {
        console.error('Cesium failed to start', error);
        if (!cancelled)
          setStartupError(
            error instanceof Error ? error.message : 'Cesium failed to load',
          );
      }
    })();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      input?.destroy();
      resizeObserver?.disconnect();
      viewer?.destroy();
      viewer = null;
      viewerRef.current = null;
      entityMap.clear();
      trackMap.clear();
    };
  }, [startupAttempt]);

  if (startupError) {
    return (
      <div ref={wrapRef} className="yul-globe-wrap">
        <div className="yul-globe-fallback">
          <strong>Globe failed to start</strong>
          <span>{startupError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setStartupError(null);
              setStartupAttempt((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div ref={wrapRef} className="yul-globe-wrap">
      <div ref={root} className="yul-globe-canvas" />
      <div ref={tipRef} className="yul-globe-tip" hidden />
    </div>
  );
});
