export function sameOrigin(request: Request) {
  try {
    const origin = request.headers.get("origin") || "",
      parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      parsed.host === request.headers.get("host") &&
      ["http:", "https:"].includes(parsed.protocol)
    );
  } catch {
    return false;
  }
}
