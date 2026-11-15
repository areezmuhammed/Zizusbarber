export const shopConfig = {
  name: "Zizu's Barbers",
  tagline: "Premium Euro-Afro Styling in Sheffield",
  area: "Upperthorpe, Sheffield S6",
  url: "https://zizusbarbers.com",
  address: "135 Upperthorpe Rd, Sheffield S6 3EB",
  phone: "07535 423544",
  email: "bookings@zizusbarbers.com", // confirm this mailbox receives mail before launch (docs/launch-checklist.md)
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Zizu's%20Barbers%2C%20135%20Upperthorpe%20Rd%2C%20Sheffield%20S6%203EB",
  sameAs: ["https://www.instagram.com/zizusbarbers"], // add the Facebook page here if there is one
  timezone: "Europe/London" as const,
  theme: {
    bg: "#120F0B",
    band: "#17130E",
    surface: "#1F1913",
    text: "#F3EAD8",
    accent: "#C9A44C",
    muted: "#B3A487", // >= 4.5:1 on bg, band, surface and raised surfaces
    destructive: "#E5605A",
  },
  privacy: {
    // PLACEHOLDER: set the real ICO registration number before launch; the privacy page omits the line while null
    icoRegistration: null as string | null,
    retentionYears: 2, // keep in step with anonymise_old_bookings' default in supabase/migrations/014_privacy.sql
    processors: [
      { name: "Supabase", role: "database, owner sign-in and photo storage" },
      { name: "Vercel", role: "website hosting" },
      { name: "Resend", role: "booking emails" },
      { name: "Twilio", role: "booking text messages" },
    ],
  },
};
