"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./outlet-location-map.css";
export type OutletMapPoint = {
  id: string;
  name: string;
  areaName: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  active?: boolean;
  closed?: boolean;
  detail?: string;
};
export function OutletLocationMap({
  points,
  onPick,
}: {
  points: OutletMapPoint[];
  onPick?: (latitude: number, longitude: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    layers = useRef<LayerGroup | null>(null);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return;
        const instance = L.map(container.current, { scrollWheelZoom: false }).setView(
          [-2.5, 118],
          4,
        );
        map.current = instance;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .on("tileerror", () => {
            if (!disposed)
              setError(
                "Latar peta belum termuat. Periksa koneksi internet; daftar lokasi tetap tersedia.",
              );
          })
          .addTo(instance);
        layers.current = L.layerGroup().addTo(instance);
        instance.on("click", (e) =>
          pick.current?.(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))),
        );
        observer = new ResizeObserver(() => instance.invalidateSize());
        observer.observe(container.current);
        setReady(true);
      })
      .catch(() => {
        if (!disposed)
          setError("Peta belum dapat dimuat. Koordinat dan daftar outlet tetap dapat digunakan.");
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !layers.current) return;
    let disposed = false;
    import("leaflet").then((L) => {
      if (disposed || !map.current || !layers.current) return;
      layers.current.clearLayers();
      for (const p of points) {
        // Nama dan alamat dari pengguna dipasang sebagai textContent, bukan HTML.
        const popup = document.createElement("div"),
          title = document.createElement("strong"),
          description = document.createElement("p");
        title.textContent = p.name;
        description.textContent = [p.areaName, p.address, p.detail].filter(Boolean).join(" · ");
        popup.append(title, description);
        const directions = document.createElement("a");
        directions.href = `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
        directions.target = "_blank";
        directions.rel = "noopener noreferrer";
        directions.textContent = "Buka petunjuk lokasi ↗";
        popup.append(directions);
        const marker = L.marker([p.latitude, p.longitude], {
          title: p.name,
          alt: `Lokasi ${p.name}`,
          keyboard: true,
          icon: L.divIcon({
            className: "outlet-map-marker",
            html: `<span class="${p.closed || p.active === false ? "is-inactive" : ""}"></span>`,
            iconSize: [24, 30],
            iconAnchor: [12, 26],
          }),
        });
        marker.bindPopup(popup).addTo(layers.current);
      }
      if (points.length)
        map.current.fitBounds(L.latLngBounds(points.map((p) => [p.latitude, p.longitude])), {
          padding: [36, 36],
          maxZoom: points.length === 1 ? 15 : 13,
        });
    });
    return () => {
      disposed = true;
    };
  }, [ready, points]);
  return (
    <div className="outlet-map-shell">
      <div
        className="outlet-location-map"
        ref={container}
        role="region"
        aria-label={onPick ? "Klik peta untuk menentukan lokasi outlet" : "Peta persebaran outlet"}
      />
      {error && (
        <p role="status" className="outlet-map-notice">
          {error}
        </p>
      )}
    </div>
  );
}
