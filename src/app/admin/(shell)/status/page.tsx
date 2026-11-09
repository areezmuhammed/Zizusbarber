import { StatusControls } from "@/components/admin/StatusControls";
import { requireOwner } from "@/lib/auth";
import type { Status } from "@/lib/shop-data";
import { createClient } from "@/lib/supabase/server";

export default async function StatusPage() {
  await requireOwner();
  const db = await createClient();
  const { data, error } = await db.from("shop_status").select("state,in_shop,waiting,note").single();
  if (error) throw new Error(error.message);
  return <StatusControls initial={data as Status} />;
}
