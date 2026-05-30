import { environment } from '../../../environments/environment';

/**
 * Resolves API base URL. In local dev, when opened from a phone via LAN IP
 * (e.g. http://192.168.1.5:4200), points API to the same host on port 3000.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return environment.apiUrl;
  }

  if (!environment.production) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3000/api/v1`;
    }
  }

  return environment.apiUrl;
}
