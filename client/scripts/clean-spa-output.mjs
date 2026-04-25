import { rm, readdir } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve(process.cwd(), '..', 'theme', 'static', 'spa');
const assetsDir = path.join(outputDir, 'assets');

async function cleanAssetsDir() {
  let entries = [];
  try {
    entries = await readdir(assetsDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      await rm(path.join(assetsDir, entry.name), { recursive: true, force: true });
    }),
  );
}

await cleanAssetsDir();
