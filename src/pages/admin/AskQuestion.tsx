import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircleQuestion,
  Send,
  Download,
  Loader2,
  RotateCcw,
  Calendar,
  Tag,
  Layers,
} from 'lucide-react';
import {
  answerQuestion,
  detectQueryIntent,
  ModuleType,
  MODULE_META,
  QAAnswer,
} from '@/src/lib/qaEngine';
import { downloadExcel } from '@/src/lib/utils';
import { cn } from '@/src/lib/utils';

// ─── Module card list ─────────────────────────────────────────────────────────

const MODULES = Object.entries(MODULE_META) as [ModuleType, typeof MODULE_META[ModuleType]][];

// ─── Conversation types ───────────────────────────────────────────────────────

type ConversationItem =
  | { id: number; loading: true; question: string }
  | { id: number; loading: false; answer: QAAnswer };

// ─── Component ────────────────────────────────────────────────────────────────

export default function AskQuestion() {
  const [selectedModule, setSelectedModule] = useState<ModuleType | null>(null);
  const [conversation, setConversation]     = useState<ConversationItem[]>([]);
  const [input, setInput]                   = useState('');
  const [isAsking, setIsAsking]             = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Live keyword detection — runs as user types
  const intent = useMemo(
    () => detectQueryIntent(input, selectedModule),
    [input, selectedModule]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || isAsking) return;
    const id = Date.now();
    setIsAsking(true);
    setInput('');

    setConversation(prev => [...prev, { id, loading: true, question: q }]);

    try {
      const answer = await answerQuestion(q, selectedModule);
      setConversation(prev =>
        prev.map(item => item.id === id ? { id, loading: false, answer } : item)
      );
    } catch {
      setConversation(prev =>
        prev.map(item =>
          item.id === id
            ? { id, loading: false, answer: { question: q, summary: 'An error occurred.', lines: [], error: 'Check your connection and try again.' } }
            : item
        )
      );
    } finally {
      setIsAsking(false);
      inputRef.current?.focus();
    }
  }

  function selectModule(mod: ModuleType) {
    setSelectedModule(prev => prev === mod ? null : mod);
    inputRef.current?.focus();
  }

  function clearAll() {
    setConversation([]);
    setSelectedModule(null);
    setInput('');
    inputRef.current?.focus();
  }

  const activeModuleMeta = selectedModule ? MODULE_META[selectedModule] : null;

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] md:h-[calc(100vh-9rem)] lg:h-[calc(100vh-10rem)] max-w-4xl mx-auto gap-3 md:gap-4">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-church-blue flex items-center justify-center shadow-lg shadow-church-blue/20 flex-shrink-0">
            <MessageCircleQuestion className="w-5 h-5 sm:w-6 sm:h-6 text-church-yellow" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-bold text-church-black">Church Assistant</h2>
            <p className="text-[10px] sm:text-xs text-church-gray hidden sm:block">Select a module, then ask your question</p>
          </div>
        </div>
        {(conversation.length > 0 || selectedModule) && (
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-church-gray border border-church-blue/10 rounded-full hover:bg-church-soft transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* ── Module cards ────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0 scrollbar-hide"
           style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {MODULES.map(([mod, meta]) => {
          const isSelected = selectedModule === mod;
          return (
            <button
              key={mod}
              onClick={() => selectModule(mod)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 transition-all flex-shrink-0',
                isSelected
                  ? 'border-church-yellow bg-church-yellow/10 shadow-md shadow-church-yellow/20 scale-[1.03] font-bold'
                  : 'border-church-blue/10 bg-white hover:border-church-blue/30 hover:bg-church-soft'
              )}
            >
              <span className={cn(
                'text-xs font-semibold whitespace-nowrap',
                isSelected ? 'text-church-black' : 'text-church-gray'
              )}>
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Example questions for selected module ───────────────────── */}
      <AnimatePresence mode="wait">
        {activeModuleMeta && (
          <motion.div
            key={selectedModule}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden flex-shrink-0"
          >
            <div className="bg-white rounded-xl sm:rounded-2xl border border-church-blue/8 p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-church-gray mb-2">
                {activeModuleMeta.label} examples
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1"
                   style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {activeModuleMeta.examples.map(ex => (
                  <button
                    key={ex}
                    onClick={() => ask(ex)}
                    disabled={isAsking}
                    className="text-xs px-3 py-1.5 bg-church-soft border border-church-blue/10 rounded-full text-church-black hover:bg-church-yellow hover:border-church-yellow transition-all disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Conversation area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 pb-2">

        {/* Empty state */}
        {conversation.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center gap-3 py-10"
          >
            <div className="w-16 h-16 rounded-3xl bg-church-soft flex items-center justify-center">
              <MessageCircleQuestion className="w-8 h-8 text-church-gray/40" />
            </div>
            <p className="text-sm font-semibold text-church-gray">No questions yet</p>
            <p className="text-xs text-church-gray/60 max-w-xs">
              {selectedModule
                ? `Ask anything about ${activeModuleMeta?.label} or click an example above`
                : 'Select a module above or type any question below'}
            </p>
          </motion.div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {conversation.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-3"
            >
              {/* Question bubble */}
              <div className="flex justify-end">
                <div className="max-w-[78%] bg-church-blue text-white px-5 py-3 rounded-3xl rounded-br-lg text-sm font-medium shadow-lg shadow-church-blue/15">
                  {item.loading ? item.question : item.answer.question}
                </div>
              </div>

              {/* Loading */}
              {item.loading && (
                <div className="flex items-center gap-3 pl-2">
                  <AssistantAvatar />
                  <div className="bg-white border border-church-blue/8 rounded-3xl rounded-bl-lg px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-2 text-church-gray text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Looking up your data…
                    </div>
                  </div>
                </div>
              )}

              {/* Answer */}
              {!item.loading && (
                <div className="flex items-start gap-3 pl-2">
                  <AssistantAvatar />
                  <AnswerCard answer={item.answer} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ── Live keyword detection strip ────────────────────────────── */}
      <AnimatePresence>
        {input.trim().length >= 3 && intent.chips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex items-center gap-2 px-1"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-church-gray/60">Detected:</span>
            {intent.chips.map((chip, i) => (
              <span
                key={i}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border',
                  chip.type === 'date'   && 'bg-blue-50 text-blue-700 border-blue-200',
                  chip.type === 'module' && 'bg-yellow-50 text-yellow-800 border-yellow-200',
                  chip.type === 'entity' && 'bg-gray-50 text-gray-700 border-gray-200',
                )}
              >
                {chip.type === 'date'   && <Calendar className="w-2.5 h-2.5" />}
                {chip.type === 'module' && <Layers className="w-2.5 h-2.5" />}
                {chip.type === 'entity' && <Tag className="w-2.5 h-2.5" />}
                {chip.label}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input bar ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-church-blue/10 shadow-lg shadow-church-blue/5 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 flex-shrink-0">
        {activeModuleMeta && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-church-blue/60 flex-shrink-0 hidden sm:inline">
            {activeModuleMeta.label}:
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask(input)}
          placeholder={
            activeModuleMeta
              ? `Ask about ${activeModuleMeta.label}… e.g. "expenses this month"`
              : 'Ask a question… e.g. "How many people came last Sunday?"'
          }
          disabled={isAsking}
          className="flex-1 bg-transparent text-sm text-church-black placeholder:text-church-gray/50 outline-none disabled:opacity-50"
        />
        <button
          onClick={() => ask(input)}
          disabled={!input.trim() || isAsking}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
            input.trim() && !isAsking
              ? 'bg-church-blue text-white shadow-md shadow-church-blue/30 hover:scale-105 active:scale-95'
              : 'bg-church-soft text-church-gray/40 cursor-not-allowed'
          )}
        >
          {isAsking
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AssistantAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-church-yellow flex items-center justify-center flex-shrink-0 mt-1 shadow">
      <MessageCircleQuestion className="w-4 h-4 text-church-black" />
    </div>
  );
}

function AnswerCard({ answer }: { answer: QAAnswer }) {
  return (
    <div className="flex-1 bg-white border border-church-blue/8 rounded-3xl rounded-bl-lg shadow-sm overflow-hidden max-w-[calc(100%-3rem)]">

      {/* Summary */}
      <div className="px-5 py-4 bg-church-soft/40 border-b border-church-blue/5">
        <p className={cn('text-sm font-semibold', answer.error && !answer.lines.length ? 'text-red-500' : 'text-church-black')}>
          {answer.summary}
        </p>
      </div>

      {/* Data lines */}
      {answer.lines.length > 0 && (
        <div className="px-5 py-4 space-y-2.5">
          {answer.lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'flex items-baseline justify-between gap-4',
                line.sub && 'pl-4',
              )}
            >
              <span className={cn(
                'text-xs flex-1',
                line.highlight ? 'font-bold text-church-black' : line.sub ? 'text-church-gray/70' : 'text-church-gray'
              )}>
                {line.label}
              </span>
              <span className={cn(
                'text-xs font-bold tabular-nums text-right flex-shrink-0',
                line.highlight ? 'text-church-blue text-sm' : line.sub ? 'text-church-gray' : 'text-church-black'
              )}>
                {line.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error hint */}
      {answer.error && (
        <div className="px-5 pb-4">
          <p className="text-xs text-church-gray bg-church-soft rounded-xl px-4 py-3 leading-relaxed">
            💡 {answer.error}
          </p>
        </div>
      )}

      {/* Download */}
      {answer.reportData && answer.reportData.length > 0 && (
        <div className="px-5 pb-4">
          <button
            onClick={() => downloadExcel(answer.reportData!, answer.reportFilename || 'Report.xlsx')}
            className="flex items-center gap-2 px-4 py-2 bg-church-blue/5 hover:bg-church-blue hover:text-white text-church-blue border border-church-blue/20 rounded-xl text-xs font-bold transition-all group"
          >
            <Download className="w-3.5 h-3.5" />
            Download Report ({answer.reportData.length} records)
          </button>
        </div>
      )}
    </div>
  );
}
