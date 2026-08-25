import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TerminalIcon, 
  Send, 
  Trash2, 
  ArrowDown, 
  Check, 
  Copy, 
  Filter,
  Layers
} from 'lucide-react';
import { grbl } from '../services/grblService';

interface LogItem {
  id: string;
  type: 'send' | 'recv' | 'info' | 'error';
  text: string;
  time: string;
}

export const GrblConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [inputCommand, setInputCommand] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [filterStatusPolls, setFilterStatusPolls] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = grbl.onLog((msg) => {
      // Filter out periodic status reports if requested
      if (filterStatusPolls && msg.type === 'recv' && msg.text.startsWith('<') && msg.text.endsWith('>')) {
        return;
      }
      if (filterStatusPolls && msg.type === 'send' && msg.text === '?') {
        return;
      }

      setLogs((prev) => [
        ...prev.slice(-300), // Keep last 300 entries for high performance
        { id: Math.random().toString(36).substring(7), ...msg },
      ]);
    });

    return () => unsub();
  }, [filterStatusPolls]);

  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleSendCommand = async (cmd?: string) => {
    const commandToSend = (cmd !== undefined ? cmd : inputCommand).trim();
    if (!commandToSend) return;

    await grbl.send(commandToSend);

    setHistory((prev) => [commandToSend, ...prev.filter(h => h !== commandToSend).slice(0, 50)]);
    setHistoryIndex(-1);
    if (cmd === undefined) setInputCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(nextIdx);
        setInputCommand(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputCommand(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputCommand('');
      }
    }
  };

  const handleCopyLog = () => {
    const text = logs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickMacros = [
    { label: '$$ (Settings)', cmd: '$$' },
    { label: '$# (Offsets)', cmd: '$#' },
    { label: '$G (Parser)', cmd: '$G' },
    { label: '$I (Build Info)', cmd: '$I' },
    { label: '? (Status)', cmd: '?' },
    { label: '$X (Unlock)', cmd: '$X' },
    { label: '$H (Home)', cmd: '$H' },
    { label: '$C (Check Mode)', cmd: '$C' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 shadow-lg text-slate-200 flex flex-col h-[550px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-sm text-slate-100">GRBL Echtzeit-Seriell-Konsole</h3>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400">
            <input
              type="checkbox"
              checked={filterStatusPolls}
              onChange={(e) => setFilterStatusPolls(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            <span>Status-Polling (?) ausblenden</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            <span>Auto-Scroll</span>
          </label>

          <button
            onClick={handleCopyLog}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
            title="Protokoll in Zwischenablage kopieren"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setLogs([])}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition-colors"
            title="Konsole leeren"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Macros */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] text-slate-500 uppercase font-semibold mr-1">Makros:</span>
        {quickMacros.map((m) => (
          <button
            key={m.cmd}
            onClick={() => handleSendCommand(m.cmd)}
            className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 font-mono text-[11px] rounded border border-slate-800 transition-colors whitespace-nowrap"
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Console Log Area */}
      <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-3 overflow-y-auto font-mono text-xs leading-relaxed space-y-1 select-text">
        {logs.length === 0 ? (
          <div className="text-slate-600 text-center py-10">
            Keine Daten empfangen. Verbinde mit einem COM-Port oder starte den Simulator.
          </div>
        ) : (
          logs.map((log) => {
            let color = 'text-slate-300';
            let prefix = '';

            if (log.type === 'send') {
              color = 'text-emerald-400 font-bold';
              prefix = '>';
            } else if (log.type === 'recv') {
              color = 'text-cyan-300';
              prefix = '<';
            } else if (log.type === 'error') {
              color = 'text-rose-400 font-bold';
              prefix = '✗';
            } else if (log.type === 'info') {
              color = 'text-indigo-400';
              prefix = 'ℹ';
            }

            return (
              <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/60 px-1 py-0.5 rounded">
                <span className="text-[10px] text-slate-600 select-none">{log.time}</span>
                <span className="text-slate-500 select-none w-3 text-center">{prefix}</span>
                <span className={`flex-1 break-all ${color}`}>{log.text}</span>
              </div>
            );
          })
        )}
        <div ref={consoleEndRef} />
      </div>

      {/* Command Input Bar */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="GRBL Befehl eingeben ($$, G0 X10 Y10, G10 L20 P1 X0, etc.)..."
          className="flex-1 bg-slate-950 text-slate-100 rounded-md px-3 py-2 border border-slate-800 text-xs font-mono focus:outline-none focus:border-indigo-500 shadow-inner"
        />
        <button
          onClick={() => handleSendCommand()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Senden</span>
        </button>
      </div>
    </div>
  );
};
