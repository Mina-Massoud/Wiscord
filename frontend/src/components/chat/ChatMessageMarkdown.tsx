import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// Explicit sanitize schema so user-authored markdown can never smuggle a
// `javascript:`/`data:` URL through a link or image. Pinning this (rather than
// relying on the plugin default + ordering) keeps the contract testable and
// stops a future refactor from silently reopening an XSS hole.
const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
};

interface ChatMessageMarkdownProps {
  content: string;
  mentions: string[];
  // If we had a list of users, we could highlight their names.
  // For now, we'll just format any @word as a mention pill if it looks like one.
}

export function ChatMessageMarkdown({ content }: ChatMessageMarkdownProps) {
  // Simple regex to match @username.
  // In a real app we'd verify if the mention matches a real user in the server.
  const processMentions = (text: string) => {
    const mentionRegex = /(@\w+)/g;
    const parts = text.split(mentionRegex);

    return parts.map((part, index) => {
      if (part.match(mentionRegex)) {
        return (
          <span
            key={index}
            className="bg-blurple/20 text-blurple-foreground mx-0.5 rounded-md px-1 py-0.5 font-medium whitespace-nowrap"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          p({ children }) {
            // Process text nodes to render mentions
            const processChildren = React.Children.map(children, (child) => {
              if (typeof child === 'string') {
                return processMentions(child);
              }
              return child;
            });
            return <p className="m-0 mb-1 last:mb-0">{processChildren}</p>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blurple underline-offset-2 hover:underline"
              >
                {children}
              </a>
            );
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            if (isInline) {
              return (
                <code
                  className="bg-glass-surface-2 border-glass-border rounded-md border px-1.5 py-0.5 font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-surface-2 border-border my-2 overflow-x-auto rounded-lg border p-3 text-xs">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
