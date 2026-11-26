import { readFile, mkdir, rm, writeFile, copyFile, cp, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Hjson from "hjson";
import { generateFeeds } from "./generate-feeds.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(root, process.env.OUTPUT_DIR || "dist");
const basePath = normalizeBasePath(process.env.BASE_PATH || "/");
const canonicalOrigin = "https://xn--om2b.fyi";

function normalizeBasePath(value) {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function loadHjson(file) {
  try {
    return Hjson.parse(file);
  } catch (error) {
    throw new Error(`Could not parse ${file}: ${error.message}`, { cause: error });
  }
}

async function readContent(name) {
  const file = path.join(root, "content", name);
  return loadHjson(await readFile(file, "utf8"));
}

function requiredString(value, field, context) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context}: "${field}" must be a non-empty string.`);
  }
}

function validateSlug(value, context) {
  requiredString(value, "slug", context);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${context}: slug "${value}" must use lowercase letters, numbers, and hyphens.`);
  }
}

function validateDate(value, field, context) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${context}: ${field} must be a valid date in YYYY-MM-DD format.`);
  }
}

function validateHttpsUrl(value, field, context) {
  try {
    if (new URL(value).protocol === "https:") return;
  } catch {
    // Report the same actionable validation message for malformed URLs.
  }
  throw new Error(`${context}: ${field} must be a valid HTTPS URL.`);
}

function validateContent(site, releases, publications, links) {
  requiredString(site.name, "name", "content/site.hjson");
  if (typeof site.introduction !== "string" || typeof site.description !== "string") {
    throw new Error("content/site.hjson: description and introduction must be strings.");
  }
  if (!site.biography || typeof site.biography !== "object") {
    throw new Error('content/site.hjson: "biography" must be an object.');
  }
  for (const field of ["short", "extended", "musical_description", "artist_statement"]) {
    if (typeof site.biography[field] !== "string") {
      throw new Error(`content/site.hjson: biography.${field} must be a string (use "" until approved text is ready).`);
    }
    if (!site.contact || typeof site.contact !== "object"
        || typeof site.contact.professional_email !== "string"
        || typeof site.contact.personal_note !== "string") {
      throw new Error("content/site.hjson: contact.professional_email and contact.personal_note must be strings.");
    }
  }
  if (!Array.isArray(releases.releases) || !Array.isArray(publications.publications) || !Array.isArray(links.links)) {
    throw new Error("releases.hjson, publications.hjson, and links.hjson must each contain an array.");
  }

  const checkRecords = (records, file, check) => {
    const slugs = new Set();
    records.forEach((record, index) => {
      const context = `${file} entry ${index + 1}`;
      if (!record || typeof record !== "object") throw new Error(`${context} must be an object.`);
      validateSlug(record.slug, context);
      if (slugs.has(record.slug)) throw new Error(`${context}: duplicate slug "${record.slug}".`);
      slugs.add(record.slug);
      check(record, context);
    });
  };

  checkRecords(releases.releases, "content/releases.hjson", (release, context) => {
    for (const field of ["title", "type", "release_date", "artwork"]) {
      requiredString(release[field], field, context);
    }
    if (typeof release.description !== "string") throw new Error(`${context}: description must be a string (use "" when there is no description).`);
    validateDate(release.release_date, "release_date", context);
    if (!release.artwork.startsWith("/assets/")) throw new Error(`${context}: artwork must be a local path under /assets/.`);
    if (!Array.isArray(release.tracks) || !Array.isArray(release.credits)) {
      throw new Error(`${context}: tracks and credits must be arrays.`);
    }
    if (release.tracks.some((track) => typeof track !== "string" && (!track || typeof track !== "object" || typeof track.title !== "string"))) {
      throw new Error(`${context}: each track must be a title string or an object with a title.`);
    }
    if (release.credits.some((credit) => typeof credit !== "string" && (!credit || typeof credit !== "object" || typeof credit.role !== "string" || typeof credit.name !== "string"))) {
      throw new Error(`${context}: each credit must be a string or an object with role and name.`);
    }
    if (!release.license || typeof release.license !== "object" || typeof release.license.name !== "string" || !release.license.name.trim()) {
      throw new Error(`${context}: license must include a name.`);
    }
    if (release.license.url) validateHttpsUrl(release.license.url, "license.url", context);
    if (!release.links || typeof release.links !== "object") {
      throw new Error(`${context}: links must be an object.`);
    }
    for (const [platform, url] of Object.entries(release.links)) {
      if (typeof url !== "string") throw new Error(`${context}: links.${platform} must be a string.`);
      if (url) validateHttpsUrl(url, `links.${platform}`, context);
    }
  });

  checkRecords(publications.publications, "content/publications.hjson", (publication, context) => {
    for (const field of ["title", "date", "type", "summary", "body"]) requiredString(publication[field], field, context);
    validateDate(publication.date, "date", context);
  });
  links.links.forEach((link, index) => {
    const context = `content/links.hjson entry ${index + 1}`;
    if (!link || typeof link !== "object") throw new Error(`${context} must be an object.`);
    requiredString(link.label, "label", context);
    requiredString(link.url, "url", context);
    validateHttpsUrl(link.url, "url", context);
  });

  if (site.featured_release && !releases.releases.some((release) => release.slug === site.featured_release)) {
    throw new Error(`content/site.hjson: featured_release "${site.featured_release}" does not match a release slug.`);
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

function link(route) {
  return `${basePath}${route.replace(/^\/+/, "")}`;
}

function dateLabel(date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}

function pageShell({ title, description, route, body, data = null }) {
  const url = `${canonicalOrigin}${link(route)}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#000000">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" type="application/rss+xml" title="refmaven RSS" href="${link("rss.xml")}">
  <link rel="alternate" type="application/atom+xml" title="refmaven Atom" href="${link("atom.xml")}">
  <link rel="stylesheet" href="${link("style.css")}">
  <script src="${link("theme.js")}" defer></script>
  <title>${escapeHtml(title)} — refmaven</title>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="wordmark" href="${link("")}" aria-label="refmaven home">refmaven<span class="wordmark-dot">.</span></a>
    <nav aria-label="Main navigation">
      <a href="${link("discography/")}">Music</a>
      <a href="${link("posts/")}">Notes</a>
      <a href="${link("about/")}">About</a>
      <a href="${link("links/")}">Links</a>
      <a href="${link("contact/")}">Contact</a>
    </nav>
    <button class="theme-toggle" type="button" aria-label="Switch to light mode" aria-pressed="false" hidden>Light mode</button>
  </header>
  <main id="main">
