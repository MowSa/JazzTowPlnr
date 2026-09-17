export type AirportRef = {
  iata: string;
  name: string;
  latitude: number;
  longitude: number;
};

const AIRPORTS: Record<string, AirportRef> = {
  YUL: { iata: 'YUL', name: 'Montréal', latitude: 45.470556, longitude: -73.740833 },
  CYUL: { iata: 'YUL', name: 'Montréal', latitude: 45.470556, longitude: -73.740833 },
  YYZ: { iata: 'YYZ', name: 'Toronto', latitude: 43.6772, longitude: -79.6306 },
  CYYZ: { iata: 'YYZ', name: 'Toronto', latitude: 43.6772, longitude: -79.6306 },
  YOW: { iata: 'YOW', name: 'Ottawa', latitude: 45.3225, longitude: -75.6692 },
  CYOW: { iata: 'YOW', name: 'Ottawa', latitude: 45.3225, longitude: -75.6692 },
  YQB: { iata: 'YQB', name: 'Québec', latitude: 46.7911, longitude: -71.3933 },
  CYQB: { iata: 'YQB', name: 'Québec', latitude: 46.7911, longitude: -71.3933 },
  YHZ: { iata: 'YHZ', name: 'Halifax', latitude: 44.8808, longitude: -63.5086 },
  CYHZ: { iata: 'YHZ', name: 'Halifax', latitude: 44.8808, longitude: -63.5086 },
  YYT: { iata: 'YYT', name: "St. John's", latitude: 47.6186, longitude: -52.7519 },
  YQM: { iata: 'YQM', name: 'Moncton', latitude: 46.1122, longitude: -64.6786 },
  YFC: { iata: 'YFC', name: 'Fredericton', latitude: 45.8689, longitude: -66.5372 },
  YYG: { iata: 'YYG', name: 'Charlottetown', latitude: 46.29, longitude: -63.1211 },
  YQY: { iata: 'YQY', name: 'Sydney', latitude: 46.1614, longitude: -60.0478 },
  YYR: { iata: 'YYR', name: 'Goose Bay', latitude: 53.3192, longitude: -60.4258 },
  YQX: { iata: 'YQX', name: 'Gander', latitude: 48.9369, longitude: -54.5681 },
  YWG: { iata: 'YWG', name: 'Winnipeg', latitude: 49.91, longitude: -97.2399 },
  YXE: { iata: 'YXE', name: 'Saskatoon', latitude: 52.1708, longitude: -106.6997 },
  YQR: { iata: 'YQR', name: 'Regina', latitude: 50.4319, longitude: -104.665 },
  YYC: { iata: 'YYC', name: 'Calgary', latitude: 51.1215, longitude: -114.0076 },
  YEG: { iata: 'YEG', name: 'Edmonton', latitude: 53.31, longitude: -113.5794 },
  YVR: { iata: 'YVR', name: 'Vancouver', latitude: 49.1947, longitude: -123.1792 },
  YYJ: { iata: 'YYJ', name: 'Victoria', latitude: 48.6469, longitude: -123.4258 },
  YXX: { iata: 'YXX', name: 'Abbotsford', latitude: 49.0253, longitude: -122.3606 },
  YTZ: { iata: 'YTZ', name: 'Toronto City', latitude: 43.6275, longitude: -79.3962 },
  YAM: { iata: 'YAM', name: 'Sault Ste. Marie', latitude: 46.485, longitude: -84.5094 },
  YQT: { iata: 'YQT', name: 'Thunder Bay', latitude: 48.3719, longitude: -89.3239 },
  YXU: { iata: 'YXU', name: 'London', latitude: 43.0356, longitude: -81.1539 },
  YKF: { iata: 'YKF', name: 'Kitchener', latitude: 43.4608, longitude: -80.3786 },
  YHM: { iata: 'YHM', name: 'Hamilton', latitude: 43.1736, longitude: -79.935 },
  YQG: { iata: 'YQG', name: 'Windsor', latitude: 42.2756, longitude: -82.9556 },
  BOS: { iata: 'BOS', name: 'Boston', latitude: 42.3656, longitude: -71.0096 },
  KBOS: { iata: 'BOS', name: 'Boston', latitude: 42.3656, longitude: -71.0096 },
  IAD: { iata: 'IAD', name: 'Washington', latitude: 38.9531, longitude: -77.4565 },
  KIAD: { iata: 'IAD', name: 'Washington', latitude: 38.9531, longitude: -77.4565 },
  EWR: { iata: 'EWR', name: 'Newark', latitude: 40.6895, longitude: -74.1745 },
  LGA: { iata: 'LGA', name: 'New York', latitude: 40.7769, longitude: -73.874 },
  JFK: { iata: 'JFK', name: 'New York', latitude: 40.6413, longitude: -73.7781 },
  DCA: { iata: 'DCA', name: 'Washington', latitude: 38.8512, longitude: -77.0402 },
  PHL: { iata: 'PHL', name: 'Philadelphia', latitude: 39.8721, longitude: -75.2411 },
  BTV: { iata: 'BTV', name: 'Burlington', latitude: 44.4719, longitude: -73.1533 },
  PWM: { iata: 'PWM', name: 'Portland', latitude: 43.6462, longitude: -70.3087 },
};

export const YUL_RUNWAYS = ['06L / 24R', '06R / 24L', '10 / 28'] as const;

export function airportByCode(code?: string) {
  if (!code) return undefined;
  return AIRPORTS[code.toUpperCase()];
}

export function airportName(code?: string) {
  return airportByCode(code)?.name;
}

export const MAP_CITIES: AirportRef[] = [
  AIRPORTS.YUL,
  AIRPORTS.YOW,
  AIRPORTS.YYZ,
  AIRPORTS.YQB,
  AIRPORTS.BOS,
  AIRPORTS.LGA,
];
