// Local webview fixture: npm run build, then node tests/preview.cjs.
require('./register.cjs');
const http = require('node:http');
const fs = require('node:fs');
const { createDefaultBoard } = require('../src/markdown/defaultBoard.ts');
const board = createDefaultBoard();
board.columns[0].cards[0].body = '- First bullet\n- Second bullet\n  - Nested bullet\n- Third bullet\n\nA long detail line that wraps across the available card width.\n\n    code first\n    code second';
board.columns[0].cards[1].body = 'Short detail';
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="app" class="app-shell"></div><script>
window.exports = {}; window.module = { exports: window.exports }; window.sent = []; window.mode = 'saved';
window.webviewApi = {
 onMessage: callback => window.receive = callback,
 postMessage: async message => {
  window.sent.push(message);
  if (message.type === 'ready') return {type:'board', noteId:'preview', sessionId:'preview-1', baseBody:'base', sequence:0, status:'saved', board:${JSON.stringify(board)}};
  if (message.type === 'saveBoard') setTimeout(() => window.receive({type:'saveStatus', noteId:message.noteId, sessionId:message.sessionId, sequence:message.sequence, status:window.mode, message:window.mode === 'conflict' ? 'External change detected' : ''}), 100);
  return {ok:true};
 }
};
</script><script src="/app.js"></script></body></html>`;
http.createServer((request, response) => {
 if (request.url === '/app.js' || request.url === '/styles.css') {
  response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'text/css');
  response.end(fs.readFileSync(`dist/webview${request.url}`));
 } else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); }
}).listen(4173, '127.0.0.1', () => console.log('Webview preview: http://127.0.0.1:4173'));
