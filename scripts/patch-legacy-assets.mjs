import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const html = await readFile(path.join(distDir, "index.html"), "utf8");
const currentEntry = html.match(/src="\.\/(assets\/index-[^"]+\.js)"/)?.[1];

if (!currentEntry) {
  throw new Error("Unable to find current Vite entry asset in dist/index.html");
}

const staleEntryAssets = [
  "assets/index-Cnt_SPVg.js",
];

await mkdir(path.join(distDir, "assets"), { recursive: true });

await Promise.all(staleEntryAssets.map(async staleAsset => {
  if (staleAsset === currentEntry) {
    return;
  }

  const relativeTarget = `./${path.basename(currentEntry)}`;
  const bridge = [
    "/* Bridge for GitLab Pages edge nodes that briefly serve stale hashed HTML. */",
    `import(${JSON.stringify(relativeTarget)});`,
    "",
  ].join("\n");

  await writeFile(path.join(distDir, staleAsset), bridge, "utf8");
}));
