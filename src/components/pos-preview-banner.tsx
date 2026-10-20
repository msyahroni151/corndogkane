import { UiIcon } from "@/components/ui-icon";
export function PosPreviewBanner() {
  return (
    <div className="pos-preview-banner">
      <UiIcon name="shield" size={16} />
      <p>
        <strong>Pratinjau POS</strong>
        <span>
          {" "}
          · Katalog mengikuti referensi Corndog Kane. Pembayaran belum mencatat transaksi
          operasional.
        </span>
      </p>
    </div>
  );
}
