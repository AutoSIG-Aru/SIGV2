import { parse } from '@babel/parser'
import { readFileSync, statSync } from 'fs'
import { readdir } from 'fs/promises'
import path from 'path'

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, files)
    else if (/\.(jsx?|mjs)$/.test(entry.name)) files.push(full)
  }
  return files
}

const allFiles = (await walk('src')).sort()

let allOk = true
for (const f of allFiles) {
  try {
    const src = readFileSync(f, 'utf8').replace(/\0/g, '')
    parse(src, { sourceType: 'module', plugins: ['jsx'] })
  } catch (e) {
    allOk = false
    console.log(`FAIL ${f}: ${e.message}`)
  }
}
if (allOk) console.log(`✓ Todos os ${allFiles.length} arquivos parseiam corretamente.`)
process.exit(allOk ? 0 : 1)
