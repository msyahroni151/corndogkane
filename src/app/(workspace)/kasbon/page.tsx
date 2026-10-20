import { MoneyPage } from "@/components/money-page";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; status?: string; tersimpan?: string }>;
}) {
  return <MoneyPage mode="kasbon" searchParams={searchParams} />;
}
