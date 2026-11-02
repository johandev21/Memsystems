export function extractJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  let working = trimmed;

  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  const blocks: string[] = [];
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fencePattern.exec(trimmed)) !== null) {
    blocks.push(fenceMatch[1]);
  }
  if (blocks.length > 0) {
    working = (
      blocks.find((block) => block.includes('{') || block.includes('[')) ??
      blocks[0]
    ).trim();
  } else {
    const structuredMatch = trimmed.match(
      /<structured_output>\s*([\s\S]*?)(?:<\/structured_output>|$)/i,
    );
    if (
      structuredMatch?.[1] &&
      (structuredMatch[1].includes('{') || structuredMatch[1].includes('['))
    ) {
      working = structuredMatch[1].trim();
    } else {
      working = trimmed.replace(/<\/?structured_output>/gi, '').trim();
      const firstBrace = working.indexOf('{');
      const firstBracket = working.indexOf('[');
      let startIdx = -1;
      if (
        firstBrace !== -1 &&
        (firstBracket === -1 || firstBrace < firstBracket)
      ) {
        startIdx = firstBrace;
      } else if (firstBracket !== -1) {
        startIdx = firstBracket;
      }
      if (startIdx !== -1) {
        working = working.slice(startIdx);
      }
    }
  }

  working = working.replace(/```[\s\S]*$/, '').trim();
  working = working.replace(/<\/structured_output>[\s\S]*$/i, '').trim();

  const lastBrace = working.lastIndexOf('}');
  const lastBracket = working.lastIndexOf(']');
  const lastClose = Math.max(lastBrace, lastBracket);
  if (lastClose !== -1 && lastClose < working.length - 1) {
    const tail = working.slice(lastClose + 1);
    if (!/[:{[]/.test(tail)) {
      working = working.slice(0, lastClose + 1).trim();
    }
  }

  return working;
}

export function repairJsonText(text: string): string {
  const normalized = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  let out = '';
  let i = 0;
  const len = normalized.length;
  let inDouble = false;

  while (i < len) {
    const ch = normalized[i];

    if (inDouble) {
      out += ch;
      if (ch === '\\' && i + 1 < len) {
        out += normalized[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && i + 1 < len) {
      const next = normalized[i + 1];
      if (next === '/') {
        while (i < len && normalized[i] !== '\n') i += 1;
        continue;
      }
      if (next === '*') {
        i += 2;
        while (
          i < len &&
          !(normalized[i] === '*' && normalized[i + 1] === '/')
        ) {
          i += 1;
        }
        i += 2;
        continue;
      }
    }

    if (ch === "'") {
      let j = i + 1;
      let inner = '';
      let closed = false;
      while (j < len) {
        const c = normalized[j];
        if (c === '\\' && j + 1 < len) {
          inner += c + normalized[j + 1];
          j += 2;
          continue;
        }
        if (c === "'") {
          closed = true;
          break;
        }
        inner += c;
        j += 1;
      }
      if (!closed) {
        out += '"';
        i += 1;
        continue;
      }
      const unescaped = inner.replace(/\\'/g, "'");
      out += `"${unescaped.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
      i = j + 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function parseJsonLenient(text: string): unknown {
  const cleaned = extractJson(text);
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const repaired = repairJsonText(cleaned);
    if (repaired !== cleaned) {
      try {
        return JSON.parse(repaired);
      } catch {
        void 0;
      }
    }
    const preview = cleaned.slice(0, 500);
    const reason =
      firstError instanceof Error ? firstError.message : String(firstError);
    throw new SyntaxError(
      `Lenient JSON parse failed (${reason}). Preview: ${preview}`,
    );
  }
}
