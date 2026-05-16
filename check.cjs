const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

// Check achievements and challenges
const matches = content.match(/id:\s*['"`](.*?)['"`]/g);
if (matches) {
  const ids = {};
  for (const match of matches) {
    const id = match.match(/id:\s*['"`](.*?)['"`]/)[1];
    if (ids[id]) {
      console.log('DUPLICATE ID FIELD:', id);
    }
    ids[id] = true;
  }
}
