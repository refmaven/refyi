const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const posts = require(path.join(root, "posts.js"));
const defaultOutput = path.join(root, "rss.xml");
const siteUrl = "https://xn--om2b.fyi";

function isExternalImageSource(source) {
  if (!/^https:\/\//i.test(source)) {
    return false;
  }

  try {
    const url = new URL(source);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isLocalImageSource(source) {
  return source.startsWith("/images/")
    && !source.split("/").includes("..")
    && !source.includes("\\");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function validatePosts(posts) {
  if (!Array.isArray(posts)) {
    throw new TypeError("posts.js must define an array.");
  }

  const slugs = new Set();
  for (const [index, post] of posts.entries()) {
    const date = typeof post?.date === "string" ? new Date(`${post.date}T00:00:00Z`) : null;
    if (!post
        || typeof post.date !== "string"
        || !/^\d{4}-\d{2}-\d{2}$/.test(post.date)
        || !date
        || Number.isNaN(date.getTime())
        || date.toISOString().slice(0, 10) !== post.date
        || (post.slug !== undefined && (typeof post.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)))
        || (post.title !== undefined && typeof post.title !== "string")
        || (post.text !== undefined && typeof post.text !== "string")
        || (post.images !== undefined && !Array.isArray(post.images))
        || (!post.text?.trim() && !post.images?.length)) {
      throw new TypeError(`Invalid post record at index ${index}.`);
    }

    const slug = post.slug || `post-${post.date}-${index + 1}`;
    if (slugs.has(slug)) {
      throw new TypeError(`Duplicate post slug "${slug}".`);
    }
    slugs.add(slug);

    for (const image of post.images || []) {
      if (!image
          || typeof image.src !== "string"
          || (!isLocalImageSource(image.src) && !isExternalImageSource(image.src))
          || typeof image.alt !== "string") {
        throw new TypeError(`Invalid image in post "${slug}".`);
      }
    }
  }

  return posts.map((post, index) => ({
    ...post,
    slug: post.slug || `post-${post.date}-${index + 1}`,
  })).sort((a, b) => b.date.localeCompare(a.date));
}

function postHtml(post) {
  const images = (post.images || []).map((image) => {
    const src = new URL(image.src, siteUrl).href;
    return `<p><img src="${escapeXml(src)}" alt="${escapeXml(image.alt)}"></p>`;
  }).join("\n");
  const paragraphs = (post.text || "").trim().split(/\n{2,}/).filter(Boolean)
    .map((paragraph) => `<p>${escapeXml(paragraph).replaceAll("\n", "<br>")}</p>`).join("\n");
  return [images, paragraphs].filter(Boolean).join("\n");
}

async function generateRss(outputPath = defaultOutput) {
  const orderedPosts = validatePosts(posts);
  for (const post of orderedPosts) {
    for (const image of post.images || []) {
      if (isExternalImageSource(image.src)) continue;
      const imagePath = path.resolve(root, `.${image.src}`);
      try {
        if (!(await fs.stat(imagePath)).isFile()) {
          throw new Error("not a file");
        }
      } catch (error) {
        throw new Error(`Post "${post.slug}" references an unreadable image: ${image.src}`, { cause: error });
      }
    }
  }

  const items = orderedPosts.map((post) => {
    const url = `${siteUrl}/#${encodeURIComponent(post.slug)}`;
    const pubDate = new Date(`${post.date}T00:00:00Z`).toUTCString();
    const title = post.title?.trim() || `Post — ${post.date}`;
    const description = post.text?.trim() || `Post from ${post.date}.`;
    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
      <content:encoded>${escapeXml(postHtml(post))}</content:encoded>
    </item>`;
  }).join("\n");
  const updated = orderedPosts.length
    ? new Date(`${orderedPosts[0].date}T00:00:00Z`).toUTCString()
    : "";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>refmaven — posts</title>
    <link>${siteUrl}/</link>
    <description>Posts from refmaven.</description>
${updated ? `    <lastBuildDate>${updated}</lastBuildDate>\n` : ""}${items}
  </channel>
</rss>
`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, xml, "utf8");
}

generateRss(process.argv[2] ? path.resolve(process.argv[2]) : defaultOutput)
  .catch((error) => {
    console.error(`RSS generation failed: ${error.message}`);
    process.exitCode = 1;
  });
