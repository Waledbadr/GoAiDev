'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  User,
  Send,
  X,
  Copy,
  Check,
  Trash2,
  Maximize2,
  Minimize2,
  Building2,
  Users,
  CalendarOff,
  Clock,
  Search,
  FileText,
  RefreshCw,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: string;
  sources?: string[];
}

const QUICK_SUGGESTIONS_AR = [
  { text: 'كم عدد الساكنين حالياً؟', icon: Users, category: 'occupancy' },
  { text: 'مين الغائب اليوم؟', icon: Clock, category: 'attendance' },
  { text: 'أعطني قائمة بالمتبقي للعودة من إجازة', icon: CalendarOff, category: 'leaves' },
  { text: 'ما هي نسبة إشغال المجمعات السكنية؟', icon: Building2, category: 'occupancy' },
  { text: 'ملخص العقود السارية', icon: FileText, category: 'contracts' },
];

const QUICK_SUGGESTIONS_EN = [
  { text: 'How many current residents are accommodated?', icon: Users, category: 'occupancy' },
  { text: 'Who is absent today?', icon: Clock, category: 'attendance' },
  { text: 'Workers remaining to return from vacation', icon: CalendarOff, category: 'leaves' },
  { text: 'What is the occupancy rate by residence?', icon: Building2, category: 'occupancy' },
  { text: 'Active contracts summary', icon: FileText, category: 'contracts' },
];

/**
 * Custom Markdown-like Renderer for AI answers with Tables and Highlights
 */
