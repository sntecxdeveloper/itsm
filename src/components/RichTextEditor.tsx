import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { HTML_MARKER, bodyToHtml, sanitizeHtml } from '../utils/emailHtml';

export interface RichTextEditorHandle {
  insertText: (text: string) => void;
}

interface Props {
  /** Stored body: plain text (older templates) or HTML starting with the HTML marker. */
  value: string;
  /** Changes when a different record is opened, so the editor reloads its content. */
  resetKey: string;
  onChange: (body: string) => void;
  /** Gmail-style: borderless editor filling its parent, with the tools in a bottom bar behind an "Aa" toggle. */
  compact?: boolean;
  /** Compact mode only: buttons placed at the start of the bottom bar (e.g. Send). */
  leading?: ReactNode;
  /** Compact mode only: buttons placed at the end of the bottom bar. */
  trailing?: ReactNode;
}

const FONT_SIZES = [
  { label: '8pt', value: '2' },
  { label: '10pt', value: '3' },
  { label: '12pt', value: '4' },
  { label: '14pt', value: '5' },
  { label: '18pt', value: '6' },
];

const tool =
  'flex h-7 min-w-7 items-center justify-center rounded border border-transparent px-1.5 text-sm text-slate-700 hover:border-slate-300 hover:bg-white';

/** Small rich-text box (bold, links, lists, alignment…) that stores its content as HTML. */
const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor({ value, resetKey, onChange, compact, leading, trailing }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [showTools, setShowTools] = useState(false);

  // Load content when a different record opens; typing keeps the DOM as the source of truth so the caret stays put.
  useEffect(() => {
    if (box.current) box.current.innerHTML = sanitizeHtml(bodyToHtml(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const emit = () => onChange(HTML_MARKER + (box.current?.innerHTML ?? ''));

  const run = (command: string, arg?: string) => {
    box.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  useImperativeHandle(ref, () => ({
    insertText: (text) => {
      const el = box.current;
      if (!el) return;
      el.focus();
      if (!el.contains(window.getSelection()?.anchorNode ?? null)) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand('insertText', false, text);
      emit();
    },
  }));

  const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the text selection while clicking a tool

  const addLink = () => {
    const url = window.prompt('Link address', 'https://');
    if (url) run('createLink', url);
  };

  const tools = (
    <>
      <button type="button" className={`${tool} font-bold`} title="Bold" onClick={() => run('bold')}>B</button>
      <button type="button" className={`${tool} italic`} title="Italic" onClick={() => run('italic')}>I</button>
      <button type="button" className={`${tool} underline`} title="Underline" onClick={() => run('underline')}>U</button>
      <span className="mx-1 h-5 w-px bg-slate-300" />
      <select
          title="Font size"
          defaultValue="3"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => run('fontSize', e.target.value)}
          className="h-7 rounded border border-slate-300 bg-white px-1 text-xs"
        >
          {FONT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <input
          type="color"
          title="Text colour"
          defaultValue="#1e293b"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => run('foreColor', e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
        />
      <span className="mx-1 h-5 w-px bg-slate-300" />
      <button type="button" className={tool} title="Insert link" onClick={addLink}>Link</button>
      <button type="button" className={tool} title="Remove link" onClick={() => run('unlink')}>Unlink</button>
      <span className="mx-1 h-5 w-px bg-slate-300" />
      <button type="button" className={tool} title="Bulleted list" onClick={() => run('insertUnorderedList')}>• List</button>
      <button type="button" className={tool} title="Numbered list" onClick={() => run('insertOrderedList')}>1. List</button>
      <span className="mx-1 h-5 w-px bg-slate-300" />
      <button type="button" className={tool} title="Align left" onClick={() => run('justifyLeft')}>⇤</button>
      <button type="button" className={tool} title="Align centre" onClick={() => run('justifyCenter')}>↔</button>
      <button type="button" className={tool} title="Align right" onClick={() => run('justifyRight')}>⇥</button>
      <span className="mx-1 h-5 w-px bg-slate-300" />
      <button type="button" className={tool} title="Clear formatting" onClick={() => run('removeFormat')}>Clear</button>
    </>
  );

  const editable = (
    <div
      ref={box}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Message"
      onInput={emit}
      className={`${compact ? 'min-h-0 flex-1 overflow-y-auto px-5 py-3' : 'min-h-[200px] px-3 py-2'} text-sm text-slate-800 focus:outline-none [&_a]:text-sky-700 [&_a]:underline [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc`}
    />
  );

  if (compact) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {editable}
        {showTools && (
          <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-3 py-1" onMouseDown={keep}>{tools}</div>
        )}
        <div className="flex items-center gap-2 px-4 py-3" onMouseDown={keep}>
          {leading}
          <button
            type="button"
            title="Formatting options"
            aria-pressed={showTools}
            onClick={() => setShowTools((v) => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-medium text-slate-700 hover:bg-slate-100 ${showTools ? 'bg-slate-200' : ''}`}
          >
            Aa
          </button>
          <button type="button" title="Insert link" onClick={addLink} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100">🔗</button>
          <span className="ml-auto flex items-center gap-2">{trailing}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-1" onMouseDown={keep}>
        {tools}
      </div>
      {editable}
    </div>
  );
});

export default RichTextEditor;
