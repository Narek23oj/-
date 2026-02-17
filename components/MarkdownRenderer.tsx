import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser }) => {
  return (
    <ReactMarkdown
      className={`prose max-w-none ${
        isUser 
          ? 'prose-invert text-white prose-p:text-white prose-headings:text-white prose-strong:text-white prose-code:text-white user-message' 
          : 'text-gray-800'
      } prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0`}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;