function MarkdownRenderer({ content }: { content: string }) {
  // Simple table & markdown parser for rich display
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableRows: string[][] = [];
  let tableKey = 0;

  const renderTable = (rows: string[][], key: number) => {
    if (rows.length === 0) return null;
    const headerRow = rows[0];
    const dataRows = rows.slice(1).filter((r) => !r.every((cell) => cell.includes('---') || cell.includes(':--')));

    return (
      <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-lg border border-border/80 bg-muted/40 shadow-sm">
        <table className="w-full text-right text-xs">
          <thead className="border-b border-border/70 bg-muted/70 text-foreground font-semibold">
            <tr>
              {headerRow.map((cell, idx) => (
                <th key={idx} className="p-2.5 whitespace-nowrap">
                  {cell.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/60 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2.5 text-foreground/90 whitespace-nowrap">
                    {parseInlineMarkdown(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const parseInlineMarkdown = (text: string): React.ReactNode => {
    // Replace bold **text**
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono text-primary font-semibold">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for table row
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      const cells = line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      inTable = false;
      elements.push(renderTable(tableRows, tableKey++));
      tableRows = [];
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-sm font-bold text-foreground">
          {line.replace('### ', '')}
        </h4>
      );
    } else if (line.startsWith('## ') || line.startsWith('# ')) {
      elements.push(
        <h3 key={i} className="mt-3 mb-1.5 text-base font-bold text-foreground flex items-center gap-1.5">
          {line.replace(/^#+\s*/, '')}
        </h3>
      );
    } else if (line.startsWith('* ') || line.startsWith('- ')) {
      elements.push(
        <li key={i} className="ml-4 mr-4 list-disc py-0.5 text-sm text-foreground/90 leading-relaxed">
          {parseInlineMarkdown(line.slice(2))}
        </li>
      );
    } else if (line.trim() === '---') {
      elements.push(<hr key={i} className="my-2.5 border-border/60" />);
    } else if (line.trim().length > 0) {
      elements.push(
        <p key={i} className="my-1.5 text-sm text-foreground/90 leading-relaxed">
          {parseInlineMarkdown(line)}
        </p>
      );
    }
  }

  if (inTable && tableRows.length > 0) {
    elements.push(renderTable(tableRows, tableKey++));
  }

  return <div className="space-y-1">{elements}</div>;
}

export function AICopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { locale } = useLanguage();
  const { toast } = useToast();
  const isAr = locale === 'ar';

  // Listen for global window open event
  useEffect(() => {
    const handleOpenCopilot = () => {
      setIsOpen(true);
    };

    window.addEventListener('open-estate-copilot', handleOpenCopilot);
    return () => {
      window.removeEventListener('open-estate-copilot', handleOpenCopilot);
    };
  }, []);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcome: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: isAr
          ? `مرحباً بك في **المساعد الذكي (AI Copilot)** لإدارة العمليات والإسكان 🤖\n\nيمكنك سؤالي مباشرة عن:\n* **كم عدد الساكنين حالياً؟** ونسب الإشغال في المجمعات.\n* **مين الغائب اليوم؟** مع كشف التايم شيت وساعات العمل.\n* **قائمة العمال المتبقي لعودتهم من الإجازة.**\n* **البحث عن أي عامل** ومعرفة مقر سكنه أو رقم إقامته.`
          : `Welcome to **EstateCare AI Copilot** 🤖\n\nYou can ask me directly about:\n* **Current occupants & occupancy rates** across all residences.\n* **Today's absent/present workers** from timesheet records.\n* **Workers returning soon from vacations & leaves.**\n* **Worker search** by name or badge to find accommodation info.`,
        timestamp: new Date().toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcome]);
    }
  }, [isAr, messages.length]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        const botMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
          category: data.category,
          sources: data.sources,
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(data.error || 'فشل في استلام الرد');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `bot_err_${Date.now()}`,
        role: 'assistant',
        content: isAr
          ? `عذراً، حدث خطأ أثناء الاتصال بالنظام: ${err.message || 'يرجى المحاولة مرة أخرى.'}`
          : `Sorry, an error occurred while querying the system: ${err.message || 'Please try again.'}`,
        timestamp: new Date().toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: isAr ? 'تم النسخ' : 'Copied',
      description: isAr ? 'تم نسخ النص إلى الحافظة' : 'Response copied to clipboard',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([]);
    toast({
      title: isAr ? 'تم مسح المحادثة' : 'Chat cleared',
      description: isAr ? 'تم بدء محادثة جديدة' : 'New session started',
    });
  };

  const suggestions = isAr ? QUICK_SUGGESTIONS_AR : QUICK_SUGGESTIONS_EN;

  return (
    <>
      {/* 1. Global Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40 print:hidden flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'group relative flex items-center justify-center gap-2.5 rounded-full p-3.5 shadow-2xl transition-all duration-300 active:scale-95',
            'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:shadow-indigo-500/30 hover:scale-105',
            'border border-white/20 dark:border-white/10 ring-4 ring-indigo-500/10'
          )}
          title={isAr ? 'المساعد الذكي (AI Copilot)' : 'AI Copilot Assistant'}
        >
          <div className="relative">
            <Sparkles className="h-6 w-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <span className="hidden sm:inline-block font-semibold text-sm pr-1">
            {isAr ? 'المساعد الذكي' : 'AI Copilot'}
          </span>
        </button>
      </div>

      {/* 2. Floating AI Slide-Over Drawer / Panel */}
      {isOpen && (
        <div
          className={cn(
            'fixed inset-y-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl border-border shadow-2xl transition-all duration-300 ease-in-out',
            isAr ? 'left-0 border-r' : 'right-0 border-l',
            isExpanded ? 'w-full md:w-[720px] lg:w-[850px]' : 'w-full sm:w-[440px] md:w-[480px]'
          )}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/80 px-4 py-3.5 bg-muted/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-md">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-foreground">
                    {isAr ? 'مساعد العمليات الذكي' : 'Operations AI Copilot'}
                  </h3>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0 px-1.5 font-medium">
                    D1 Live
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? 'إجابات فورية من واقع قاعدة بيانات النظام الحية' : 'Live ground data from database'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? (isAr ? 'تصغير' : 'Collapse') : (isAr ? 'توسيع' : 'Expand')}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleClearChat}
                title={isAr ? 'مسح المحادثة' : 'Clear Chat'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
                title={isAr ? 'إغلاق' : 'Close'}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Suggestions Horizontal Scroll */}
          <div className="border-b border-border/50 bg-muted/20 px-3 py-2 overflow-x-auto flex gap-2 no-scrollbar">
            {suggestions.map((s, idx) => {
              const Icon = s.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(s.text)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 whitespace-nowrap transition-all shadow-2xs"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span>{s.text}</span>
                </button>
              );
            })}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={cn('flex gap-3 text-sm animate-in fade-in-50 duration-200', isUser ? 'justify-end' : 'justify-start')}
                >
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'group relative max-w-[85%] rounded-2xl p-3.5 shadow-sm transition-all',
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-br-xs'
                        : 'bg-card border border-border/70 text-card-foreground rounded-bl-xs'
                    )}
                  >
                    {!isUser ? (
                      <div className="space-y-2">
                        <MarkdownRenderer content={msg.content} />
                        {msg.sources && (
                          <div className="flex items-center gap-1 pt-2 text-[10px] text-muted-foreground border-t border-border/40">
                            <span className="font-semibold">{isAr ? 'المصدر:' : 'Source:'}</span>
                            <span>{msg.sources.join(' • ')}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}

                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-70">
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary flex items-center gap-1"
                          title={isAr ? 'نسخ' : 'Copy'}
                        >
                          {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border mt-0.5">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3 text-sm animate-in fade-in duration-200">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Bot className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-2xl rounded-bl-xs bg-card border border-border/70 p-3.5 shadow-sm space-y-2 max-w-[80%]">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>{isAr ? 'جاري تحليل واستخراج البيانات من قاعدة البيانات...' : 'Analyzing live database...'}</span>
                  </div>
                  <div className="flex gap-1.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Area */}
          <div className="border-t border-border/80 p-3 bg-muted/20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 shadow-inner focus-within:ring-2 focus-within:ring-primary/30"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder={isAr ? 'اسأل المساعد الذكي عن الساكنين، الغياب، الإجازات...' : 'Ask about occupants, attendance, leaves...'}
                className="flex-1 max-h-32 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                style={{ minHeight: '40px' }}
              />

              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className={cn(
                  'h-9 w-9 shrink-0 rounded-xl transition-all',
                  input.trim() ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground'
                )}
              >
                <Send className={cn('h-4 w-4', isAr && 'rotate-180')} />
              </Button>
            </form>
            <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-muted-foreground/70">
              <span>{isAr ? 'اضغط Enter للإرسال، Shift + Enter لسطر جديد' : 'Press Enter to send, Shift+Enter for newline'}</span>
              <span>{isAr ? 'بيانات D1 حية 100%' : '100% Live D1 Data'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
