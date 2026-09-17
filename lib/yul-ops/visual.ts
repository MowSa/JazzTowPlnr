import { CESIUM_CDN_BASE, CESIUM_VERSION } from './constants.ts';

export { CESIUM_CDN_BASE, CESIUM_VERSION };

export function aircraftVisual(aircraftType?: string) {
  return {
    kind: 'billboard' as const,
    image: '/yul-ops/aircraft.svg',
    type: aircraftType,
    modelUri: undefined as string | undefined,
  };
}
