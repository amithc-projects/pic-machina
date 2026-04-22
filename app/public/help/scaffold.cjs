const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../../docs/transformations.md');
const outputDir = path.join(__dirname);

const mdContent = fs.readFileSync(inputPath, 'utf8');

let currentTag = 'general';

const lines = mdContent.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // Track current Category (e.g., ## Geometric & Framing)
  if (line.startsWith('## ') && !line.startsWith('### ')) {
    currentTag = line.replace('## ', '').trim();
  }
  
  // Look for table rows: | `geo-resize` | Resize | ...
  if (line.startsWith('|') && line.includes('`')) {
    const cells = line.split('|').map(s => s.trim());
    if (cells.length >= 5) {
      // cells[0] is empty, cells[1] is ID
      const idMatch = cells[1].match(/\`(.*?)\`/);
      if (idMatch) {
        const id = idMatch[1];
        const name = cells[2];
        const params = cells[3];
        const notes = cells[4];
        
        // Exclude table header bounds
        if (id !== 'Transform ID' && !id.includes('---')) {
          const filepath = path.join(outputDir, `${id}.md`);
          
          let cleanNotes = notes;
          if (cleanNotes === '-') cleanNotes = 'This node operates automatically with no special notes.';
          
          const content = `---
tags: [${currentTag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}]
---
# ${name}

${cleanNotes}

`;

          // Write file if it doesn't exist
          if (!fs.existsSync(filepath)) {
             fs.writeFileSync(filepath, content, 'utf8');
             console.log('Created: ' + id);
          } else {
             // Overwrite it anyway as we are scaffolding globally
             fs.writeFileSync(filepath, content, 'utf8');
             console.log('Updated: ' + id);
          }
        }
      }
    }
  }
}

console.log('Scaffolding complete.');
