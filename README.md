# refmaven

A static personal site made from HTML, CSS, and plain JavaScript. The `posts` tab is the homepage, `works` is for music and other projects, and `rss` links directly to the posts feed. There is no framework, package manager, or runtime dependency.

## Preview

Serve the repository root with any static file server. For example:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Write posts

Each post is an object in `posts.js`. A working example post is already included; replace it with your own or add more objects to the array. At least one of `text` or `images` is required. The title is optional; if omitted, the page uses "Post" as its title. Posts are shown newest first and each has a link in the format `#date-title`.

```js
const posts = [
  {
    title: "An optional title",
    images: [
      { src: "/images/photo-one.jpg", alt: "Description of the first image" },
      { src: "/images/photo-two.jpg", alt: "Description of the second image" }
    ],
    text: "Text can go here.\n\nA blank line starts another paragraph."
  },
  {
    date: "2026-11-20",
    text: "A text-only post without a title."
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = posts;
} else {
  globalThis.sitePosts = posts;
}
```

The Pages workflow assigns the commit's authored local calendar date to posts without a `date` field, then commits that generated date to `posts.js` so it stays stable on later builds. Git records the commit author's timezone offset, so the resulting date follows the timezone used when that commit was created. Existing explicit dates are preserved. For a local browser preview before the workflow runs, undated posts use today's date in the browser's timezone. Locally generated RSS uses the latest commit's authored date for undated posts.

Put image files under `images/` and use a site-root path beginning with `/images/`, or use a direct HTTPS image URL such as `https://i.imgur.com/example.jpg`. Each image needs an `alt` description. Image strips scroll horizontally. Posts with more than 600 characters of text show a faded, height-limited preview with a "See more" control.

## RSS feed

`scripts/generate-rss.js` reads the exact same objects from `posts.js` and generates RSS 2.0, including post text and images. Run it with Node's built-in APIs and no package install:

```sh
node scripts/generate-rss.js
```

This writes `rss.xml` in the repository root. You can pass another output path, for example `node scripts/generate-rss.js dist/rss.xml`. The feed includes full post text and images, not the page's collapsed preview. Its item `pubDate` and channel `lastBuildDate` are both set to the generation time, including seconds. The GitHub Pages workflow generates the feed as part of deployment.

## Site files

- `index.html` displays the post stream.
- `works/index.html` is the home for music and other projects.
- `posts.js` is the source of truth consumed by both the browser renderer and RSS generator.
- `site.js` renders and validates posts without injecting HTML.
- `style.css` uses the device's default monospace font and a left-aligned, 650px maximum width.
- `.well-known/` contains domain association files included in deployment.

The site deploys to GitHub Pages. `CNAME` configures `xn--om2b.fyi`.
