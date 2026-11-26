import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Hjson from "hjson";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(root, process.env.OUTPUT_DIR || "dist");
const basePath = normalizeBasePath(process.env.BASE_PATH || "/");
const siteUrl = "https://xn--om2b.fyi";

function normalizeBasePath(value) {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function absoluteUrl(route) {
  return new URL(`${basePath}${route.replace(/^\/+/, "")}`, siteUrl).href;
}

export async function generateFeeds({ now = new Date() } = {}) {
  const source = await readFile(path.join(root, "content/publications.hjson"), "utf8");
  const { publications } = Hjson.parse(source);
  if (!Array.isArray(publications)) {
    throw new Error("content/publications.hjson: publications must be an array.");
  }
  for (const [index, publication] of publications.entries()) {
    const context = `content/publications.hjson entry ${index + 1}`;
    if (!publication || typeof publication !== "object"
        || typeof publication.slug !== "string"
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publication.slug)
        || typeof publication.title !== "string" || !publication.title.trim()
        || typeof publication.summary !== "string" || !publication.summary.trim()
        || typeof publication.date !== "string"
        || !/^\d{4}-\d{2}-\d{2}$/.test(publication.date)
        || Number.isNaN(Date.parse(`${publication.date}T00:00:00Z`))) {
      throw new Error(`${context}: slug, title, summary, and a YYYY-MM-DD date are required to generate feeds.`);
    }
  }
  const ordered = [...publications].sort((a, b) => b.date.localeCompare(a.date));
  const entries = ordered.map((publication) => {
    const url = absoluteUrl(`posts/${publication.slug}/`);
    const date = new Date(`${publication.date}T00:00:00Z`).toUTCString();
    return { publication, url, date };
  });

  const rssItems = entries.map(({ publication, url, date }) => `    <item>
      <title>${escapeXml(publication.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${date}</pubDate>
      <description>${escapeXml(publication.summary)}</description>
    </item>`).join("\n");
  const atomEntries = entries.map(({ publication, url }) => `  <entry>
    <title>${escapeXml(publication.title)}</title>
    <id>${escapeXml(url)}</id>
    <link href="${escapeXml(url)}" />
    <updated>${new Date(`${publication.date}T00:00:00Z`).toISOString()}</updated>
    <summary>${escapeXml(publication.summary)}</summary>
  </entry>`).join("\n");
  const updated = entries.length
    ? new Date(`${entries[0].publication.date}T00:00:00Z`).toISOString()
    : now.toISOString();

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "rss.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>refmaven — publications</title>
    <link>${escapeXml(absoluteUrl(""))}</link>
    <description>Publications from refmaven.</description>
${rssItems}
  </channel>
</rss>
`, "utf8"),
    writeFile(path.join(outputDir, "atom.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>refmaven — publications</title>
  <id>${escapeXml(absoluteUrl(""))}</id>
  <link href="${escapeXml(absoluteUrl(""))}" />
  <updated>${updated}</updated>
${atomEntries}
</feed>
`, "utf8"),
  ]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateFeeds();
}
