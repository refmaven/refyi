const postList = document.querySelector("[data-post-list]");

if (postList) {
  const postPreviewLength = 600;

  function localDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function postAnchorId(post) {
    const titleSlug = (post.title?.trim() || "post")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "post";
    return `${post.date}-${titleSlug}`;
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

    const fallbackDate = localDate();
    posts = posts.map((post) => (
      post && post.date === undefined ? { ...post, date: fallbackDate } : post
    ));

    const anchorIds = new Set();
    posts.forEach((post, index) => {
      const date = typeof post?.date === "string" ? new Date(`${post.date}T00:00:00Z`) : null;
      if (!post
          || typeof post.date !== "string"
          || !/^\d{4}-\d{2}-\d{2}$/.test(post.date)
          || !date
          || Number.isNaN(date.getTime())
          || date.toISOString().slice(0, 10) !== post.date
          || (post.title !== undefined && typeof post.title !== "string")
          || (post.text !== undefined && typeof post.text !== "string")
          || (post.images !== undefined && !Array.isArray(post.images))
          || (!post.text?.trim() && !post.images?.length)) {
        throw new TypeError(`Invalid post record at index ${index}.`);
      }

      const anchorId = postAnchorId(post);
      if (anchorIds.has(anchorId)) {
        throw new TypeError(`Duplicate post anchor "${anchorId}".`);
      }
      anchorIds.add(anchorId);

      for (const image of post.images || []) {
        if (!image
            || typeof image.src !== "string"
            || !isAllowedImageSource(image.src)
            || typeof image.alt !== "string") {
          throw new TypeError(`Invalid image in post "${anchorId}".`);
        }
      }
    });

    return posts.map((post) => ({ ...post, id: postAnchorId(post) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function appendParagraphs(container, text) {
    for (const paragraph of text.split(/\n{2,}/)) {
      const p = document.createElement("p");
      p.textContent = paragraph;
      container.append(p);
    }
  }

  function renderPost(post) {
    const article = document.createElement("article");
    article.className = "post";
    article.id = post.id;

    const header = document.createElement("header");
    const title = document.createElement("h2");
    const permalink = document.createElement("a");
    permalink.href = `#${post.id}`;
    const date = document.createElement("time");
    date.dateTime = post.date;
    date.textContent = post.date;
    permalink.append(date, ` ${post.title?.trim() || "Post"}`);
    title.append(permalink);
    header.append(title);
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
      const postText = post.text.trim();
      const text = document.createElement("div");
      text.className = "post-text";
      appendParagraphs(text, postText);

      if (postText.length > postPreviewLength) {
        text.classList.add("post-text-collapsed");
        const toggle = document.createElement("button");
        toggle.className = "post-expander";
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "See more";
        toggle.addEventListener("click", () => {
          const expanded = toggle.getAttribute("aria-expanded") !== "true";
          toggle.setAttribute("aria-expanded", String(expanded));
          toggle.textContent = expanded ? "See less" : "See more";
          text.classList.toggle("post-text-collapsed", !expanded);
        });
        article.append(text, toggle);
      } else {
        article.append(text);
      }
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
