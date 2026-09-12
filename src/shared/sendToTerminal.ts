import * as path from 'node:path';

export type SelectionRange = {
  from: number;
  to: number;
};

export type SendToTerminalContext = {
  documentPath: string;
  workspaceFolders: string[];
  text: string;
  selection: SelectionRange | null;
};

export type SendToTerminalPayloadKind = 'relativePath' | 'path' | 'lineReference' | 'text';

export type ResolvedSendToTerminalContext = {
  absolutePath: string;
  relativePath: string | null;
  selectedText: string | null;
  lineReference: string | null;
};

export function resolveSendToTerminalContext(context: SendToTerminalContext): ResolvedSendToTerminalContext {
  const absolutePath = context.documentPath;
  const relativePath = resolveWorkspaceRelativePath(absolutePath, context.workspaceFolders);
  const selection = normalizeSelection(context.selection, context.text.length);
  const lineReference = selection && relativePath
    ? `${relativePath}(起止行号:${formatSelectionLineRange(context.text, selection)})`
    : null;
  const selectedText = selection ? context.text.slice(selection.from, selection.to) : null;

  return {
    absolutePath,
    relativePath,
    selectedText,
    lineReference
  };
}

export function buildSendToTerminalPayload(
  kind: SendToTerminalPayloadKind,
  context: ResolvedSendToTerminalContext
): string | null {
  if (kind === 'relativePath') {
    return context.relativePath === null ? null : padForTerminal(context.relativePath);
  }
  if (kind === 'path') {
    return padForTerminal(context.absolutePath);
  }
  if (kind === 'lineReference') {
    return context.lineReference === null ? null : padForTerminal(context.lineReference);
  }
  if (context.lineReference === null || context.selectedText === null) {
    return null;
  }

  const fence = buildMarkdownFence(context.selectedText);
  return `${padForTerminal(context.lineReference)}\n${fence}\n${context.selectedText}\n${fence}`;
}

export function resolveWorkspaceRelativePath(documentPath: string, workspaceFolders: string[]): string | null {
  const normalizedDocument = path.resolve(documentPath);
  let bestFolder: string | null = null;

  for (const folder of workspaceFolders) {
    const normalizedFolder = path.resolve(folder);
    const relative = path.relative(normalizedFolder, normalizedDocument);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      if (bestFolder === null || normalizedFolder.length > bestFolder.length) {
        bestFolder = normalizedFolder;
      }
    }
  }

  if (bestFolder === null) {
    return null;
  }

  return path.relative(bestFolder, normalizedDocument).split(path.sep).join('/');
}

export function formatSelectionLineRange(text: string, selection: SelectionRange): string {
  const normalized = normalizeSelection(selection, text.length);
  if (!normalized) {
    return '1-1';
  }

  const startLine = lineNumberAtOffset(text, normalized.from);
  const endOffset = normalized.to > normalized.from ? normalized.to - 1 : normalized.to;
  const endLine = lineNumberAtOffset(text, endOffset);
  return `${startLine}-${endLine}`;
}

export function buildMarkdownFence(text: string): string {
  const longestRun = [...text.matchAll(/`+/g)].reduce((max, match) => Math.max(max, match[0].length), 0);
  return '`'.repeat(Math.max(3, longestRun + 1));
}

function normalizeSelection(selection: SelectionRange | null, textLength: number): SelectionRange | null {
  if (!selection) {
    return null;
  }

  if (!Number.isInteger(selection.from) || !Number.isInteger(selection.to)) {
    return null;
  }

  const from = Math.max(0, Math.min(selection.from, textLength));
  const to = Math.max(0, Math.min(selection.to, textLength));
  return { from: Math.min(from, to), to: Math.max(from, to) };
}

function lineNumberAtOffset(text: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  for (let index = 0; index < clamped; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
    }
  }
  return line;
}

function padForTerminal(value: string): string {
  return ` ${value} `;
}
