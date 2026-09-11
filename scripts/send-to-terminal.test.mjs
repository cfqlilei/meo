import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarkdownFence,
  buildSendToTerminalPayload,
  formatSelectionLineRange,
  resolveSendToTerminalContext,
  resolveWorkspaceRelativePath
} from '../src/shared/sendToTerminal.ts';

describe('send to terminal payloads', () => {
  test('resolves longest matching workspace folder with slash separators', () => {
    assert.equal(resolveWorkspaceRelativePath(
      '/repo/packages/docs/guide/file.md',
      ['/repo', '/repo/packages/docs']
    ), 'guide/file.md');
  });

  test('returns null relative path outside workspace', () => {
    assert.equal(resolveWorkspaceRelativePath('/other/file.md', ['/repo']), null);
  });

  test('does not count next line when selection ends at line start', () => {
    assert.equal(formatSelectionLineRange('a\nb\nc\n', { from: 0, to: 4 }), '1-2');
  });

  test('builds fence longer than selected backtick run', () => {
    assert.equal(buildMarkdownFence('a ``` b ```` c'), '`````');
  });

  test('builds text payload with quoted line reference and fenced selected text', () => {
    const context = resolveSendToTerminalContext({
      documentPath: '/repo/CLAUDE.md',
      workspaceFolders: ['/repo'],
      text: 'one\n二 ```\nthree',
      selection: { from: 4, to: 9 }
    });

    assert.equal(buildSendToTerminalPayload('text', context), '"CLAUDE.md(起止行号:2-2)"\n````\n二 ```\n````');
  });

  test('builds quoted absolute path payload', () => {
    const context = resolveSendToTerminalContext({
      documentPath: '/repo/CLAUDE.md',
      workspaceFolders: [],
      text: '',
      selection: null
    });

    assert.equal(buildSendToTerminalPayload('path', context), '"/repo/CLAUDE.md"');
    assert.equal(buildSendToTerminalPayload('relativePath', context), null);
  });
});
