'use client';

import { useEffect, useRef, useState } from 'react';

interface SearchAndReplaceProps {
  isOpen: boolean;
  onClose: () => void;
  editorRef: React.MutableRefObject<any>;
  monacoRef: React.MutableRefObject<any>;
}

export default function SearchAndReplace({ isOpen, onClose, editorRef, monacoRef }: SearchAndReplaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [matchCase, setMatchCase] = useState(false);
  const [regex, setRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [autoShow, setAutoShow] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const editor = editorRef.current;
  const monaco = monacoRef.current;

  const makeRange = (startLine: number, startCol: number, endLine: number, endCol: number) => {
    if (monaco && monaco.Range) {
      return new monaco.Range(startLine, startCol, endLine, endCol);
    }
    return null;
  };

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      // Get selected text
      const selection = editorRef.current?.getSelection();
      const selectedText = selection ? editorRef.current.getModel()?.getValueInRange(selection) : '';
      if (selectedText && selectedText.trim()) {
        setSearchQuery(selectedText);
      }
      setAutoShow(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      // Clear find decorations when closed
      editorRef.current?.setDecorations?.('find-decorations', []);
    }
  }, [isOpen, editorRef]);

  // Update match count when query changes
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !isOpen) return;

    if (!searchQuery) {
      setMatchCount(0);
      setCurrentMatch(0);
      ed.setDecorations?.('find-decorations', []);
      return;
    }

    const model = ed.getModel();
    if (!model) return;

    const fullText = model.getValue();

    try {
      const searchRegex = regex
        ? new RegExp(searchQuery, matchCase ? 'g' : 'gi')
        : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');

      const matches = fullText.match(searchRegex);
      const count = matches ? matches.length : 0;
      setMatchCount(count);
    } catch (e) {
      setMatchCount(0);
    }
  }, [searchQuery, matchCase, regex, wholeWord, isOpen, editorRef]);

  const highlightMatches = () => {
    const ed = editorRef.current;
    const mon = monacoRef.current;
    if (!ed || !searchQuery || !mon) return;
    const model = ed.getModel();
    if (!model) return;

    ed.setDecorations?.('find-decorations', []);

    try {
      const searchRegex = regex
        ? new RegExp(searchQuery, matchCase ? 'g' : 'gi')
        : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');

      const matches: any[] = [];
      for (let i = 0; i < model.getLineCount(); i++) {
        const lineContent = model.getLineContent(i + 1);
        let match;
        while ((match = searchRegex.exec(lineContent)) !== null) {
          const startCol = match.index;
          const endCol = startCol + match[0].length;
          const range = new mon.Range(i + 1, startCol + 1, i + 1, endCol + 1);
          matches.push({
            range,
            options: {
              className: 'find-match-highlight',
              stickiness: 1,
            },
          });
        }
      }
      ed.setDecorations?.('find-decorations', matches);
    } catch (e) {
      // Invalid regex, ignore
    }
  };

  const findNext = () => {
    const ed = editorRef.current;
    const mon = monacoRef.current;
    if (!ed || !searchQuery || !mon) return;
    const model = ed.getModel();
    if (!model) return;

    highlightMatches();

    try {
      const searchRegex = regex
        ? new RegExp(searchQuery, matchCase ? '' : 'i')
        : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? '' : 'i');

      const currentPos = ed.getPosition();
      const fullText = model.getValue();
      const searchFrom = model.getOffsetAt(currentPos) + (autoShow ? 0 : 1);

      // Search from current position to end
      const textFromPos = fullText.substring(searchFrom);
      const match = textFromPos.match(searchRegex);

      if (match && match.index !== undefined) {
        const absStart = searchFrom + match.index;
        const absEnd = absStart + match[0].length;
        const startPos = model.getPositionAt(absStart);
        const endPos = model.getPositionAt(absEnd);
        const range = new mon.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
        ed.setSelection(range);
        ed.revealRangeInCenterIfOutsideViewport(range);
        setCurrentMatch((prev) => prev + 1);
      } else {
        // Wrap around to beginning
        const matchFromStart = fullText.match(searchRegex);
        if (matchFromStart && matchFromStart.index !== undefined) {
          const absStart = matchFromStart.index;
          const absEnd = absStart + matchFromStart[0].length;
          const startPos = model.getPositionAt(absStart);
          const endPos = model.getPositionAt(absEnd);
          const range = new mon.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
          ed.setSelection(range);
          ed.revealRangeInCenterIfOutsideViewport(range);
          setCurrentMatch(1);
        }
      }
    } catch (e) {
      // Invalid regex, ignore
    }

    ed.focus();
  };

  const findPrevious = () => {
    const ed = editorRef.current;
    const mon = monacoRef.current;
    if (!ed || !searchQuery || !mon) return;
    const model = ed.getModel();
    if (!model) return;

    highlightMatches();

    try {
      const searchRegex = regex
        ? new RegExp(searchQuery, matchCase ? '' : 'i')
        : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? '' : 'i');

      const currentPos = ed.getPosition();
      const fullText = model.getValue();
      const currentOffset = model.getOffsetAt(currentPos);
      const textBefore = fullText.substring(0, Math.max(0, currentOffset - 1));

      // Find all matches before current position
      const matches = [...textBefore.matchAll(new RegExp(searchRegex.source, searchRegex.flags + 'g'))];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const matchStart = lastMatch.index ?? 0;
        const matchEnd = matchStart + lastMatch[0].length;
        const startPos = model.getPositionAt(matchStart);
        const endPos = model.getPositionAt(matchEnd);
        const range = new mon.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
        ed.setSelection(range);
        ed.revealRangeInCenterIfOutsideViewport(range);
        setCurrentMatch((prev) => Math.max(1, prev - 1));
      } else {
        // Wrap to end
        const allMatches = [...fullText.matchAll(new RegExp(searchRegex.source, searchRegex.flags + 'g'))];
        if (allMatches.length > 0) {
          const lastMatch = allMatches[allMatches.length - 1];
          const matchStart = lastMatch.index ?? 0;
          const matchEnd = matchStart + lastMatch[0].length;
          const startPos = model.getPositionAt(matchStart);
          const endPos = model.getPositionAt(matchEnd);
          const range = new mon.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
          ed.setSelection(range);
          ed.revealRangeInCenterIfOutsideViewport(range);
          setCurrentMatch(allMatches.length);
        }
      }
    } catch (e) {
      // Invalid regex, ignore
    }

    ed.focus();
  };

  const replaceCurrent = () => {
    const ed = editorRef.current;
    if (!ed || !searchQuery) return;
    const model = ed.getModel();
    if (!model) return;

    const selection = ed.getSelection();
    if (!selection) return;

    const selectedText = model.getValueInRange(selection);
    const searchRegex = regex
      ? new RegExp(`^${searchQuery}$`, matchCase ? '' : 'i')
      : new RegExp('^' + searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', matchCase ? '' : 'i');

    if (selectedText.match(searchRegex)) {
      ed.executeEdits('replace', [{
        range: selection,
        text: replaceQuery,
      }]);
      // Find next match
      setTimeout(findNext, 50);
    } else {
      findNext();
    }
  };

  const replaceAll = () => {
    const ed = editorRef.current;
    if (!ed || !searchQuery) return;
    const model = ed.getModel();
    if (!model) return;

    try {
      const searchRegex = regex
        ? new RegExp(searchQuery, matchCase ? 'g' : 'gi')
        : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');

      const fullText = model.getValue();
      const newText = fullText.replace(searchRegex, replaceQuery);

      if (newText !== fullText) {
        const currentPos = ed.getPosition();
        ed.executeEdits('replace-all', [{
          range: model.getFullModelRange(),
          text: newText,
        }]);
        if (currentPos) {
          ed.setPosition(currentPos);
        }
        const count = (fullText.match(new RegExp(searchRegex.source, searchRegex.flags)) || []).length;
        alert(`Replaced ${count} occurrence${count !== 1 ? 's' : ''}`);
      }
    } catch (e) {
      alert('Invalid search pattern');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-[#21262d] border-b border-[#30363d] px-4 py-2 flex items-center gap-3 shrink-0">
      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      <div className="flex-1 max-w-xs">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setAutoShow(true);
            setTimeout(highlightMatches, 50);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.shiftKey) findPrevious();
              else findNext();
            }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Find"
          className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-600"
        />
      </div>

      <span className="text-xs text-gray-500 whitespace-nowrap">
        {matchCount > 0 ? `${currentMatch}/${matchCount}` : ''}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={findPrevious}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#30363d] rounded transition-colors"
          title="Previous Match (Shift+Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={findNext}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#30363d] rounded transition-colors"
          title="Next Match (Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-1 border-l border-[#30363d] pl-3">
        <button
          onClick={() => setMatchCase(!matchCase)}
          className={`px-2 py-1 text-[11px] rounded transition-colors ${
            matchCase ? 'bg-primary-600/30 text-primary-400' : 'text-gray-500 hover:text-white'
          }`}
          title="Match Case"
        >
          Aa
        </button>
        <button
          onClick={() => setRegex(!regex)}
          className={`px-2 py-1 text-[11px] rounded transition-colors ${
            regex ? 'bg-primary-600/30 text-primary-400' : 'text-gray-500 hover:text-white'
          }`}
          title="Use Regular Expression"
        >
          .*
        </button>
        <button
          onClick={() => setWholeWord(!wholeWord)}
          className={`px-2 py-1 text-[11px] rounded transition-colors ${
            wholeWord ? 'bg-primary-600/30 text-primary-400' : 'text-gray-500 hover:text-white'
          }`}
          title="Match Whole Word"
        >
          \b
        </button>
      </div>

      {/* Replace Section */}
      <div className="flex-1 max-w-xs ml-2">
        <input
          type="text"
          value={replaceQuery}
          onChange={(e) => setReplaceQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') replaceCurrent();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Replace"
          className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-600"
        />
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={replaceCurrent}
          className="px-3 py-1.5 text-xs bg-[#30363d] text-white rounded hover:bg-[#383f4a] transition-colors whitespace-nowrap"
          title="Replace (Ctrl+Enter)"
        >
          Replace
        </button>
        <button
          onClick={replaceAll}
          className="px-3 py-1.5 text-xs bg-primary-600/30 text-primary-400 rounded hover:bg-primary-600/40 transition-colors whitespace-nowrap"
          title="Replace All (Ctrl+Alt+Enter)"
        >
          Replace All
        </button>
      </div>

      <button
        onClick={onClose}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-[#30363d] rounded transition-colors"
        title="Close (Esc)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}