import { Preferences } from "@capacitor/preferences";

export const API_URL = (
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : "https://progression.fit")
).replace(/\/$/, "");
const TOKEN_KEY = "progression_session";
let token: string | null = null;

export async function loadToken() {
  token = (await Preferences.get({ key: TOKEN_KEY })).value;
  return token;
}

export async function saveToken(value: string | null) {
  token = value;
  if (value) await Preferences.set({ key: TOKEN_KEY, value });
  else await Preferences.remove({ key: TOKEN_KEY });
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status})`);
  return body as T;
}

export async function signIn(username: string, password: string) {
  const response = await fetch(`${API_URL}/api/auth/sign-in/username`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Unable to sign in");
  const nextToken = response.headers.get("set-auth-token");
  if (!nextToken) throw new Error("The server did not issue a mobile session");
  await saveToken(nextToken);
}

export async function signUp(username: string, password: string) {
  const response = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: username,
      username,
      email: `${username.toLowerCase()}@tracker.local`,
      password,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Unable to create account");
  const nextToken = response.headers.get("set-auth-token");
  if (!nextToken) throw new Error("The server did not issue a mobile session");
  await saveToken(nextToken);
}

export async function signOut() {
  await request("/api/auth/sign-out", { method: "POST", body: "{}" }).catch(() => undefined);
  await saveToken(null);
}

export async function getSession() {
  return request<{ user: { id: string; name: string; username?: string } | null }>("/api/auth/get-session");
}

export async function data<T>(section: string, query = "") {
  const result = await request<{ data: T }>(`/api/mobile/data/${section}${query}`);
  return result.data;
}

export async function post<T>(path: string, body: Record<string, unknown>) {
  const result = await request<{ data: T }>(path, { method: "POST", body: JSON.stringify(body) });
  return result.data;
}

export async function authorizedBlob(path: string) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) throw new Error("Unable to load image");
  return response.blob();
}

export async function upload(path: string, body: FormData) {
  return request<Record<string, unknown>>(path, { method: "POST", body });
}
