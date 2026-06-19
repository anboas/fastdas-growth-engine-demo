import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const html = await readFile(path.join(distDir, "index.html"), "utf8");
const currentEntry = html.match(/src="\.\/(assets\/index(?:-[^"]+)?\.js)"/)?.[1];
const currentCss = html.match(/href="\.\/(assets\/index(?:-[^"]+)?\.css)"/)?.[1];

if (!currentEntry) {
  throw new Error("Unable to find current Vite entry asset in dist/index.html");
}

if (!currentCss) {
  throw new Error("Unable to find current Vite CSS asset in dist/index.html");
}

const staleEntryJsAssets = [
  "assets/index-Cnt_SPVg.js",
  "assets/index-IQjtMQ_D.js",
  "assets/index-DcHDs18b.js",
  "assets/index-_WFwFz9J.js",
];

const staleChunkJsBridges = {
  "assets/rolldown-runtime-BpQH8Ho1.js": "assets/rolldown-runtime.js",
  "assets/react-vendor-DLXOKURV.js": "assets/react-vendor.js",
  "assets/control-surface-ui-D5nDe8Ch.js": "assets/control-surface-ui.js",
};

const staleEntryCssAssets = [
  "assets/index-DocpHply.css",
  "assets/index-yDrRylRZ.css",
];

const staleChunkCssBridges = {
  "assets/control-surface-ui-B0ozY_LW.css": "assets/control-surface-ui.css",
};

await mkdir(path.join(distDir, "assets"), { recursive: true });

await Promise.all(staleEntryJsAssets.map(async staleAsset => {
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

await Promise.all(Object.entries(staleChunkJsBridges).map(async ([staleAsset, targetAsset]) => {
  const relativeTarget = `./${path.basename(targetAsset)}`;
  const bridge = [
    "/* Bridge for GitLab Pages edge nodes that briefly serve stale hashed modulepreload assets. */",
    `import(${JSON.stringify(relativeTarget)});`,
    "",
  ].join("\n");

  await writeFile(path.join(distDir, staleAsset), bridge, "utf8");
}));

await Promise.all(staleEntryCssAssets.map(async staleAsset => {
  if (staleAsset === currentCss) {
    return;
  }

  const relativeTarget = `./${path.basename(currentCss)}`;
  const bridge = [
    "/* Bridge for GitLab Pages edge nodes that briefly serve stale hashed HTML. */",
    `@import url(${JSON.stringify(relativeTarget)});`,
    "",
  ].join("\n");

  await writeFile(path.join(distDir, staleAsset), bridge, "utf8");
}));

await Promise.all(Object.entries(staleChunkCssBridges).map(async ([staleAsset, targetAsset]) => {
  const relativeTarget = `./${path.basename(targetAsset)}`;
  const bridge = [
    "/* Bridge for GitLab Pages edge nodes that briefly serve stale hashed stylesheets. */",
    `@import url(${JSON.stringify(relativeTarget)});`,
    "",
  ].join("\n");

  await writeFile(path.join(distDir, staleAsset), bridge, "utf8");
}));
