export async function fetchWithSession<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.assign("/login");
    return null;
  }
  const data = await res.json().catch(() => null);
  if (data?.code === "ORG_SUSPENDED") {
    window.location.assign("/suspendida");
    return null;
  }
  return res.ok ? (data as T) : null;
}
