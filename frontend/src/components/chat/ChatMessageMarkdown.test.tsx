import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { ChatMessageMarkdown } from './ChatMessageMarkdown';

// User-authored chat content runs through ChatMessageMarkdown on a hot path, so
// these tests lock in that the sanitize schema neutralizes injection vectors.
// A future plugin/schema change that reopens a hole should turn these red.
describe('ChatMessageMarkdown sanitization', () => {
  test('strips javascript: link hrefs', () => {
    const { container } = render(
      <ChatMessageMarkdown content="[click me](javascript:alert(1))" mentions={[]} />,
    );
    expect(container.innerHTML).not.toContain('javascript:');
    const anchors = container.querySelectorAll('a');
    anchors.forEach((a) => {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    });
  });

  test('strips inline event handlers from raw HTML', () => {
    const { container } = render(
      <ChatMessageMarkdown content={'<img src="x" onerror="alert(1)">'} mentions={[]} />,
    );
    expect(container.innerHTML).not.toContain('onerror');
  });

  test('drops <script> content', () => {
    const { container } = render(
      <ChatMessageMarkdown content={'<script>alert(1)</script>'} mentions={[]} />,
    );
    expect(container.querySelector('script')).toBeNull();
  });

  test('still renders ordinary markdown', () => {
    const { container } = render(
      <ChatMessageMarkdown content="**bold** and _italic_" mentions={[]} />,
    );
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });
});
