/**
 * Deeplink Security Utilities
 * 
 * Validates and sanitizes deeplinks to prevent open redirect vulnerabilities.
 * Only allows internal application routes.
 */

const ALLOWED_PREFIXES = [
    '/tasks',
    '/events',
    '/announcements',
    '/messages',
    '/meet',
    '/dashboard',
    '/profile',
    '/allocations',
    '/resources'
];

/**
 * Validates that a path is a safe internal route.
 * 
 * @param path - The path to validate
 * @returns true if the path is a valid internal route, false otherwise
 */
export function isValidInternalRoute(path: string | null | undefined): boolean {
    if (!path) return false;

    // Must start with /
    if (!path.startsWith('/')) return false;

    // Prevent protocol injection
    if (path.includes('://')) return false;

    // Prevent double-slash (protocol-relative URLs like //evil.com)
    if (path.includes('//')) return false;

    // Prevent javascript: and other schemes
    if (path.toLowerCase().includes('javascript:')) return false;

    // Prevent data: URIs
    if (path.toLowerCase().includes('data:')) return false;

    // Must match one of the allowed prefixes
    return ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * Sanitizes a deeplink, returning null if invalid.
 * 
 * @param path - The path to sanitize
 * @returns The sanitized path if valid, null otherwise
 */
export function sanitizeDeeplink(path: string | null | undefined): string | null {
    return isValidInternalRoute(path) ? path! : null;
}

/**
 * Navigates to a deeplink if valid, otherwise does nothing.
 * For use in client-side code.
 * 
 * @param path - The path to navigate to
 * @param router - Next.js router instance
 * @returns true if navigation occurred, false if blocked
 */
export function safeNavigate(
    path: string | null | undefined,
    router: { push: (url: string) => void }
): boolean {
    const sanitized = sanitizeDeeplink(path);
    if (sanitized) {
        router.push(sanitized);
        return true;
    }
    return false;
}