${body}
  </main>
  <footer class="site-footer">
    <a href="${link("")}">refmaven</a>
    <span>Independent music, kept here.</span>
    <div class="feed-links"><a href="${link("rss.xml")}">RSS</a><a href="${link("atom.xml")}">Atom</a></div>
  </footer>
${data ? `  <script type="application/json" id="archive-data">${safeJson(data)}</script>\n  <script src="${link("search.js")}" defer></script>\n` : ""}</body>
</html>
`;
}

function breadcrumb(label) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${link("")}">Home</a><span aria-hidden="true">/</span><span>${escapeHtml(label)}</span></nav>`;
}

function pageHeading(kicker, title, intro = "") {
  return `<header class="page-heading"><p class="eyebrow">${escapeHtml(kicker)}</p><h1>${escapeHtml(title)}</h1>${intro ? `<p class="lede">${escapeHtml(intro)}</p>` : ""}</header>`;
}

function placeholder(text) {
  return `<p class="empty-note">${escapeHtml(text)}</p>`;
}

function releaseCard(release, compact = false) {
  const route = `discography/${release.slug}/`;
  return `<article class="archive-item">
    <div class="archive-meta"><span>${escapeHtml(release.type)}</span><time datetime="${escapeHtml(release.release_date)}">${escapeHtml(release.release_date.slice(0, 4))}</time></div>
    <h3><a href="${link(route)}">${escapeHtml(release.title)}</a></h3>
    ${!compact && release.description ? `<p>${escapeHtml(release.description)}</p>` : ""}
  </article>`;
}

