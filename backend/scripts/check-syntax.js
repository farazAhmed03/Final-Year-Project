const { execFileSync } = require("child_process");
const { readdirSync, statSync } = require("fs");
const { join } = require("path");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(join(__dirname, "..", "src")).filter((file) => file.endsWith(".js"));
for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
console.log(`Syntax checked ${files.length} backend files.`);
