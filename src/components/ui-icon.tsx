import type { CSSProperties } from "react";
export type IconName =
  | "dashboard"
  | "people"
  | "location"
  | "placement"
  | "calendar"
  | "wallet"
  | "arrow"
  | "menu"
  | "check"
  | "gift"
  | "receipt"
  | "coins"
  | "building"
  | "chevron"
  | "clock"
  | "alert"
  | "bolt"
  | "exit"
  | "download"
  | "truck"
  | "phone"
  | "shield"
  | "cart"
  | "return"
  | "search"
  | "box"
  | "tag";
const paths: Record<IconName, string> = {
  cart: "M3 3h2l3 12h11l3-9H6 M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2",
  return: "M3 4v6h6 M3 10a9 9 0 1 1 2 8 M12 7v5l3 2",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  box: "M3 7l9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10 M7 4l10 5",
  tag: "M3 3h8l10 10-8 8L3 11z M7 7h.01",
  shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6",
  phone:
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  location: "M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  placement: "M3 7h18 M17 3l4 4-4 4 M21 17H3 M7 13l-4 4 4 4",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M3 5h18v16H3z M8 14h2 M14 14h2 M8 18h2",
  wallet: "M3 5h17v15H3z M3 5V3h15 M15 10h7v6h-7z M18 13h1",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  check: "M9 3h6v4H9z M9 5H5v16h14V5h-4 M8 14l3 3 5-6",
  gift: "M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8H8a3 3 0 1 1 3-3z M12 8h4a3 3 0 1 0-3-3z",
  receipt: "M5 3l2 2 2-2 3 2 3-2 2 2 2-2v18l-2-2-2 2-3-2-3 2-2-2-2 2z M9 9h6 M9 13h6 M9 17h3",
  coins: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18 M12 6v12 M15 8h-5a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9",
  building: "M3 21h18 M5 21V3h10v18 M15 9h4v12 M8 7h4 M8 11h4 M8 15h4 M9 21v-3h2v3",
  chevron: "M9 5l7 7-7 7",
  clock: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18 M12 7v5l3 2",
  alert: "M12 3L2 21h20z M12 9v5 M12 17v1",
  bolt: "M13 2L4 14h7l-1 8 10-13h-7z",
  exit: "M10 4H4v16h6 M10 12h11 M17 8l4 4-4 4",
  truck:
    "M2 4h13v12H2z M15 8h4l3 4v4h-7 M7 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M21 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M7 18h10",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
};
export function UiIcon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
