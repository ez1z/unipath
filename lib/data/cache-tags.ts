// Data Cache settings for the public catalog (universities and scholarships).
// Admin actions call revalidateTag with these tags so edits show right away.

/** How long the cached catalog is served before it is fetched again (6 hours). */
export const CATALOG_REVALIDATE_SECONDS = 6 * 60 * 60;

export const UNIVERSITIES_TAG = 'universities-catalog';
export const SCHOLARSHIPS_TAG = 'scholarships-catalog';
