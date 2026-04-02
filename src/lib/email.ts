export function normalizeEmailAddress(email: string | null | undefined) {
	return typeof email === 'string' && email.trim().length > 0 ? email.trim().toLowerCase() : null;
}
