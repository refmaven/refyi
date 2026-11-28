const { execFileSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

module.exports = function getCommitDate() {
  const commit = process.env.GITHUB_SHA || "HEAD";
  const authoredAt = execFileSync("git", ["show", "-s", "--format=%aI", commit], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const match = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/.exec(authoredAt);
  if (!match) {
    throw new Error(`Could not read the authored local date from commit "${commit}".`);
  }
  return match[1];
};
