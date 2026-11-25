import type { Metadata } from "next";
import { BasicAdmin } from "@/components/admin/BasicAdmin";
import { getGallery, getHours, getServices } from "@/lib/shop-data";

export const metadata: Metadata = { title: "Owner (Basic demo)" };

// No login on purpose: reads public data only, and BasicAdmin never writes anywhere.
export default async function BasicAdminPage() {
  const [services, hours, photos] = await Promise.all([getServices(), getHours(), getGallery()]);
  return <BasicAdmin services={services} hours={hours} photos={photos} />;
}
