const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const postsPath = path.join(root, "posts.js");
const posts = require(postsPath);
const getCommitDate = require("./get-commit-date");

async function stampPostDates() {
  if (!Array.isArray(posts)) {
    throw new TypeError("posts.js must define an array.");
  }

  const date = getCommitDate();
  let changed = false;
  const datedPosts = posts.map((post) => {
    if (post && post.date === undefined) {
      changed = true;
      return { ...post, date };
    }
    return post;
  });

  if (!changed) return;

  const output = `const posts = ${JSON.stringify(datedPosts, null, 2)};\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = posts;\n} else {\n  globalThis.sitePosts = posts;\n}\n`;
  await fs.writeFile(postsPath, output, "utf8");
}

stampPostDates().catch((error) => {
  console.error(`Post date generation failed: ${error.message}`);
  process.exitCode = 1;
});
