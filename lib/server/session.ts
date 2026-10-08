import { runtimeAuth } from "./runtime-auth";

/**
 * A new visitor has no account yet; never initialize Better Auth or query D1
 * just to discover this on a public read. This is NOT authentication:
 * if a session cookie is present, Better Auth still validates it against D1.
 *
 * Better Auth's default host-only HTTPS session cookies.
 * Do not use this fast path to authorize anything.
 */
function hasSessionCookie(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return header.split(";").some((part) => {
    const name = part.trim().split("=", 1)[0];
    return name === "better-auth.session_token" ||
      name === "__Secure-better-auth.session_token";
  });
}

export async function currentUser(request: Request) {
  if (!hasSessionCookie(request)) return null;
  const auth = await runtimeAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
