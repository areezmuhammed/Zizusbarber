// Old single-page site paths -> new pages (308 permanent). Edit this list; /book is the real booking page, so never add it.
export const OLD_URLS: [from: string, to: string][] = [
  ["/index.html", "/"],
  ["/home", "/"],
  ["/services", "/#services"],
  ["/prices", "/#services"],
  ["/gallery", "/#gallery"],
  ["/contact", "/#hours"],
  ["/booking", "/book"], // exact path only: /booking/<token> is the customer's manage page
];

export const redirects = () => OLD_URLS.map(([source, destination]) => ({ source, destination, permanent: true }));
