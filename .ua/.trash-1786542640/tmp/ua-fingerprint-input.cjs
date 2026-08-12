const fs = require('fs');
const [scanPath, outputPath, projectRoot, gitCommitHash] = process.argv.slice(2);
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
fs.writeFileSync(outputPath, JSON.stringify({
  projectRoot,
  sourceFilePaths: scan.files.map((file) => file.path),
  gitCommitHash,
}, null, 2));
