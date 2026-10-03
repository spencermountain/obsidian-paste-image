import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const manifestPath = resolve(root, 'manifest.json');
const pluginDirectory = process.env.OBSIDIAN_PLUGIN_DIR ||
  '/Users/spencer/Documents/work/.obsidian/plugins/paste-image';

const config = args => {
  const development = Boolean(args.watch);
  const plugins = [];
  if (development) {
    plugins.push({
      name: 'dev-vault-assets',
      buildStart() {
        this.addWatchFile(manifestPath);
      },
      async generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'manifest.json', source: await readFile(manifestPath, 'utf8') });
      },
    });
  }
  return {
    input: resolve(root, 'src/main.js'),
    external: ['obsidian'],
    output: {
      file: resolve(development ? pluginDirectory : root, 'main.js'),
      format: 'cjs',
      exports: 'default',
      sourcemap: development && 'inline',
    },
    plugins,
    watch: { clearScreen: false },
  };
};

export default config;
