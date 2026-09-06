#!/usr/bin/env node
// Hook PostToolUse (Write|Edit): pasa el archivo tocado por Prettier y, si es
// JS/TS, por `eslint --fix`. No bloquea nunca (siempre termina con exit 0).
// Recibe el JSON del hook por stdin.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const LINTABLE = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const SKIP_SEGMENTS = new Set(["node_modules", ".next"]);

async function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;

  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    process.exit(0);
  }

  const filePath = payload?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const projectDir = process.cwd();
  const abs = path.resolve(projectDir, filePath);
  const rel = path.relative(projectDir, abs);

  // Fuera del proyecto (plan, memoria, rutas absolutas de otro árbol).
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel))
    process.exit(0);
  // Carpetas que no se tocan.
  if (rel.split(path.sep).some((seg) => SKIP_SEGMENTS.has(seg)))
    process.exit(0);
  if (!existsSync(abs)) process.exit(0);

  // Se invocan los CLI de Node directamente con el node actual: es portable y
  // evita el fallo de spawn de `npx.cmd` en Windows.
  const prettierCli = path.join(
    projectDir,
    "node_modules",
    "prettier",
    "bin",
    "prettier.cjs"
  );
  const eslintCli = path.join(
    projectDir,
    "node_modules",
    "eslint",
    "bin",
    "eslint.js"
  );

  const run = (cli, args) => {
    if (!existsSync(cli)) return;
    try {
      execFileSync(process.execPath, [cli, ...args, abs], {
        cwd: projectDir,
        stdio: "inherit",
      });
    } catch {
      // No bloquea.
    }
  };

  // 1) Prettier — --ignore-unknown hace seguro pasar cualquier tipo de archivo.
  run(prettierCli, ["--write", "--ignore-unknown"]);

  // 2) ESLint --fix solo para extensiones lintables. Los problemas que queden
  // se muestran por stdio y el hook termina en 0 igual.
  if (LINTABLE.has(path.extname(abs).toLowerCase())) {
    run(eslintCli, ["--fix"]);
  }

  process.exit(0);
}

main();
