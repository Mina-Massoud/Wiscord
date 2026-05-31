import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

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
            className="px-1 py-0.5 mx-0.5 rounded-md bg-blurple/20 text-blurple-foreground font-medium whitespace-nowrap"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
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
                className="text-blurple hover:underline underline-offset-2"
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
                  className="px-1.5 py-0.5 rounded-md bg-glass-surface-2 border border-glass-border font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-3 my-2 rounded-lg bg-surface-2 border border-border overflow-x-auto text-xs">
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
