#!/usr/bin/env node
/**
 * Copie les fichiers partagés (source unique : packages/shared/) dans chaque app.
 * Chaque app est déployée séparément sur Vercel : elle doit contenir sa propre copie.
 *
 *   node scripts/sync-shared.js           copie les fichiers
 *   node scripts/sync-shared.js --check   vérifie qu'ils sont à jour (utilisé par le CI et les tests)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SHARED = path.join(ROOT, "packages", "shared");

// `files` : fichier source → chemin de destination dans l'app.
const TARGETS = [
  {
    name: "web", dir: "apps/web",
    files: { "update-manager.js": "js/update-manager.js", "motion.js": "js/motion.js", "motion.css": "css/motion.css" },
  },
  {
    name: "merchant", dir: "apps/merchant",
    files: { "update-manager.js": "update-manager.js", "motion.js": "motion.js", "motion.css": "motion.css" },
  },
  { name: "admin", dir: "apps/admin", files: { "update-manager.js": "public/update-manager.js" } },
];
const TOOLS = ["build-update-kit.cjs", "sw-template.js"]; // copiés dans <app>/tools/

const check = process.argv.includes("--check");
let stale = 0;

function copy(src, dest) {
  const wanted = fs.readFileSync(src);
  const current = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
  if (current && current.equals(wanted)) return;
  if (check) {
    console.error("✗ pas à jour : " + path.relative(ROOT, dest));
    stale++;
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, wanted);
  console.log("✓ copié : " + path.relative(ROOT, dest));
}

for (const t of TARGETS) {
  const base = path.join(ROOT, t.dir);
  if (!fs.existsSync(base)) {
    console.error("Dossier introuvable pour « " + t.name + " » : " + t.dir + " (voir TARGETS dans scripts/sync-shared.js)");
    stale++;
    continue;
  }
  for (const [from, to] of Object.entries(t.files)) copy(path.join(SHARED, from), path.join(base, to));
  for (const f of TOOLS) copy(path.join(SHARED, f), path.join(base, "tools", f));
}

if (check) {
  if (stale) {
    console.error("\nLes fichiers partagés ne sont pas synchronisés. Lancez : npm run sync:shared");
    process.exit(1);
  }
  console.log("Fichiers partagés synchronisés dans les 3 apps.");
}
