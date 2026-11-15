import { getImageProps } from "next/image";

export function HeroVisual() {
  const common = { alt: "", sizes: "100vw", loading: "eager" as const };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, src: "/images/brand/placeholder-hero-desktop.webp", width: 1664, height: 936 });
  const {
    props: { srcSet: mobile, ...img },
  } = getImageProps({ ...common, src: "/images/brand/placeholder-hero-mobile.webp", width: 1120, height: 1400 });

  return (
    <>
      <picture>
        <source media="(min-width: 768px)" srcSet={desktop} />
        <img {...img} srcSet={mobile} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover object-[50%_30%]" />
      </picture>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/20" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--background)_100%)] opacity-70"
        aria-hidden
      />
    </>
  );
}
