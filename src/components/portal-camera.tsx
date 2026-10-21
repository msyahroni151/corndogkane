"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
type Detection = {
  descriptor: Float32Array;
  detection: { score: number; box: { width: number; height: number } };
};
type FaceApi = {
  nets: Record<
    "tinyFaceDetector" | "faceLandmark68TinyNet" | "faceRecognitionNet",
    { loadFromUri: (uri: string) => Promise<void> }
  >;
  TinyFaceDetectorOptions: new (options: { inputSize: number; scoreThreshold: number }) => unknown;
  detectAllFaces: (
    input: HTMLVideoElement,
    options: unknown,
  ) => {
    withFaceLandmarks: (tiny: boolean) => { withFaceDescriptors: () => Promise<Detection[]> };
  };
  tf: { ready: () => Promise<void> };
};
declare global {
  interface Window {
    faceapi?: FaceApi;
  }
}
let modelPromise: Promise<FaceApi> | null = null;
function loadModels() {
  if (!modelPromise)
    modelPromise = (async () => {
      if (!window.faceapi)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "/face-api/face-api.js";
          script.onload = () => resolve();
          script.onerror = () => {
            script.remove();
            reject(Error("Model wajah gagal dimuat. Periksa koneksi dan coba kembali."));
          };
          document.head.append(script);
        });
      const api = window.faceapi!;
      await api.tf.ready();
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri("/face-api/models"),
        api.nets.faceLandmark68TinyNet.loadFromUri("/face-api/models"),
        api.nets.faceRecognitionNet.loadFromUri("/face-api/models"),
      ]);
      return api;
    })().catch((e) => {
      modelPromise = null;
      throw e;
    });
  return modelPromise;
}
async function send(
  body: Record<string, unknown>,
): Promise<{ id?: string; success?: string; error?: string }> {
  const response = await fetch("/api/portal/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error("Sesi tidak tersedia. Muat ulang atau masuk kembali.");
  }
  if (!response.ok || result.error) throw Error(result.error || "Bukti belum terkirim.");
  return result;
}
type ScheduleOption = { id: string; label: string; canIn: boolean; canOut: boolean };
export function PortalCamera({
  faceStatus,
  schedules,
}: {
  faceStatus: string | null;
  schedules: ScheduleOption[];
}) {
  const router = useRouter(),
    video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    challenge = useRef(""),
    mounted = useRef(true),
    busyRef = useRef(false);
  const [stage, setStage] = useState<"IDLE" | "FACE" | "CART">("IDLE"),
    [enroll, setEnroll] = useState(false),
    [busy, setBusy] = useState(false),
    [cameraReady, setCameraReady] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [scheduleId, setScheduleId] = useState(
      schedules.find((s) => s.canIn || s.canOut)?.id || schedules[0]?.id || "",
    ),
    [consent, setConsent] = useState(false),
    [cartPhoto, setCartPhoto] = useState("");
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCameraReady(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function camera(back = false) {
    stop();
    if (!navigator.mediaDevices?.getUserMedia)
      throw Error(
        "Kamera memerlukan HTTPS atau localhost dan browser yang mendukung akses kamera.",
      );
    const media = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: back ? { exact: "environment" } : "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
    if (!mounted.current) {
      media.getTracks().forEach((t) => t.stop());
      return;
    }
    stream.current = media;
    for (let i = 0; i < 20 && !video.current; i++) await new Promise((r) => setTimeout(r, 50));
    if (!video.current) {
      media.getTracks().forEach((t) => t.stop());
      throw Error("Tampilan kamera belum siap.");
    }
    video.current.srcObject = media;
    await video.current.play();
    if (video.current.readyState < 2)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("Kamera belum siap. Coba kembali.")), 10000);
        video.current!.onloadeddata = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    setCameraReady(true);
  }
  function snapshot() {
    const v = video.current;
    if (!v || !v.videoWidth || !stream.current) throw Error("Kamera belum siap.");
    const canvas = document.createElement("canvas"),
      ratio = Math.min(1, 640 / v.videoWidth);
    canvas.width = v.videoWidth * ratio;
    canvas.height = v.videoHeight * ratio;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    let quality = 0.78,
      result = canvas.toDataURL("image/jpeg", quality);
    while (result.length > 260000 && quality > 0.3) {
      quality -= 0.1;
      result = canvas.toDataURL("image/jpeg", quality);
    }
    return result;
  }
  async function run(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Kamera belum dapat digunakan. Periksa izin kamera dan coba kembali.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function begin(kind: "ENROLL" | "IN" | "OUT") {
    void run(async () => {
      setSuccess("");
      setEnroll(kind === "ENROLL");
      setCartPhoto("");
      if (kind === "ENROLL" && !consent)
        throw Error("Setujui penggunaan wajah untuk absensi sebelum mendaftar.");
      if (kind !== "ENROLL") {
        const result = await send({ step: "START", scheduleId, kind });
        challenge.current = result.id!;
      }
      setStage("FACE");
      await camera();
      await loadModels();
    });
  }
  function scan() {
    void run(async () => {
      const api = await loadModels();
      if (!video.current) throw Error("Kamera belum siap.");
      const faces = await api
        .detectAllFaces(
          video.current,
          new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.65 }),
        )
        .withFaceLandmarks(true)
        .withFaceDescriptors();
      if (
        faces.length !== 1 ||
        faces[0].detection.score < 0.7 ||
        faces[0].detection.box.width < 90 ||
        faces[0].detection.box.height < 90
      )
        throw Error("Tampilkan tepat satu wajah dengan jelas dan cukup dekat ke kamera.");
      const descriptor = Array.from(faces[0].descriptor),
        photo = snapshot();
      const result = await send(
        enroll
          ? { step: "ENROLL", descriptor, photo, consent }
          : { step: "VERIFY", id: challenge.current, descriptor, photo },
      );
      if (enroll) {
        setSuccess(result.success!);
        stop();
        setStage("IDLE");
        router.refresh();
      } else {
        setStage("CART");
        await camera(true);
      }
    });
  }
  function close() {
    if (busy) return;
    stop();
    setStage("IDLE");
    setError("");
    setCartPhoto("");
  }
  const selected = schedules.find((s) => s.id === scheduleId);
  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h2 className="font-bold">Absen dengan Kamera</h2>
        <p className="mt-2 text-sm text-slate-500">
          Verifikasi wajah, lalu foto gerobak atau area kerja melalui kamera belakang. Bukti
          diperiksa admin sebelum masuk ke rekap payroll.
        </p>
      </div>
      {faceStatus !== "APPROVED" ? (
        <>
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            {faceStatus === "PENDING"
              ? "Pendaftaran wajah sedang diperiksa admin."
              : faceStatus === "REJECTED"
                ? "Pendaftaran wajah ditolak. Periksa catatan admin dan daftarkan kembali."
                : "Daftarkan wajah terlebih dahulu. Admin akan memeriksa kesesuaian identitas Anda."}
          </p>
          {faceStatus !== "PENDING" && (
            <>
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Saya menyetujui penyimpanan data wajah untuk verifikasi absensi di Corndog Kane.
              </label>
              <button
                className="button-primary"
                disabled={busy || !consent}
                onClick={() => begin("ENROLL")}
              >
                Daftarkan Wajah
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <label className="field">
            Jadwal bertugas
            <select
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              disabled={busy}
            >
              <option value="" disabled>
                Pilih jadwal...
              </option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {!schedules.length && (
            <p className="text-sm text-slate-500">
              Belum ada jadwal kerja yang dapat diabsen hari ini.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className="button-primary"
              disabled={busy || !selected?.canIn}
              onClick={() => begin("IN")}
            >
              Absen Masuk
            </button>
            <button
              className="button-secondary"
              disabled={busy || !selected?.canOut}
              onClick={() => begin("OUT")}
            >
              Absen Pulang
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Pulang tersedia setelah absensi masuk disetujui. Jika kamera bermasalah, hubungi admin
            untuk pencatatan dengan pemeriksaan manual.
          </p>
        </>
      )}
      {success && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </p>
      )}
      {error && stage === "IDLE" && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {stage !== "IDLE" && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-camera-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <div className="my-auto w-full max-w-xl space-y-4 rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="portal-camera-title" className="font-bold">
                {stage === "FACE"
                  ? enroll
                    ? "Pendaftaran Wajah"
                    : "1. Verifikasi Wajah"
                  : "2. Foto Gerobak / Area Kerja"}
              </h2>
              <button type="button" className="button-secondary" disabled={busy} onClick={close}>
                Tutup
              </button>
            </div>
            <p className="text-sm text-slate-500">
              {stage === "FACE"
                ? "Pastikan wajah terlihat jelas, pencahayaan cukup, dan hanya Anda yang ada di dalam gambar."
                : "Arahkan kamera belakang ke gerobak atau area kerja. Periksa hasil foto sebelum mengirim."}
            </p>
            <video
              ref={video}
              autoPlay
              muted
              playsInline
              className={`aspect-[4/3] w-full rounded-xl bg-slate-900 object-cover ${stage === "FACE" ? "-scale-x-100" : ""} ${cartPhoto ? "hidden" : ""}`}
            />
            {cartPhoto && (
              <Image
                src={cartPhoto}
                width={640}
                height={480}
                unoptimized
                alt="Pratinjau foto area kerja"
                className="w-full rounded-xl"
              />
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            {busy && (
              <p role="status" className="text-sm text-slate-500">
                Memproses kamera dan data wajah...
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {stage === "FACE" ? (
                <button className="button-primary" disabled={busy || !cameraReady} onClick={scan}>
                  {enroll ? "Ambil & Daftarkan Wajah" : "Verifikasi Wajah"}
                </button>
              ) : cartPhoto ? (
                <>
                  <button
                    className="button-secondary"
                    disabled={busy}
                    onClick={() => setCartPhoto("")}
                  >
                    Ulangi Foto
                  </button>
                  <button
                    className="button-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await send({
                          step: "COMPLETE",
                          id: challenge.current,
                          photo: cartPhoto,
                        });
                        setSuccess(result.success!);
                        stop();
                        setStage("IDLE");
                        router.refresh();
                      })
                    }
                  >
                    Kirim Bukti Absensi
                  </button>
                </>
              ) : (
                <button
                  className="button-primary"
                  disabled={busy || !cameraReady}
                  onClick={() => {
                    try {
                      setCartPhoto(snapshot());
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Ambil Foto Gerobak
                </button>
              )}
              {!cameraReady && (
                <button
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => void run(() => camera(stage === "CART"))}
                >
                  Ulangi Akses Kamera
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
