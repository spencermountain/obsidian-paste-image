import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('release/', root);
const assets = ['main.js', 'manifest.json', 'styles.css'];

await mkdir(output, { recursive: true });
const unexpected = (await readdir(output)).filter(name => !assets.includes(name));
if (unexpected.length) {
  throw new Error(`Release folder contains unexpected files: ${unexpected.join(', ')}. Move them before rebuilding.`);
}

for (const name of assets) {
  const source = new URL(name, root);
  const destination = new URL(name, output);
  if (name === 'styles.css' && !existsSync(source)) {
    // Remove only our stale optional asset; never delete unrelated files.
    if (existsSync(destination)) {
      await unlink(destination);
    }
  } else {
    await copyFile(source, destination);
  }
}
process.stdout.write(`Release assets ready in ${fileURLToPath(output)}\n`);
