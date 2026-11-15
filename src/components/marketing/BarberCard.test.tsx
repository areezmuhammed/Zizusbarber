import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { shopConfig } from "../../../shop.config";
import { BarberCard } from "./BarberCard";

it("renders nothing without a barber", () => {
  expect(renderToStaticMarkup(<BarberCard barber={null} />)).toBe("");
});

it("renders the name and photo alt", () => {
  const html = renderToStaticMarkup(
    <BarberCard barber={{ name: "Test Name", photo: "/x.webp", width: 800, height: 1000, alt: "Test Name at the chair" }} />,
  );
  expect(html).toContain("Test Name");
  expect(html).toContain('alt="Test Name at the chair"');
});

it("is off in the demo config", () => {
  expect(shopConfig.barber).toBeNull();
});
