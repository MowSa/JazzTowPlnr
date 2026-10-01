export const kindLabel = {
  'same-area': 'Same-area',
  gate: 'Gate change',
  'bse-in': 'To BSE',
  'bse-out': 'From BSE',
  long: 'Long stay',
  manual: 'Manual',
  none: 'No tow',
  incomplete: 'Missing data',
};
export const shortFlight = (s: string) => s.replace(/^QK\s*/, '');
