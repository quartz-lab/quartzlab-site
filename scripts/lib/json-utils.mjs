import { readFile } from 'node:fs/promises';

function jsonErrorLocation(contents, error) {
  const lineColumn = String(error?.message || '').match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColumn) {
    return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
  }

  const positionMatch = String(error?.message || '').match(/position\s+(\d+)/i);
  const position = positionMatch
    ? Math.min(Number(positionMatch[1]), contents.length)
    : contents.length;
  const beforeError = contents.slice(0, position);
  const lines = beforeError.split(/\r?\n/);
  return {
    line: lines.length,
    column: (lines.at(-1)?.length || 0) + 1,
  };
}

export function parseJsonText(contents, filePath = '<JSON>') {
  try {
    return JSON.parse(contents);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const { line, column } = jsonErrorLocation(contents, error);
    const explanation = String(error.message || 'Invalid JSON')
      .replace(/\s+at position\s+\d+(?:\s+\(line\s+\d+\s+column\s+\d+\))?$/i, '')
      .replace(/\s+in JSON at position\s+\d+$/i, '');
    throw new SyntaxError(
      `Invalid JSON in ${filePath} at line ${line}, column ${column}: ${explanation}`,
      { cause: error },
    );
  }
}

export async function readJsonFile(filePath) {
  const contents = await readFile(filePath, 'utf8');
  return parseJsonText(contents, filePath);
}
