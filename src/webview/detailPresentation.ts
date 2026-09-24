/** A view/edit projection only. The common prefix remains in the stored detail. */
export function detailPresentation(body: string): { text: string; prefix: string } {
 const lines = body.replace(/\r\n?/g, '\n').split('\n');
 const nonBlank = lines.filter(line => line.trim());
 let prefix = nonBlank.length ? /^[ \t]*/.exec(nonBlank[0])![0] : '';
 for (const line of nonBlank) {
  while (prefix && !line.startsWith(prefix)) prefix = prefix.slice(0, -1);
 }
 return { prefix, text: lines.map(line => line.startsWith(prefix) ? line.slice(prefix.length) : line).join('\n') };
}

export function restoreDetailIndent(text: string, prefix: string): string {
 return text.replace(/\r\n?/g, '\n').split('\n').map(line => line ? prefix + line : '').join('\n');
}
