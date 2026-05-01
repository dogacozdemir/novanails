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

const iconMap = new Map([
  ["CheckCircle2", "check-circle-2"],
  ["ClipboardCheck", "clipboard-check"],
  ["Clock", "clock"],
  ["MessageCircle", "message-circle"],
  ["Phone", "phone"],
  ["Send", "send"],
  ["Slash", "slash"],
  ["CalendarDays", "calendar-days"],
  ["ChevronRight", "chevron-right"],
  ["ClipboardList", "clipboard-list"],
  ["TrendingUp", "trending-up"],
  ["Eye", "eye"],
  ["EyeOff", "eye-off"],
  ["Loader2", "loader-2"],
  ["Menu", "menu"],
  ["Plus", "plus"],
  ["X", "x"],
  ["UserPlus", "user-plus"],
  ["ArrowLeft", "arrow-left"],
  ["Search", "search"],
  ["Settings", "settings"],
  ["Sparkles", "sparkles"],
  ["Users", "users"],
  ["Pencil", "pencil"],
  ["Trash2", "trash-2"],
  ["ChevronsUpDown", "chevrons-up-down"],
  ["Download", "download"],
  ["LogOut", "log-out"],
  ["UserRound", "user-round"],
  ["TrendingDown", "trending-down"],
  ["User", "user"],
  ["WifiOff", "wifi-off"],
]);

const root = path.join(process.cwd(), "src");

for (const file of walkTs(root)) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes('from "lucide-react"') && !s.includes("from 'lucide-react'"))
    continue;

  const lineRe = /^import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']\s*;?\s*$/gm;
  let changed = false;

  s = s.replace(lineRe, (_, inner) => {
    changed = true;
    const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);
    const lines = [];
    for (const part of parts) {
      const name = part.split(/\s+as\s+/)[0].trim();
      const kebab = iconMap.get(name);
      if (!kebab) {
        console.error(`Unknown lucide icon "${name}" in ${file}`);
        process.exit(1);
      }
      lines.push(
        `import ${name} from "lucide-react/dist/esm/icons/${kebab}.mjs";`
      );
    }
    return lines.join("\n");
  });

  if (changed) {
    fs.writeFileSync(file, s);
    console.log("lucide-esm", path.relative(process.cwd(), file));
  }
}
