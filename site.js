const postList = document.querySelector("[data-post-list]");

if (postList) {
  function postSlug(post, index) {
    return post.slug || `post-${post.date}-${index + 1}`;
  }

  function isAllowedImageSource(source) {
    if (source.startsWith("/images/")) {
      return !source.split("/").includes("..") && !source.includes("\\");
    }

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

  function validatePosts(posts) {
    if (!Array.isArray(posts)) {
      throw new TypeError("posts.js must define an array.");
    }

    const slugs = new Set();
    posts.forEach((post, index) => {
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

      const slug = postSlug(post, index);
      if (slugs.has(slug)) {
        throw new TypeError(`Duplicate post slug "${slug}".`);
      }
      slugs.add(slug);

      for (const image of post.images || []) {
        if (!image
            || typeof image.src !== "string"
            || !isAllowedImageSource(image.src)
            || typeof image.alt !== "string") {
          throw new TypeError(`Invalid image in post "${slug}".`);
        }
      }
    });

    return posts.map((post, index) => ({ ...post, slug: postSlug(post, index) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function renderPost(post) {
    const article = document.createElement("article");
    article.className = "post";
    article.id = post.slug;

    const header = document.createElement("header");
    if (post.title?.trim()) {
      const title = document.createElement("h2");
      title.textContent = post.title;
      header.append(title);
    }

    const date = document.createElement("time");
    date.dateTime = post.date;
    date.textContent = post.date.replaceAll("-", "/");
    header.append(date);
    article.append(header);

    if (post.images?.length) {
      const gallery = document.createElement("div");
      gallery.className = "post-images";
      gallery.setAttribute("role", "group");
      gallery.setAttribute("aria-label", `Images for ${post.title?.trim() || post.date}`);
      gallery.tabIndex = 0;
      for (const image of post.images) {
        const img = document.createElement("img");
        img.src = image.src;
        img.alt = image.alt;
        img.loading = "lazy";
        gallery.append(img);
      }
      article.append(gallery);
    }

    if (post.text?.trim()) {
      const text = document.createElement("div");
      text.className = "post-text";
      for (const paragraph of post.text.trim().split(/\n{2,}/)) {
        const p = document.createElement("p");
        p.textContent = paragraph;
        text.append(p);
      }
      article.append(text);
    }

    return article;
  }

  try {
    const posts = validatePosts(globalThis.sitePosts);
    postList.replaceChildren();
    if (!posts.length) {
      const message = document.createElement("p");
      message.className = "empty-note";
      message.textContent = "No posts yet.";
      postList.append(message);
    } else {
      postList.append(...posts.map(renderPost));
    }
  } catch (error) {
    console.error("Could not display posts:", error);
    const message = document.createElement("p");
    message.className = "empty-note";
    message.textContent = "Posts could not be displayed.";
    postList.replaceChildren(message);
  }
}
