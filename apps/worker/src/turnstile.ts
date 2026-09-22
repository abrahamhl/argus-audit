/**
 * Cloudflare Turnstile verification. Optional: only active when the
 * TURNSTILE_SECRET binding is configured. The site key is public by design
 * and may be exposed to the browser; the secret never leaves the Worker.
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp?: string,
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp !== undefined && remoteIp.length > 0) body.set('remoteip', remoteIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
