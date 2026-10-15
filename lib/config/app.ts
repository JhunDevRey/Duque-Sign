// Display settings. These will move to organization settings once the backend exists.
export const APP_NAME = "Duque Sign";
export const DISPLAY_LOCALE = "en-CA";
export const DISPLAY_TIME_ZONE = "America/Toronto";

// Upload limits enforced in the browser for fast feedback. The server must re-validate.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_PAGES = 100;

// Signing links expire with the document. The database accepts 1–90 days.
export const SIGNING_LINK_TTL_DAYS = 30;