function publicationCard(publication) {
  return `<article class="archive-item">
    <div class="archive-meta"><span>${escapeHtml(publication.type)}</span><time datetime="${escapeHtml(publication.date)}">${escapeHtml(dateLabel(publication.date))}</time></div>
    <h3><a href="${link(`posts/${publication.slug}/`)}">${escapeHtml(publication.title)}</a></h3>
    <p>${escapeHtml(publication.summary)}</p>
  </article>`;
}

function listMarkup(items, emptyMessage, render) {
  return items.length ? `<div class="archive-list">${items.map(render).join("\n")}</div>` : placeholder(emptyMessage);
}

function releasePage(release, allReleases) {
  const tracks = release.tracks.length
    ? `<ol class="track-list">${release.tracks.map((track) => `<li>${escapeHtml(typeof track === "string" ? track : track.title || "")}${track.duration ? `<span>${escapeHtml(track.duration)}</span>` : ""}</li>`).join("")}</ol>`
    : placeholder("Tracklist not published yet.");
  const credits = release.credits.length ? `<ul class="plain-list">${release.credits.map((credit) => `<li>${escapeHtml(typeof credit === "string" ? credit : `${credit.role}: ${credit.name}`)}</li>`).join("")}</ul>` : placeholder("Credits not published yet.");
  const listenLinks = Object.entries(release.links).filter(([, url]) => typeof url === "string" && url.trim());
  const related = allReleases.filter((item) => item.slug !== release.slug).slice(0, 3);
  const body = `${breadcrumb("Discography")}<article class="detail-page">
    <div class="detail-topline"><span>${escapeHtml(release.type)}</span><time datetime="${escapeHtml(release.release_date)}">${escapeHtml(dateLabel(release.release_date))}</time></div>
    <h1>${escapeHtml(release.title)}</h1>
    <figure class="artwork-frame"><img src="${link(release.artwork)}" alt="${escapeHtml(release.artwork_alt || `${release.title} artwork`)}" loading="eager"></figure>
    ${release.description ? `<div class="prose"><p>${escapeHtml(release.description)}</p></div>` : placeholder("Release description not published yet.")}
    <section class="detail-section"><h2>Tracks</h2>${tracks}</section>
    <section class="detail-section"><h2>Credits</h2>${credits}</section>
    <section class="detail-section"><h2>License</h2><p>${release.license.url ? `<a href="${escapeHtml(release.license.url)}">${escapeHtml(release.license.name)}</a>` : escapeHtml(release.license.name)}</p></section>
    <section class="detail-section"><h2>Listen</h2>${listenLinks.length ? `<ul class="plain-list">${listenLinks.map(([name, url]) => `<li><a href="${escapeHtml(url)}" rel="external noopener">${escapeHtml(name)}</a></li>`).join("")}</ul>` : placeholder("Listening links will appear here when available.")}</section>
    ${related.length ? `<section class="detail-section"><h2>Related releases</h2><div class="related-list">${related.map((item) => `<a href="${link(`discography/${item.slug}/`)}">${escapeHtml(item.title)} <span>${escapeHtml(item.release_date.slice(0, 4))}</span></a>`).join("")}</div></section>` : ""}
  </article>`;
  return pageShell({ title: release.title, description: release.description || `${release.title} — ${release.type} by refmaven.`, route: `discography/${release.slug}/`, body });
}

function publicationPage(publication) {
  const body = `${breadcrumb("Publications")}<article class="detail-page publication-page">
    <div class="detail-topline"><span>${escapeHtml(publication.type)}</span><time datetime="${escapeHtml(publication.date)}">${escapeHtml(dateLabel(publication.date))}</time></div>
    <h1>${escapeHtml(publication.title)}</h1>
    <p class="lede">${escapeHtml(publication.summary)}</p>
    <div class="prose">${publication.body.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("\n")}</div>
  </article>`;
  return pageShell({ title: publication.title, description: publication.summary, route: `posts/${publication.slug}/`, body });
}

async function writePage(route, contents) {
  const destination = path.join(outputDir, route, "index.html");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents, "utf8");
}

