export type Silhouette = 'turboprop' | 'rear-jet' | 'jet' | 'generic';

/**
 * Globe icon family from the ICAO type designator. Jazz flies Dash 8s
 * (DH8C/DH8D) and CRJs; E-Jets and mainline types fall back to a wing-engine jet.
 */
export function aircraftSilhouette(aircraftType?: string): Silhouette {
  const type = (aircraftType || '').trim().toUpperCase();
  if (!type) return 'generic';
  if (/^(DH8|AT[4-7]|SF34|SW4|B190|JS[34]|D328|F50)/.test(type)) return 'turboprop';
  if (/^(CRJ|CL6|GLF|F70|F100|E1[345]|B71|MD8|MD9|DC9)/.test(type)) return 'rear-jet';
  if (/^(E1[79]|E2|E75|E9|BCS|A2|A3|B3|B7|B73|B7[5-8])/.test(type)) return 'jet';
  return 'generic';
}
