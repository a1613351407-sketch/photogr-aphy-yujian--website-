import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "index.html", "style.css", "live.css", "app.js",
  "east-lake.jpeg", "wetland.jpeg", "forest.jpg",
  "place-luoyan.jpg", "jinyin.jpg", "place-moshan.jpg", "tingtao.png", "place-jiangtan.jpg", "place-jiufeng.jpg",
];
const assets = {};
for (const name of files) {
  const raw = await readFile(resolve(root, "site", name));
  const binary = [".jpeg", ".jpg", ".png", ".webp"].includes(extname(name).toLowerCase());
  assets[name] = { encoding: binary ? "base64" : "utf8", body: binary ? raw.toString("base64") : raw.toString("utf8") };
}

const source = await readFile(resolve(root, "worker/index.js"), "utf8");
const marker = "/*__JINGQU_ASSETS__*/ {}";
if (!source.includes(marker)) throw new Error("Asset marker missing from worker source");
const output = source.replace(marker, JSON.stringify(assets));
await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(resolve(root, "dist/server"), { recursive: true });
await mkdir(resolve(root, "dist/.openai"), { recursive: true });
await writeFile(resolve(root, "dist/server/index.js"), output);
await writeFile(resolve(root, "dist/.openai/hosting.json"), await readFile(resolve(root, ".openai/hosting.json")));
console.log("Built Sites Worker with embedded assets");
