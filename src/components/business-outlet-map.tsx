"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { OutletLocationMap, type OutletMapPoint } from "@/components/outlet-location-map";
import { rupiah } from "@/lib/money";
export type DashboardLocation = {
  id: string;
  name: string;
  areaName: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  active: boolean;
  closed: boolean;
  gross: number | null;
  crew: string;
};
export function BusinessOutletMap({
  outlets,
  canEdit,
}: {
  outlets: DashboardLocation[];
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const located = outlets.filter((o) => o.latitude !== null && o.longitude !== null);
  const points = useMemo<OutletMapPoint[]>(
    () =>
      outlets.flatMap((o) =>
        o.latitude === null || o.longitude === null
          ? []
          : [
              {
                ...o,
                latitude: o.latitude,
                longitude: o.longitude,
                detail: `${o.closed ? "Tutup permanen" : o.active ? "Aktif" : "Tidak aktif"} · ${o.gross === null ? "Belum ada rekap periode ini" : `Omzet ${rupiah(o.gross)}`}${o.crew ? ` · Crew: ${o.crew}` : ""}`,
              },
            ],
      ),
    [outlets],
  );
  const matching = outlets.filter((o) =>
    `${o.name} ${o.areaName}`
      .toLocaleLowerCase("id-ID")
      .includes(search.toLocaleLowerCase("id-ID")),
  );
  return (
    <section className="panel business-map-card" aria-label="Sebaran lokasi outlet">
      <div className="business-section-heading">
        <div>
          <h2>Jangkauan Corndog Kane</h2>
          <p>Lokasi outlet saat ini · mengikuti filter area / outlet.</p>
        </div>
        <span className="business-count">
          {located.length} / {outlets.length} titik terisi
        </span>
      </div>
      <OutletLocationMap points={points} />
      <div className="business-map-key">
        <span>
          <i />
          Aktif
        </span>
        <span>
          <i className="is-inactive" />
          Tidak aktif / tutup permanen
        </span>
      </div>
      {!located.length && (
        <p className="business-map-empty">
          Belum ada titik lokasi outlet.{" "}
          {canEdit ? (
            <Link href="/master-outlet">Lengkapi lokasi di Master Outlet →</Link>
          ) : (
            "Koordinat dapat dilengkapi oleh pengelola Master Outlet."
          )}
        </p>
      )}
      <details className="business-map-directory">
        <summary>Daftar lokasi · {outlets.length - located.length} belum diisi</summary>
        <label className="field">
          Cari lokasi outlet
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama outlet atau area…"
          />
        </label>
        <ul>
          {matching.map((o) => (
            <li key={o.id}>
              <div>
                <strong>{o.name}</strong>
                <small>
                  {o.areaName} · {o.address || "Alamat belum diisi"}
                </small>
              </div>
              {o.latitude !== null && o.longitude !== null ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${o.latitude},${o.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buka lokasi ↗
                </a>
              ) : canEdit ? (
                <Link href={`/master-outlet?editOutlet=${encodeURIComponent(o.id)}`}>
                  Isi lokasi →
                </Link>
              ) : (
                <small>Lokasi belum diisi</small>
              )}
            </li>
          ))}
        </ul>
        {!matching.length && (
          <p className="business-footnote">Tidak ada outlet sesuai pencarian.</p>
        )}
      </details>
      <p className="business-footnote">
        Klik titik untuk melihat nama, alamat, omzet periode terpilih, dan petugas. Titik memakai
        koordinat tersimpan; status aktif bukan status buka menurut jadwal harian.
      </p>
    </section>
  );
}