const [site, releaseData, publicationData, linkData] = await Promise.all([
  readContent("site.hjson"),
  readContent("releases.hjson"),
  readContent("publications.hjson"),
  readContent("links.hjson"),
]);
validateContent(site, releaseData, publicationData, linkData);
for (const release of releaseData.releases) {
  const artworkPath = path.resolve(root, `.${release.artwork}`);
  if (!artworkPath.startsWith(`${path.join(root, "assets")}${path.sep}`)) {
    throw new Error(`content/releases.hjson: artwork path for "${release.slug}" must resolve inside assets/.`);
  }
  try {
    if (!(await stat(artworkPath)).isFile()) throw new Error("not a file");
  } catch {
    throw new Error(`content/releases.hjson: artwork file for "${release.slug}" was not found at ${release.artwork}.`);
  }
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await copyFile(path.join(root, "style.css"), path.join(outputDir, "style.css"));
await copyFile(path.join(root, "search.js"), path.join(outputDir, "search.js"));
await copyFile(path.join(root, "theme.js"), path.join(outputDir, "theme.js"));
await copyFile(path.join(root, "CNAME"), path.join(outputDir, "CNAME"));
try {
  await cp(path.join(root, "assets"), path.join(outputDir, "assets"), { recursive: true });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await cp(path.join(root, ".well-known"), path.join(outputDir, ".well-known"), { recursive: true });

const releases = [...releaseData.releases].sort((a, b) => b.release_date.localeCompare(a.release_date));
const publications = [...publicationData.publications].sort((a, b) => b.date.localeCompare(a.date));
const featured = releases.find((release) => release.slug === site.featured_release);

const homeBody = `<section class="hero">
  <p class="eyebrow">Independent music / refmaven</p>
  <h1>${escapeHtml(site.name)}</h1>
  ${site.introduction ? `<p class="hero-intro">${escapeHtml(site.introduction)}</p>` : placeholder("Artist introduction — to be written and approved by the artist.")}
  <a class="text-link" href="${link("discography/")}">Explore the discography <span aria-hidden="true">↗</span></a>
</section>
${featured ? `<section class="home-section featured-section"><div class="section-title"><p class="eyebrow">Featured release</p><a href="${link("discography/")}">All music <span aria-hidden="true">↗</span></a></div>${releaseCard(featured)}</section>` : ""}
<section class="home-section"><div class="section-title"><p class="eyebrow">Selected discography</p><a href="${link("discography/")}">Browse all <span aria-hidden="true">↗</span></a></div>${listMarkup(releases.slice(0, 3), "Releases will be listed here when they are ready to publish.", (release) => releaseCard(release, true))}</section>
<section class="home-section"><div class="section-title"><p class="eyebrow">Notes & announcements</p><a href="${link("posts/")}">Publication archive <span aria-hidden="true">↗</span></a></div>${listMarkup(publications.slice(0, 3), "No recent publications. This archive remains available whenever there is something worth keeping.", publicationCard)}</section>
<section class="home-bottom"><p>Find the music elsewhere, or get in touch.</p><div><a href="${link("links/")}">Official links</a><a href="${link("contact/")}">Contact</a></div></section>`;
await writePage("", pageShell({ title: "Independent music", description: "The official home and archive of refmaven.", route: "", body: homeBody }));

const bio = site.biography;
const aboutBody = `${breadcrumb("About")}${pageHeading("About", "A little context")}
<div class="prose about-prose">
  ${bio.short ? `<p class="lede">${escapeHtml(bio.short)}</p>` : placeholder("Short biography — unpublished until written and approved by the artist.")}
  <section><h2>Biography</h2>${bio.extended ? `<p>${escapeHtml(bio.extended).replaceAll("\n", "<br>")}</p>` : placeholder("Extended biography — unpublished until written and approved by the artist.")}</section>
  <section><h2>Musical description</h2>${bio.musical_description ? `<p>${escapeHtml(bio.musical_description).replaceAll("\n", "<br>")}</p>` : placeholder("Optional musical description — not supplied.")}</section>
  <section><h2>Artist statement</h2>${bio.artist_statement ? `<p>${escapeHtml(bio.artist_statement).replaceAll("\n", "<br>")}</p>` : placeholder("Optional artist statement — not supplied.")}</section>
</div>
<section class="detail-section"><h2>Elsewhere</h2>${linkData.links.length ? `<ul class="plain-list">${linkData.links.map((item) => `<li><a href="${escapeHtml(item.url)}" rel="external noopener">${escapeHtml(item.label)}</a></li>`).join("")}</ul>` : placeholder("Official profiles have not been added yet.")}</section>`;
await writePage("about", pageShell({ title: "About", description: "Artist information and official links for refmaven.", route: "about/", body: aboutBody }));

const releaseSearch = `<label class="search-control">Search releases<input type="search" data-archive-search="releases" placeholder="Title, type, year" autocomplete="off"></label>`;
const discographyBody = `${breadcrumb("Discography")}${pageHeading("Archive / 01", "Discography", "A catalogue of released music, kept in chronological order.")}${releaseSearch}
${listMarkup(releases, "No releases have been published here yet.", (release) => `<div data-search-item>${releaseCard(release)}</div>`)}`;
await writePage("discography", pageShell({ title: "Discography", description: "The complete release archive of refmaven.", route: "discography/", body: discographyBody, data: releases.map(({ title, type, release_date }) => ({ title, type, year: release_date.slice(0, 4) })) }));
for (const release of releases) await writePage(`discography/${release.slug}`, releasePage(release, releases));

const publicationSearch = `<label class="search-control">Search publications<input type="search" data-archive-search="publications" placeholder="Title, type, date" autocomplete="off"></label>`;
const postsBody = `${breadcrumb("Publications")}${pageHeading("Archive / 02", "Notes & announcements", "A quiet chronological archive of things worth keeping.")}${publicationSearch}
${listMarkup(publications, "No publications yet. Updates will live here when there is something to share.", (publication) => `<div data-search-item>${publicationCard(publication)}</div>`)}`;
await writePage("posts", pageShell({ title: "Publications", description: "Announcements, release notes, and occasional updates from refmaven.", route: "posts/", body: postsBody, data: publications.map(({ title, type, date }) => ({ title, type, date })) }));
for (const publication of publications) await writePage(`posts/${publication.slug}`, publicationPage(publication));

const email = site.contact.professional_email;
const contactBody = `${breadcrumb("Contact")}${pageHeading("Contact", "Get in touch", "For professional inquiries related to music and the project.")}
<section class="contact-block"><h2>Professional inquiries</h2>${email ? `<p><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>` : placeholder("Official email address — add to content/site.hjson when ready.")}</section>
<section class="contact-block"><h2>Personal correspondence</h2>${site.contact.personal_note ? `<p>${escapeHtml(site.contact.personal_note)}</p>` : placeholder("This site is not a personal messaging channel.")}</section>
<p class="quiet-note">There is no contact form; no information is collected by this site.</p>`;
await writePage("contact", pageShell({ title: "Contact", description: "Official contact information for refmaven.", route: "contact/", body: contactBody }));

const linksBody = `${breadcrumb("Links")}${pageHeading("Directory", "Official links", "A direct directory of official profiles and places to listen.")}
${linkData.links.length ? `<ul class="directory-list">${linkData.links.map((item) => `<li><a href="${escapeHtml(item.url)}" rel="external noopener"><span>${escapeHtml(item.label)}</span><span aria-hidden="true">↗</span></a>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</li>`).join("")}</ul>` : placeholder("Official links have not been added yet.")}`;
await writePage("links", pageShell({ title: "Links", description: "Official profiles and music platforms for refmaven.", route: "links/", body: linksBody }));

const routes = ["", "about/", "discography/", ...releases.map(({ slug }) => `discography/${slug}/`), "posts/", ...publications.map(({ slug }) => `posts/${slug}/`), "contact/", "links/"];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${canonicalOrigin}${link(route)}</loc></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(outputDir, "sitemap.xml"), sitemap, "utf8");
await writeFile(path.join(outputDir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${canonicalOrigin}${link("sitemap.xml")}\n`, "utf8");
await generateFeeds();
console.log(`Built ${routes.length} pages into ${path.relative(root, outputDir)} (base path: ${basePath})`);
