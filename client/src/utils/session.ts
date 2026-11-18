const SESSION_KEY = 'last_round_session_id';
const NAME_KEY = 'last_round_display_name';
const AVATAR_KEY = 'last_round_avatar_config';

export function getOrCreateSessionId(): string {
  let existing = sessionStorage.getItem(SESSION_KEY);
  if (!existing) {
    existing = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, existing);
  }
  return existing;
}

export function getSavedDisplayName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function saveDisplayName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
}

export function loadSavedAvatar<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function saveAvatarConfig<T>(config: T): void {
  try {
    localStorage.setItem(AVATAR_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}
