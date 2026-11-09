import { GalleryManager } from "@/components/admin/GalleryManager";
import { requireOwner } from "@/lib/auth";
import { getGallery } from "@/lib/shop-data";

export default async function GalleryPage() {
  await requireOwner();
  // the public reader: owner actions expire its tag, so this list is fresh after every change
  return <GalleryManager photos={await getGallery()} />;
}
