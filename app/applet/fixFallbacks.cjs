const fs = require('fs');
const files = [
  'src/components/ManualFlashcardImporter.tsx',
  'src/components/ExportStudyReport.tsx',
  'src/components/DocumentConverter.tsx'
];
files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/\|\|\s*index\}/g, '|| `fallback-${index}`}');
    content = content.replace(/\|\|\s*idx\}/g, '|| `fallback-${idx}`}');
    content = content.replace(/key=\{card\.id\}/g, 'key={card.id || `card-${idx}`}');
    fs.writeFileSync(f, content);
  }
});
console.log('done fallback keys');
