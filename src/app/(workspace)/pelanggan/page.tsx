import { PartnerPage, type PartnerFilters } from "@/components/partner-page";
export default function Page({ searchParams }: { searchParams: Promise<PartnerFilters> }) {
  return <PartnerPage kind="CUSTOMER" searchParams={searchParams} />;
}
