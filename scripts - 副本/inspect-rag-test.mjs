import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
import fs from 'node:fs/promises';
import path from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) throw new Error('需要输入 XLSX 路径。');
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const previewDirectory = path.resolve(process.cwd(), 'outputs', 'rag-test-preview');
await fs.mkdir(previewDirectory, { recursive: true });
const summary = await workbook.inspect({
  kind: 'workbook,sheet,table',
  maxChars: 16000,
  tableMaxRows: 60,
  tableMaxCols: 40,
  tableMaxCellChars: 180,
});
console.log(summary.ndjson);
const formulaErrors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
  options: { useRegex: true, maxResults: 100 },
  summary: 'formula error scan',
});
console.log(formulaErrors.ndjson);
for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  const range = used ? used.address : 'A1';
  const preview = await workbook.render({ sheetName: sheet.name, range, scale: 1, format: 'png' });
  const bytes = new Uint8Array(await preview.arrayBuffer());
  await fs.writeFile(path.join(previewDirectory, `${sheet.name.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}-preview.png`), bytes);
}
