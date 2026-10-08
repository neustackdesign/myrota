import { runtimeAuth } from "./runtime-auth";

export async function currentUser(request: Request) {
  const auth = runtimeAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
