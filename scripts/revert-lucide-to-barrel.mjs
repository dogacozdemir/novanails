import fs from "node:fs";
import path from "node:path";

function walkTs(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTs(p, out);
    else if (/\.tsx?$/.test(ent.name) && !ent.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

const lineRe =
  /^import\s+(\w+)\s+from\s+"lucide-react\/dist\/esm\/icons\/[\w-]+(?:\.mjs)?";?\s*$/;

const root = path.join(process.cwd(), "src");

for (const file of walkTs(root)) {
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.includes("lucide-react/dist/esm/icons/")) continue;

  const lines = raw.split("\n");
  const names = [];
  const kept = [];

  for (const line of lines) {
    const m = line.match(lineRe);
    if (m) names.push(m[1]);
    else kept.push(line);
  }

  if (names.length === 0) continue;

  const barrel = `import { ${[...new Set(names)].sort().join(", ")} } from "lucide-react";`;

  let insertAt = 0;
  if (kept[0] === '"use client";') {
    insertAt = 1;
    while (insertAt < kept.length && kept[insertAt] === "") insertAt += 1;
    kept.splice(insertAt, 0, barrel, "");
  } else {
    kept.unshift(barrel, "");
  }

  const nextFile = kept.join("\n").replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync(file, nextFile.endsWith("\n") ? nextFile : `${nextFile}\n`);
  console.log("barrel", path.relative(process.cwd(), file));
}
