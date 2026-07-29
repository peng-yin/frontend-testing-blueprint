export interface User {
  id: string;
  name: string;
  role: string;
}

export async function getUser(
  userId: string,
  signal?: AbortSignal,
): Promise<User> {
  const url = new URL(
    `/api/users/${encodeURIComponent(userId)}`,
    window.location.origin,
  );
  const response = await fetch(url, signal ? { signal } : undefined);

  if (!response.ok) {
    throw new Error(`Unable to load user (${response.status})`);
  }

  return (await response.json()) as User;
}
