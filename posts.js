const posts = [
  {
    "title": "Example post",
    "images": [
      {
        "src": "/images/example-post.svg",
        "alt": "An abstract black-and-white example image"
      }
    ],
    "text": "This is a demo post. Replace it with your own post object in posts.js. The first part of this post is visible immediately, while the rest is tucked behind the See more control. This makes it easier to browse a stream of posts without hiding the full text.\n\nLong posts can still use paragraphs, just like shorter ones. When you expand this post, you’ll see the rest of this paragraph along with one more paragraph below. The See less control collapses the extra text again, and the post’s date and title link to its own address in the format #2026-11-28-example-post.\n\nTry replacing this sample with a longer note of your own. Posts with more than 600 characters show the preview and expand control automatically; shorter posts stay fully visible. The same date-title address is used by the post heading and its RSS feed entry.",
    "date": "2026-11-28"
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = posts;
} else {
  globalThis.sitePosts = posts;
}
