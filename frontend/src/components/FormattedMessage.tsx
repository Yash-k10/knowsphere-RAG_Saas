import React from 'react';

interface FormattedMessageProps {
  content: string;
  isUser?: boolean;
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({ content, isUser = false }) => {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  // Parse lines and render clean structured blocks
  const parseInline = (text: string): React.ReactNode[] => {
    // Clean up any stray triple asterisks like ***text*** into bold
    let processed = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    processed = processed.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-earth-200/60 font-mono text-xs text-forest-900">$1</code>');

    // Split by tags and convert to React elements safely
    const parts = processed.split(/(<\/?(?:strong|em|code)[^>]*>)/g);
    const elements: React.ReactNode[] = [];
    let isBold = false;
    let isItalic = false;
    let isCode = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '<strong>') {
        isBold = true;
      } else if (part === '</strong>') {
        isBold = false;
      } else if (part === '<em>') {
        isItalic = true;
      } else if (part === '</em>') {
        isItalic = false;
      } else if (part.startsWith('<code')) {
        isCode = true;
      } else if (part === '</code>') {
        isCode = false;
      } else if (part) {
        if (isCode) {
          elements.push(
            <code key={i} className="px-1.5 py-0.5 rounded bg-earth-200/60 font-mono text-xs text-forest-900">
              {part}
            </code>
          );
        } else if (isBold && isItalic) {
          elements.push(<strong key={i} className="font-semibold text-forest-950 italic">{part}</strong>);
        } else if (isBold) {
          elements.push(<strong key={i} className="font-semibold text-forest-950">{part}</strong>);
        } else if (isItalic) {
          elements.push(<em key={i} className="italic text-earth-800">{part}</em>);
        } else {
          elements.push(part);
        }
      }
    }

    return elements;
  };

  const lines = content.split('\n');
  const renderedBlocks: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      renderedBlocks.push(
        <ul key={`ul-${listKey++}`} className="space-y-1.5 my-2 pl-4 list-disc marker:text-sage-600">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();

    if (!rawLine) {
      flushList();
      continue;
    }

    // Check for blockquote (> )
    if (rawLine.startsWith('> ')) {
      flushList();
      renderedBlocks.push(
        <div key={`bq-${i}`} className="p-3 my-2 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs sm:text-sm leading-relaxed shadow-2xs">
          {parseInline(rawLine.replace(/^>\s+/, ''))}
        </div>
      );
      continue;
    }

    // Check for headings
    if (rawLine.startsWith('### ')) {
      flushList();
      renderedBlocks.push(
        <h4 key={`h4-${i}`} className="font-bold text-forest-900 text-sm mt-3 mb-1">
          {parseInline(rawLine.replace(/^###\s+/, ''))}
        </h4>
      );
      continue;
    }

    if (rawLine.startsWith('## ')) {
      flushList();
      renderedBlocks.push(
        <h3 key={`h3-${i}`} className="font-bold text-forest-900 text-base mt-3.5 mb-1.5 border-b border-earth-100 pb-1">
          {parseInline(rawLine.replace(/^##\s+/, ''))}
        </h3>
      );
      continue;
    }

    if (rawLine.startsWith('# ')) {
      flushList();
      renderedBlocks.push(
        <h2 key={`h2-${i}`} className="font-bold text-forest-900 text-lg mt-4 mb-2">
          {parseInline(rawLine.replace(/^#\s+/, ''))}
        </h2>
      );
      continue;
    }

    // Check for bullet lists (* or -)
    const bulletMatch = rawLine.match(/^[*•-]\s+(.+)/);
    if (bulletMatch) {
      currentList.push(
        <li key={`li-${i}`} className="text-xs sm:text-sm text-forest-900 leading-relaxed">
          {parseInline(bulletMatch[1])}
        </li>
      );
      continue;
    }

    // Check for numbered lists (1. or 2.)
    const numberMatch = rawLine.match(/^(\d+)\.\s+(.+)/);
    if (numberMatch) {
      flushList();
      renderedBlocks.push(
        <div key={`num-${i}`} className="flex gap-2 text-xs sm:text-sm text-forest-900 leading-relaxed my-1">
          <span className="font-semibold text-sage-700 shrink-0">{numberMatch[1]}.</span>
          <div>{parseInline(numberMatch[2])}</div>
        </div>
      );
      continue;
    }

    // Regular paragraph
    flushList();
    renderedBlocks.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm text-forest-900 leading-relaxed my-1.5">
        {parseInline(rawLine)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-1">{renderedBlocks}</div>;
};
