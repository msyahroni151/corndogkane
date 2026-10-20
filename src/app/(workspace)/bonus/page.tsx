import { BonusPage, type BonusQuery } from "@/components/bonus-page";
export default function Page({ searchParams }: { searchParams: Promise<BonusQuery> }) {
  return <BonusPage searchParams={searchParams} />;
}
