import { StatusControls } from "@/components/admin/StatusControls";
import { requireOwner } from "@/lib/auth";
import { londonDate } from "@/lib/open-now";
import { getClosures, getHours, type Status } from "@/lib/shop-data";
import { createClient } from "@/lib/supabase/server";

export default async function StatusPage() {
  await requireOwner();
  const db = await createClient();
  const now = new Date().getTime();
  const [{ data, error }, hours, closures] = await Promise.all([
    db.from("shop_status").select("state,in_shop,waiting,note,manual_date").single(),
    getHours(),
    getClosures(londonDate(new Date(now))),
  ]);
  if (error) throw new Error(error.message);
  return <StatusControls initial={data as Status} hours={hours} closures={closures} now={now} />;
}
