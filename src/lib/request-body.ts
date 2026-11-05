export class RequestBodyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export async function boundedJsonText(request: Request, limit: number): Promise<string> {
  const mime = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mime !== "application/json") throw new RequestBodyError("Gunakan data JSON yang valid.", 415);
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit))
    throw new RequestBodyError("Ukuran data terlalu besar.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError("Data kosong.", 400);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0,
    result = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestBodyError("Ukuran data terlalu besar.", 413);
      }
      result += decoder.decode(chunk.value, { stream: true });
    }
    return result + decoder.decode();
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Data permintaan tidak valid.", 400);
  } finally {
    reader.releaseLock();
  }
}
