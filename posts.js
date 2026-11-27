const posts = [
  {
    slug: "example-post",
    date: "2026-11-28",
    title: "Example post",
    images: [
      { src: "/images/example-post.svg", alt: "An abstract black-and-white example image" }
    ],
    text: "This is a demo post. Replace it with your own post object in posts.js."
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = posts;
} else {
  globalThis.sitePosts = posts;
}
