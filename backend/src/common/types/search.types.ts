export interface JobSearchOptions {
  /** SerpAPI / geo-targeted search location */
  location?: string;
  /** Candidate country — used for remote eligibility filtering and query building */
  country?: string;
  /** Whether the user prefers remote work */
  remote?: boolean;
}
