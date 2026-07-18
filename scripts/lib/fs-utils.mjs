import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  mkdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';

export async function atomicWriteFile(targetPath, contents, options) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporaryPath, contents, options);
    await rename(temporaryPath, targetPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

export async function atomicWriteJson(targetPath, value) {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  JSON.parse(contents);
  await atomicWriteFile(targetPath, contents, 'utf8');
}
