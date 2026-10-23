import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { checkScriptCommand } from '../../utils/agentCommands';

export interface TerminalEntry {
  id: string;
  command: string;
  output: string;
  state: 'running' | 'done' | 'failed';
  note?: string;
  timestamp: Date;
}

export interface TerminalRunUpdate {
  state: TerminalEntry['state'];
  output?: string;
  note?: string;
}

interface RemoteTerminalProps {
  agentId: string;
  online: boolean;
  /** Earlier commands for this device (oldest first), shown when the terminal opens. */
  initialEntries?: TerminalEntry[];
  /** Queues the command and reports progress until the agent returns a result. */
  onExecute: (command: string, update: (u: TerminalRunUpdate) => void) => Promise<void>;
}

export const RemoteTerminal: React.FC<RemoteTerminalProps> = ({ agentId, online, initialEntries = [], onExecute }) => {
  const [command, setCommand] = useState('');
  const [entries, setEntries] = useState<TerminalEntry[]>(initialEntries);
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>(() =>
    [...initialEntries].reverse().map((e) => e.command),
  );
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // History arrives after the first render (it's fetched) - take it once, if nothing was typed yet.
  const seededRef = useRef(initialEntries.length > 0);
  useEffect(() => {
    if (seededRef.current || initialEntries.length === 0) return;
    seededRef.current = true;
    setEntries((prev) => (prev.length === 0 ? initialEntries : prev));
    setCommandHistory([...initialEntries].reverse().map((e) => e.command));
  }, [initialEntries]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [entries]);

  const updateEntry = (id: string, patch: Partial<TerminalEntry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd || isExecuting) return;

    setCommand('');
    setCommandHistory((prev) => [cmd, ...prev.filter((c) => c !== cmd).slice(0, 49)]);
    setHistoryIndex(-1);

    const id = `${Date.now()}`;
    const problem = checkScriptCommand(cmd);
    if (problem) {
      setEntries((prev) => [
        ...prev,
        { id, command: cmd, output: problem, state: 'failed', note: 'not sent', timestamp: new Date() },
      ]);
      return;
    }

    setEntries((prev) => [...prev, { id, command: cmd, output: '', state: 'running', timestamp: new Date() }]);
    setIsExecuting(true);
    try {
      await onExecute(cmd, (u) =>
        updateEntry(id, { state: u.state, note: u.note, ...(u.output !== undefined ? { output: u.output } : {}) }),
      );
    } catch (err) {
      updateEntry(id, { state: 'failed', output: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const next = historyIndex + 1;
        setHistoryIndex(next);
        setCommand(commandHistory[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setCommand(commandHistory[next]);
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const copyAll = async () => {
    const text = entries.map((e) => `> ${e.command}\n${e.output}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable - nothing useful to do */
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#070b14]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-2">
        <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <span className="font-mono text-xs text-[#9aa8bb]">Remote terminal</span>
        <span className="font-mono text-xs text-[#66758b]">—</span>
        <span className="truncate font-mono text-xs text-[#7f8ea3]">{agentId}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => void copyAll()}
            disabled={entries.length === 0}
            className="rounded px-2 py-1 font-mono text-[11px] text-[#9aa8bb] hover:bg-white/5 hover:text-[#e6edf5] disabled:opacity-30"
          >
            {copied ? 'copied' : 'copy'}
          </button>
          <button
            type="button"
            onClick={() => setEntries([])}
            disabled={entries.length === 0 || isExecuting}
            className="rounded px-2 py-1 font-mono text-[11px] text-[#9aa8bb] hover:bg-white/5 hover:text-[#e6edf5] disabled:opacity-30"
          >
            clear
          </button>
        </div>
      </div>

      {/* Output */}
      <div ref={outputRef} className="flex-1 overflow-y-auto p-4 font-mono text-[12.5px] leading-relaxed">
        <div className="mb-3 space-y-1">
          <p className="text-[#7f8ea3]"># One command at a time, run by the DEX agent on the remote machine (no admin rights).</p>
          <p className="text-[#7f8ea3]"># Not an interactive shell: `cd` and variables don't carry over between commands.</p>
          <p className="text-[#7f8ea3]"># The user at that PC is asked to approve each command before it runs.</p>
          {!online && <p className="text-amber-300"># Device is offline - commands wait until the agent reconnects.</p>}
          <p className="text-[#7f8ea3]">
            # Try: <span className="text-[#c3cfdd]">ipconfig /all</span>, <span className="text-[#c3cfdd]">tasklist | findstr chrome</span>,{' '}
            <span className="text-[#c3cfdd]">powershell -Command "Get-Service -Name Spooler"</span>. ↑/↓ for history.
          </p>
        </div>

        {entries.map((entry) => (
          <div key={entry.id} className="mb-3">
            <div className="flex items-center gap-2">
              <span className="select-none text-emerald-400">❯</span>
              <span className="text-[#e6edf5]">{entry.command}</span>
              <span className="text-[11px] text-[#66758b]">{entry.timestamp.toLocaleTimeString()}</span>
              {entry.note && <span className="text-[11px] text-[#7f8ea3]">· {entry.note}</span>}
            </div>
            {entry.state === 'running' ? (
              <div className="mt-1 flex items-center gap-2 pl-5 text-amber-300">
                <span className="h-3 w-3 animate-spin rounded-full border border-amber-400/40 border-t-amber-300" />
                waiting for the agent and the user's approval…
              </div>
            ) : (
              <pre
                className={`mt-1 whitespace-pre-wrap pl-5 text-[12.5px] ${
                  entry.state === 'done' ? 'text-[#c3cfdd]' : 'text-red-400'
                }`}
              >
                {entry.output}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/10 bg-white/[0.03] px-3 py-2.5 transition-colors focus-within:bg-white/[0.06]">
        <span className="select-none font-mono text-sm text-emerald-400">❯</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='e.g. powershell -Command "Get-Service -Name Spooler"'
          disabled={isExecuting}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent font-mono text-[13px] text-[#e6edf5] caret-emerald-400 placeholder:text-[#5b6b82] disabled:opacity-50"
          autoFocus
          // The global :focus-visible outline (global.css) outranks Tailwind's utilities;
          // the whole input row is highlighted on focus instead.
          style={{ outline: 'none' }}
        />
        <button
          type="submit"
          disabled={isExecuting || !command.trim()}
          className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-400 disabled:opacity-40"
        >
          Run
        </button>
      </form>
    </div>
  );
};

export default RemoteTerminal;
