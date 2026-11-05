const fs = require('fs');

function fixFile(path, patterns) {
  let content = fs.readFileSync(path, 'utf8');
  for (const [old, newStr] of patterns) {
    content = content.split(old).join(newStr);
  }
  fs.writeFileSync(path, content);
  console.log('Fixed: ' + path);
}

// Fix 1: CommandPalette.tsx - close map callback properly
fixFile('C:\\Users\\anasp\\Documents\\Default Project\\web\\components\\chat\\CommandPalette.tsx', [
  ['            }))', '            })']
]);

// Fix 2: MessageList.tsx - fix function signature
fixFile('C:\\Users\\anasp\\Documents\\Default Project\\web\\components\\chat\\MessageList.tsx', [
  [']}: {', '}'],
  [') => {', ') {']
]);

// Fix 3: idbCache.ts - combine reactedBy type
fixFile('C:\\Users\\anasp\\Documents\\Default Project\\web\\lib\\idbCache.ts', [
  ['reactedBy: Record<string, string>;', 'reactedBy: Record<string, string> | null;']
]);

// Fix 4: socketOptimizer.ts - transports config
fixFile('C:\\Users\\anasp\\Documents\\Default Project\\web\\lib\\socketOptimizer.ts', [
  ['transports upgrade: true,', 'transports: [\"upgrade\",']
]);

// Fix 5: socketOptimizer.ts - arrow function syntax
fixFile('C:\\Users\\anasp\\Documents\\Default Project\\web\\lib\\socketOptimizer.ts', [
  ['] => {', '] {']
]);

console.log('All fixes applied');