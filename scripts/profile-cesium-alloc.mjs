/**
 * One-session profile of per-frame Cesium property allocations
 * matching components/yul-ops/cesium-globe.tsx tick updates.
 */
import {
  Cartesian3,
  Color,
  ConstantProperty,
  ConstantPositionProperty,
  PolylineOutlineMaterialProperty,
} from '@cesium/engine';

const AIRCRAFT = 24;
const FRAMES = 120;
const LON = -73.74;
const LAT = 45.47;

function currentPattern() {
  const start = performance.now();
  for (let f = 0; f < FRAMES; f++) {
    for (let i = 0; i < AIRCRAFT; i++) {
      const color = Color.fromCssColorString(i % 2 ? '#5ee0a0' : '#5aa8ff');
      const position = Cartesian3.fromDegrees(LON + i * 0.01, LAT, 3000 + f);
      const rotation = new ConstantProperty((-i + f) * 0.01);
      const labelText = new ConstantProperty(`QK${i}\n↑ 9,000`);
      const labelShow = new ConstantProperty(true);
      const labelFont = new ConstantProperty('600 11px Inter, sans-serif');
      const posProp = new ConstantPositionProperty(position);
      const flown = [Cartesian3.fromDegrees(LON, LAT, 800), position];
      const trailPos = new ConstantProperty(flown);
      const arcPos = new ConstantProperty([
        position,
        Cartesian3.fromDegrees(LON + 1, LAT + 1, 800),
      ]);
      void color;
      void rotation;
      void labelText;
      void labelShow;
      void labelFont;
      void posProp;
      void trailPos;
      void arcPos;
      if (f === 0) {
        void new PolylineOutlineMaterialProperty({
          color: color.withAlpha(0.78),
          outlineWidth: 1,
          outlineColor: Color.fromCssColorString('#071018').withAlpha(0.45),
        });
      }
    }
  }
  return performance.now() - start;
}

function reusedPattern() {
  const crafts = Array.from({ length: AIRCRAFT }, (_, i) => {
    const scratch = new Cartesian3();
    Cartesian3.fromDegrees(LON + i * 0.01, LAT, 3000, undefined, scratch);
    const color = Color.fromCssColorString(i % 2 ? '#5ee0a0' : '#5aa8ff');
    return {
      scratch,
      origin: Cartesian3.fromDegrees(LON, LAT, 800),
      dest: Cartesian3.fromDegrees(LON + 1, LAT + 1, 800),
      color,
      position: new ConstantPositionProperty(scratch),
      rotation: new ConstantProperty(0),
      labelText: new ConstantProperty(''),
      labelShow: new ConstantProperty(true),
      labelFont: new ConstantProperty('600 11px Inter, sans-serif'),
      trailPos: new ConstantProperty([]),
      arcPos: new ConstantProperty([]),
      material: new PolylineOutlineMaterialProperty({
        color: color.withAlpha(0.78),
        outlineWidth: 1,
        outlineColor: Color.fromCssColorString('#071018').withAlpha(0.45),
      }),
    };
  });
  const start = performance.now();
  for (let f = 0; f < FRAMES; f++) {
    for (let i = 0; i < AIRCRAFT; i++) {
      const c = crafts[i];
      Cartesian3.fromDegrees(
        LON + i * 0.01,
        LAT,
        3000 + f,
        undefined,
        c.scratch,
      );
      c.position.setValue(c.scratch);
      c.rotation.setValue((-i + f) * 0.01);
      c.labelText.setValue(`QK${i}\n↑ 9,000`);
      c.labelShow.setValue(true);
      c.trailPos.setValue([c.origin, c.scratch]);
      c.arcPos.setValue([c.scratch, c.dest]);
    }
  }
  return performance.now() - start;
}

const alloc = currentPattern();
const reuse = reusedPattern();
const alloc2 = currentPattern();
const reuse2 = reusedPattern();
const report = {
  aircraft: AIRCRAFT,
  frames: FRAMES,
  wrappersPerFrame:
    AIRCRAFT *
    (1 +
      /* Color */ 1 +
      /* Cartesian3 pos */ 1 /* ConstantPosition */ +
      4 /* label/rotation ConstantProperty */ +
      2 /* trail+arc ConstantProperty */ +
      3) /* extra Cartesian3 for origin/arc dest */,
  currentMs: Number(((alloc + alloc2) / 2).toFixed(2)),
  reusedMs: Number(((reuse + reuse2) / 2).toFixed(2)),
};
report.speedup = Number(
  (report.currentMs / Math.max(0.01, report.reusedMs)).toFixed(2),
);
console.log(JSON.stringify(report, null, 2));
if (report.currentMs > report.reusedMs * 1.5) {
  console.log('COST_REAL: reuse ConstantProperty/materials');
} else {
  console.log('COST_LOW: skip reuse');
}
