# refmaven — official website

A lightweight, static artist archive built with HTML, CSS, vanilla JavaScript, and HJSON. There is no backend, account system, analytics, tracking, cookies, or third-party runtime script. GitHub Actions builds the site and deploys the generated `dist/` directory to GitHub Pages.

## Requirements

- Node.js 22 or newer
- npm
- Python 3 for the local XML well-formedness check

## Local preview

```sh
npm ci
npm run build
python3 -m http.server 8000 --directory dist
```

Open <http://localhost:8000>. To verify the feeds and generated pages, run `npm run check`.

The base path defaults to `/`. To test a GitHub Pages project path locally, set it during the build:

```sh
BASE_PATH=/repository-name/ npm run build
python3 -m http.server 8000 --directory dist
```

Use the trailing slash. All generated internal links, assets, feeds, and sitemap locations honor this setting. The workflow currently builds for `/`, as configured for the custom domain `xn--om2b.fyi`.

## Editing content

The HJSON files in `content/` are the single source of truth:

- `site.hjson` — site name, artist-written introduction and biography, contact details, and optional featured release slug.
- `releases.hjson` — complete release catalogue; individual release pages and discography entries are generated from these records.
- `publications.hjson` — dated notes and announcements; individual pages and both feeds are generated from these records.
- `links.hjson` — official profile and listening links.

Empty fields are intentional. The biography and introduction must be written and approved by the artist; the build does not infer or generate artist details. The site displays neutral unpublished messages where those fields are empty. Do not put private information in content files.

### HJSON schema

HJSON uses JSON-like objects but permits unquoted keys/strings in many cases. Quote strings when they contain punctuation, `#`, braces, or could be ambiguous. Arrays use square brackets. See the example content files for syntax.

`site.hjson`:

```hjson
{
  name: refmaven
  description: ""
  introduction: ""
  biography: {
    short: ""
    extended: ""
    musical_description: ""
    artist_statement: ""
  }
  contact: {
    professional_email: ""
    personal_note: ""
  }
  featured_release: ""
}
```

`releases.hjson` records require unique lowercase `slug`, `title`, `type`, ISO `release_date` (`YYYY-MM-DD`), local `artwork` path, `description`, `license` object with a `name`, `tracks` and `credits` arrays, and a `links` object. Optional properties include `artwork_alt`, `license.url`, and platform URLs in `links`. Put artwork under `assets/` and use a path such as `/assets/artwork/example.jpg`; copy the corresponding file into an `assets/` directory in the project before publishing the release. The build verifies each release image exists and copies the assets alongside the generated pages. Existing `.well-known/` files are also included in the deploy output.

```hjson
{
  releases: [
    {
      slug: example-release
      title: Example release
      type: EP
      release_date: 2026-01-31
      artwork: /assets/artwork/example.jpg
      artwork_alt: Cover artwork for Example release
      description: ""
      license: {
        name: License name
        url: ""
      }
      tracks: [
        { title: First track, duration: "03:12" }
      ]
      credits: []
      links: {
        bandcamp: ""
        spotify: ""
      }
    }
  ]
}
```

`publications.hjson` records require unique lowercase `slug`, `title`, ISO `date`, `type`, `summary`, and `body`. Separate paragraphs in `body` with a blank line. `links.hjson` records require a `label`, HTTPS `url`, and may include a `description`.

The build validates the fields needed to create pages and reports the source file/record when content is invalid. Add a featured release by setting `featured_release` to its exact slug; leave it empty to omit the section.

## Build and feeds

```sh
npm run build
npm run feeds
npm run check
```

`npm run build` validates HJSON and generates all pages, `rss.xml`, `atom.xml`, `sitemap.xml`, and `robots.txt` in `dist/`. `npm run feeds` generates both feeds from publication content. Feed summaries and dates come from `publications.hjson`; XML text is escaped and dates are represented in UTC. `npm run check` rebuilds the site and parses both feeds as XML.

## GitHub Pages deployment

The workflow at `.github/workflows/static.yml` runs on changes to content or build inputs on `main`, and can also be started manually. It installs the locked npm dependencies, builds and validates the site, then deploys only `dist/` to GitHub Pages. It does not commit generated files back to the source branch.

In the repository's Pages settings, choose **GitHub Actions** as the build and deployment source. The root `CNAME` file configures `xn--om2b.fyi`; point that domain's DNS records to GitHub Pages and enable **Enforce HTTPS** in Pages settings after DNS verification. For a project site without the custom domain, build with `BASE_PATH=/repository-name/` and configure the workflow's `BASE_PATH` accordingly.

The generated site uses directory index routes, for example `/discography/example-release/`, which GitHub Pages serves without rewrite rules. Content and source files remain editable locally; the generated `dist/` directory is ignored by Git.

## Appearance, privacy, and accessibility

The site uses a dense, left-aligned black-on-white layout with a content width capped at 650px. The homepage is a minimal profile with the contact email and RSS/Atom feeds above a newest-first list of posts. There is no theme switch or light-mode setting.

The site has no visitor analytics or engagement metrics. Search filters only the already-loaded archive in the current page; it sends no data. Navigation works without JavaScript, search is an enhancement, keyboard focus is visible, images use alt text, and reduced-motion preferences are respected.
