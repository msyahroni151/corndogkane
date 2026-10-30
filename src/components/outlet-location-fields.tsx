"use client";
import { useCallback, useMemo, useState } from "react";
import { LocalInput } from "@/components/local-input";
import { OutletLocationMap } from "@/components/outlet-location-map";
import { readOutletLocation } from "@/lib/outlet-location";
export function OutletLocationFields({
  initial,
}: {
  initial?: { latitude?: number | null; longitude?: number | null; address?: string | null };
}) {
  const [latitude, setLatitude] = useState(initial?.latitude?.toString() ?? ""),
    [longitude, setLongitude] = useState(initial?.longitude?.toString() ?? "");
  const [notice, setNotice] = useState(""),
    [locating, setLocating] = useState(false);
  const pick = useCallback((lat: number, lng: number) => {
    setLatitude(lat.toString());
    setLongitude(lng.toString());
    setNotice("Titik dipilih. Simpan outlet untuk menyimpan lokasi ini.");
  }, []);
  const points = useMemo(() => {
    try {
      const location = readOutletLocation(latitude, longitude, "");
      return location.latitude === null
        ? []
        : [
            {
              id: "selected",
              name: "Titik outlet yang dipilih",
              areaName: "",
              latitude: location.latitude,
              longitude: location.longitude!,
            },
          ];
    } catch {
      return [];
    }
  }, [latitude, longitude]);
  function locate() {
    if (!navigator.geolocation) {
      setNotice("Perangkat ini tidak mendukung lokasi. Klik peta atau isi koordinat manual.");
      return;
    }
    setLocating(true);
    setNotice("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        pick(
          Number(position.coords.latitude.toFixed(6)),
          Number(position.coords.longitude.toFixed(6)),
        );
        setLocating(false);
      },
      () => {
        setNotice(
          "Lokasi perangkat belum tersedia atau izinnya ditolak. Klik peta atau isi koordinat manual.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }
  return (
    <section className="outlet-location-fields" aria-label="Lokasi outlet">
      <h3>Lokasi outlet</h3>
      <p>
        Klik peta untuk menaruh titik, atau salin koordinat dari Google Maps. Lokasi ini otomatis
        tampil di dashboard setelah outlet disimpan.
      </p>
      <label className="field mb-3">
        Alamat outlet
        <LocalInput
          name="address"
          defaultValue={initial?.address || ""}
          maxLength={500}
          placeholder="Jalan, nomor, kelurahan, kota"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 mb-3">
        <label className="field">
          Latitude
          <LocalInput
            name="latitude"
            inputMode="decimal"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="Contoh: -6.914744"
            maxLength={24}
          />
        </label>
        <label className="field">
          Longitude
          <LocalInput
            name="longitude"
            inputMode="decimal"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="Contoh: 107.609810"
            maxLength={24}
          />
        </label>
      </div>
      <div className="outlet-location-toolbar">
        <button className="button-secondary" type="button" onClick={locate} disabled={locating}>
          {locating ? "Mencari lokasi…" : "Gunakan lokasi saya"}
        </button>
        <button
          className="button-secondary"
          type="button"
          onClick={() => {
            setLatitude("");
            setLongitude("");
            setNotice("Titik dikosongkan. Perubahan berlaku setelah outlet disimpan.");
          }}
        >
          Kosongkan titik
        </button>
      </div>
      <OutletLocationMap points={points} onPick={pick} />
      <p role="status">
        {notice ||
          "Opsional. Gunakan lokasi perangkat hanya saat Anda berada di outlet; koordinat yang kosong tidak dibuatkan titik perkiraan."}
      </p>
    </section>
  );
}
