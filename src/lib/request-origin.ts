export function sameOrigin(request: Request) {
  try {
    const origin = request.headers.get("origin") || "",
      parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      parsed.host === request.headers.get("host") &&
      (parsed.protocol === "https:" ||
        (parsed.protocol === "http:" &&
          process.env.RENDER !== "true" &&
          /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(parsed.host)))
    );
  } catch {
    return false;
  }
}
