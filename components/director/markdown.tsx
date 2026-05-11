"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-5 mt-2 font-serif text-4xl leading-tight text-neutral-900">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-4 mt-7 font-serif text-3xl leading-tight text-neutral-900">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-3 mt-6 font-mono text-[13px] uppercase tracking-[0.20em] text-neutral-500">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-4 font-serif text-[17px] leading-[1.75] text-neutral-800">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-neutral-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-neutral-700">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-4 ml-6 list-disc space-y-2 font-serif text-[16px] leading-relaxed text-neutral-800">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 ml-6 list-decimal space-y-2 font-serif text-[16px] leading-relaxed text-neutral-800">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          hr: () => <hr className="my-7 border-t border-neutral-200" />,
          blockquote: ({ children }) => (
            <blockquote className="my-5 border-l-2 border-neutral-900 pl-4 font-serif text-[16px] italic leading-relaxed text-neutral-700">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[12px] text-neutral-900">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
