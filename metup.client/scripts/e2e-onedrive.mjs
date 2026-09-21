// O OneDrive transforma os arquivos de tests/e2e em "reparse points" (mesmo com a pasta fixada
// como "Sempre manter neste dispositivo"). O Node enxerga reparse point como link simbólico, e o
// Playwright ignora links: a suíte some em silêncio ("0 tests in 0 files").
//
// Este script roda antes de todo `npm run test:e2e` (pretest:e2e) e:
//   1. regrava como arquivo comum cada arquivo de tests/e2e que virou reparse point (mesmo conteúdo);
//   2. confere que todo *.spec.ts do disco é arquivo comum — senão falha com mensagem clara.
// `npm run test:e2e:fix` roda só a regravação. Ver tests/e2e/README.md.
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const ROOT = new URL("../tests/e2e/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const fixOnly = process.argv.includes("--fix")

// O `lstat` do Node não reconhece a etiqueta de nuvem do OneDrive como link; o `readdir` (que é o
// que o Playwright usa) reconhece. Por isso a detecção é pela entrada do diretório.
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.name.startsWith(".")) return []
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const isReparse = (file) =>
  readdirSync(dirname(file), { withFileTypes: true }).some((entry) => join(dirname(file), entry.name) === file && entry.isSymbolicLink())

const files = walk(ROOT)
const rewritten = []
for (const file of files) {
  if (!isReparse(file)) continue
  const content = readFileSync(file)
  unlinkSync(file)
  writeFileSync(file, content)
  rewritten.push(file)
}
if (rewritten.length > 0) {
  console.log(`[e2e] OneDrive: ${rewritten.length} arquivo(s) de tests/e2e regravado(s) como arquivo comum.`)
}
if (fixOnly) process.exit(0)

const specs = files.filter((file) => file.endsWith(".spec.ts"))
const broken = specs.filter(isReparse)
if (specs.length === 0 || broken.length > 0) {
  console.error(
    [
      `[e2e] O Playwright não vai enxergar ${broken.length || "os"} spec(s) de ${specs.length} em disco.`,
      "O OneDrive deixou os arquivos como reparse point e a regravação não resolveu.",
      "Rode `npm run test:e2e:fix`, feche o que estiver segurando os arquivos e tente de novo.",
      ...broken.map((file) => `  - ${file}`),
    ].join("\n")
  )
  process.exit(1)
}
console.log(`[e2e] ${specs.length} specs prontos para o Playwright.`)
