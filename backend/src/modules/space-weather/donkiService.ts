import { IEnvironmentalEvent } from '../../shared/types';
import { IEnvironmentalEventRepository } from '../../repositories/interfaces/IEnvironmentalEventRepository';
import { getEnvironmentalEventRepository } from '../../repositories';
import { config } from '../../config';
import { logger } from '../../shared/logger';

export interface DonkiEventFilter {
  startDate?: string;
  endDate?: string;
  type?: 'FLR' | 'CME' | 'GST' | 'all';
  limit?: number;
}

export class DonkiService {
  private static repository: IEnvironmentalEventRepository | null = null;
  private static cachedEvents: IEnvironmentalEvent[] = [];
  private static lastFetchTime: number = 0;
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private static getRepo(): IEnvironmentalEventRepository {
    return this.repository || getEnvironmentalEventRepository();
  }

  public static setRepository(repo: IEnvironmentalEventRepository): void {
    this.repository = repo;
    this.cachedEvents = [];
    this.lastFetchTime = 0;
  }

  /**
   * Fetches space weather events from NASA DONKI (or cache/database),
   * normalizes them into canonical IEnvironmentalEvent records,
   * and persists them into MongoDB.
   */
  public static async fetchEvents(filter: DonkiEventFilter = {}): Promise<IEnvironmentalEvent[]> {
    const now = Date.now();
    if (this.cachedEvents.length > 0 && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cachedEvents;
    }

    const apiKey = config.nasa.apiKey || 'DEMO_KEY';
    const baseUrl = 'https://api.nasa.gov/DONKI';

    // Default to last 7 days of space weather
    const end = new Date();
    const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const startDateStr = filter.startDate || start.toISOString().split('T')[0];
    const endDateStr = filter.endDate || end.toISOString().split('T')[0];

    const events: IEnvironmentalEvent[] = [];
    const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

    if (!isTest) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const url = `${baseUrl}/notifications?startDate=${startDateStr}&endDate=${endDateStr}&type=${filter.type || 'all'}&api_key=${apiKey}`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'SpaceGuard-AI/0.1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
        const rawList = await response.json();
        if (Array.isArray(rawList)) {
          for (const raw of rawList) {
            const eventId = raw.messageID || `DONKI-${Date.parse(raw.messageIssueTime || new Date().toISOString())}`;
            const eventType = raw.messageType || 'DONKI_NOTIFICATION';
            const timestamp = new Date(raw.messageIssueTime || new Date());
            
            // Extract severity indicator from message type or body if present
            let severity = 'info';
            const bodyLower = (raw.messageBody || '').toLowerCase();
            if (bodyLower.includes('severe') || bodyLower.includes('extreme') || bodyLower.includes('g4') || bodyLower.includes('g5') || bodyLower.includes('x-class')) {
              severity = 'critical';
            } else if (bodyLower.includes('strong') || bodyLower.includes('g3') || bodyLower.includes('m-class')) {
              severity = 'high';
            } else if (bodyLower.includes('moderate') || bodyLower.includes('g2') || bodyLower.includes('c-class')) {
              severity = 'medium';
            }

            const description = (raw.messageBody || '').slice(0, 300).trim() || `NASA DONKI ${eventType} reported`;

            const event: IEnvironmentalEvent = {
              eventId,
              source: 'nasa_donki',
              eventType,
              timestamp,
              severity,
              description,
              rawData: {
                messageURL: raw.messageURL,
                messageType: raw.messageType,
              },
              retrievedAt: new Date(),
            };
            events.push(event);
          }

          // Persist to repository (deduplicated by eventId index)
          if (events.length > 0) {
            try {
              await this.getRepo().createMany(events);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Unknown write error';
              logger.warn('Failed to bulk persist DONKI events to repository', { error: msg });
            }
          }

          this.cachedEvents = events;
          this.lastFetchTime = now;
          return events;
        }
      } else {
        logger.warn('NASA DONKI API returned non-OK status', { status: response.status });
      }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Timeout / Network error';
        logger.warn('NASA DONKI live fetch failed, reading from persistent store', { error: msg });
      }
    }

    // Graceful fallback: Query persistent repository
    try {
      const stored = await this.getRepo().findRecent(filter.limit || 50);
      if (stored.length > 0) {
        this.cachedEvents = stored;
        this.lastFetchTime = now;
        return stored;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown query error';
      logger.warn('Failed to query repository for cached DONKI events', { error: msg });
    }

    return [];
  }

  /**
   * Retrieves space weather environmental events within a specific temporal window.
   */
  public static async getEventsInWindow(start: Date, end: Date): Promise<IEnvironmentalEvent[]> {
    // Ensure we have recent events loaded
    if (this.cachedEvents.length === 0 || Date.now() - this.lastFetchTime >= this.CACHE_TTL_MS) {
      await this.fetchEvents();
    }

    try {
      const dbEvents = await this.getRepo().findByTimeRange(start, end);
      if (dbEvents.length > 0) {
        return dbEvents;
      }
    } catch {
      // Fallback to in-memory filter
    }

    const s = start.getTime();
    const e = end.getTime();
    return this.cachedEvents.filter((ev) => {
      const t = new Date(ev.timestamp).getTime();
      return t >= s && t <= e;
    });
  }
}
