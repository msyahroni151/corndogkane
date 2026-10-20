import { MasterPage, type MasterQuery } from "@/components/master-page";
export default function Page({ searchParams }: { searchParams: Promise<MasterQuery> }) {
  return <MasterPage kind="outlet" searchParams={searchParams} />;
}
