export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  const error = (code) => errors.push({ code, line: recordLine, row: recordRow });

  function readUnquoted(initial) {
    let start = pos;
    let value = initial;
    let added = 0;
    let fragments = null;
    while (pos < text.length) {
      const code = text.charCodeAt(pos);
      if (code === 44) {
        if (fragments) { fragments.push(text.slice(start, pos)); value = fragments.join(''); }
        else value += text.slice(start, pos);
        pos++;
        return { value, ended: 0, added };
      }
      if (code === 10) {
        if (fragments) { fragments.push(text.slice(start, pos)); value = fragments.join(''); }
        else value += text.slice(start, pos);
        pos++; line++;
        return { value, ended: 1, added };
      }
      if (code === 13) {
        const segment = text.slice(start, pos);
        if (fragments) fragments.push(segment);
        else { fragments = [value, segment]; value = ''; }
        if (text.charCodeAt(pos + 1) === 10) {
          value = fragments ? fragments.join('') : value;
          pos += 2; line++;
          return { value, ended: 1, added };
        }
        error('stray_cr');
        pos++;
        start = pos;
        continue;
      }
      pos++;
      added++;
    }
    if (fragments) { fragments.push(text.slice(start, pos)); value = fragments.join(''); }
    else value += text.slice(start, pos);
    return { value, ended: 2, added };
  }

  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos++;
    let start = pos;
    let parts = null;
    let closed = false;
    while (pos < text.length) {
      const code = text.charCodeAt(pos);
      if (code === 34) {
        if (text.charCodeAt(pos + 1) === 34) {
          if (!parts) parts = [];
          parts.push(text.slice(start, pos), '"');
          pos += 2;
          start = pos;
          continue;
        }
        if (!parts) parts = [];
        parts.push(text.slice(start, pos));
        pos++;
        closed = true;
        break;
      }
      if (code === 13 || code === 10) {
        if (!parts) parts = [];
        parts.push(text.slice(start, pos), '\n');
        if (code === 13 && text.charCodeAt(pos + 1) === 10) pos += 2;
        else pos++;
        line++;
        start = pos;
      } else pos++;
    }
    if (!closed) {
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }
    const value = parts ? parts.join('') : text.slice(start, pos - 1);
    const code = text.charCodeAt(pos);
    if (code === 44) { pos++; return { value, ended: 0 }; }
    if (code === 10) { pos++; line++; return { value, ended: 1 }; }
    if (code === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; return { value, ended: 1 }; }
    if (pos >= text.length) return { value, ended: 2 };
    const tail = readUnquoted(value);
    if (tail.added > 0) error('quote_junk');
    return tail;
  }

  while (pos < text.length) {
    while (pos < text.length) {
      const code = text.charCodeAt(pos);
      if (code === 10) { pos++; line++; continue; }
      if (code === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; continue; }
      break;
    }
    if (pos >= text.length) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === 0);
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
