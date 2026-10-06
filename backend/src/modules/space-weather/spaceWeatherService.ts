import fs from 'fs';
import path from 'path';
import { logger } from '../../shared/logger';
import { config } from '../../config';

export interface SpaceWeatherStatus {
  source: string;
  retrievedAt: string;
  kpIndex: number | null;
  geomagneticStormLevel: string;
  solarRadiationLevel: string;
  radioBlackoutLevel: string;
  status: 'live' | 'cached' | 'unavailable';
  details?: string;
}

export class SpaceWeatherService {
  private static cachedData: SpaceWeatherStatus | null = null;
  private static lastFetchTime: number = 0;

  public static async getSpaceWeather(): Promise<SpaceWeatherStatus> {
    const now = Date.now();
    // Cache for 2 minutes
    if (this.cachedData && now - this.lastFetchTime < 120000) {
      return this.cachedData;
    }

    // In automated test environments, bypass live network requests
    const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

    // Try fetching live from NOAA SWPC (if not running in test)
    if (!isTest) {
      try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const url = `${config.noaa.baseUrl}/products/noaa-planetary-k-index.json`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SpaceGuard/0.1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const raw = await response.json() as Array<[string, string]>;
        // Expected format: array of [timestamp, kp_value]
        if (Array.isArray(raw) && raw.length > 1) {
          const latestRow = raw[raw.length - 1];
          const kpVal = parseFloat(latestRow[1]);

          const stormLevel =
            kpVal >= 9 ? 'G5 (Extreme)' :
            kpVal >= 8 ? 'G4 (Severe)' :
            kpVal >= 7 ? 'G3 (Strong)' :
            kpVal >= 6 ? 'G2 (Moderate)' :
            kpVal >= 5 ? 'G1 (Minor)' : 'G0 (Quiet/Unsettled)';

          this.cachedData = {
            source: 'NOAA SWPC Live',
            retrievedAt: new Date().toISOString(),
            kpIndex: isNaN(kpVal) ? null : kpVal,
            geomagneticStormLevel: stormLevel,
            solarRadiationLevel: 'S0 (Normal)',
            radioBlackoutLevel: 'R0 (Normal)',
            status: 'live',
          };
          this.lastFetchTime = now;
          return this.cachedData;
        }
      }
      } catch {
        logger.debug('Failed to fetch live NOAA SWPC, attempting local cache fallback');
      }
    }

    // Check local snapshot file if exists in data/raw/space-weather/
    try {
      const localFilePath = path.resolve(__dirname, '../../../../data/raw/space-weather/kp_index.json');
      if (fs.existsSync(localFilePath)) {
        const fileContent = fs.readFileSync(localFilePath, 'utf-8');
        const raw = JSON.parse(fileContent);
        if (Array.isArray(raw) && raw.length > 1) {
          const latestRow = raw[raw.length - 1];
          const kpVal = parseFloat(latestRow[1]);
          this.cachedData = {
            source: 'NOAA SWPC Snapshot',
            retrievedAt: new Date().toISOString(),
            kpIndex: isNaN(kpVal) ? null : kpVal,
            geomagneticStormLevel: kpVal >= 5 ? 'G1+ Storm' : 'G0 (Quiet)',
            solarRadiationLevel: 'S0 (Normal)',
            radioBlackoutLevel: 'R0 (Normal)',
            status: 'cached',
            details: 'Loaded from local snapshot file',
          };
          this.lastFetchTime = now;
          return this.cachedData;
        }
      }
    } catch {
      // Local file not found or corrupted
    }

    // Honest unavailable message per Principle 3 (Graceful Degradation)
    return {
      source: 'NOAA SWPC',
      retrievedAt: new Date().toISOString(),
      kpIndex: null,
      geomagneticStormLevel: 'Unknown',
      solarRadiationLevel: 'Unknown',
      radioBlackoutLevel: 'Unknown',
      status: 'unavailable',
      details: 'NOAA SWPC service is currently unreachable and no cached snapshot is present',
    };
  }
}
