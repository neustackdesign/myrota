const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(input: {
  secret: string;
  token: string;
  remoteIp?: string | null;
}): Promise<boolean> {
  if (!input.secret || !input.token) return false;
  const body = new FormData();
  body.set("secret", input.secret);
  body.set("response", input.token);
  if (input.remoteIp) body.set("remoteip", input.remoteIp);

  const response = await fetch(VERIFY_URL, { method: "POST", body });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
