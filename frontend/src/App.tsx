import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Terminal, 
  FileCode, 
  CheckCircle2, 
  Play, 
  MessageSquare, 
  Cpu, 
  Circle, 
  Loader2,
  ChevronRight,
  Send,
  Square,
  User,
  PenTool,
  Copy,
  Check,
  X,
  Image as ImageIcon
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Types ---
type EventType = 'plan' | 'todo' | 'command' | 'file_read' | 'file_write' | 'thought' | 'user_message' | 'file_content';

interface TodoItem {
  id: number;
  task: string;
  status: 'pending' | 'in-progress' | 'done';
}

interface AgentEvent {
  id?: string;
  type: EventType;
  content?: string; 
  items?: TodoItem[];
  command?: string; 
  output?: string; 
  path?: string; 
  lines?: number; 
  content_preview?: string; 
  images?: string[]; // New: images in user message
}

// --- Helper Components ---

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Custom Markdown Renderers ---

const CodeBlock = ({ language, value }: { language: string, value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md overflow-hidden my-4 border border-gray-200 shadow-sm bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#404040]">
        <span className="text-xs font-mono text-gray-400 uppercase">{language || 'text'}</span>
        <button 
          onClick={handleCopy}
          className="text-gray-400 hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>
      <div className="text-xs">
        <SyntaxHighlighter
          language={language || 'text'}
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
          wrapLines={true}
          wrapLongLines={true}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const MarkdownComponents: Components = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
    ) : (
      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800" {...props}>
        {children}
      </code>
    );
  },
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-gray-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-gray-700">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-gray-900">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2 text-gray-900">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1 text-gray-900">{children}</h3>,
  a: ({ href, children }) => <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
};


// --- Event Block Components ---

const UserMessageBlock = ({ content, images }: { content: string, images?: string[] }) => (
  <div className="mb-8 flex justify-end">
    <div className="max-w-[85%] bg-gray-900 text-gray-50 px-5 py-4 rounded-2xl rounded-tr-sm shadow-sm flex items-start gap-3">
      <div className="flex-1 min-w-0 overflow-hidden">
        {images && images.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {images.map((img, i) => (
              <img key={i} src={img} alt="User upload" className="h-32 w-auto rounded-lg border border-gray-700 object-cover" />
            ))}
          </div>
        )}
        <ReactMarkdown 
          components={{
            ...MarkdownComponents,
            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-gray-200">{children}</p>,
            code: ({ inline, children }) => 
              inline 
              ? <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-gray-300">{children}</code>
              : <code className="block bg-gray-800 p-2 rounded text-sm font-mono text-gray-300 whitespace-pre-wrap my-2">{children}</code>
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <div className="mt-1 p-0.5 bg-gray-700 rounded-full shrink-0">
        <User size={12} className="text-gray-300" />
      </div>
    </div>
  </div>
);

const PlanBlock = ({ content }: { content: string }) => (
  <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
    <div className="flex items-start gap-3">
      <div className="p-1 bg-blue-100 text-blue-600 rounded shrink-0">
        <Cpu size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Strategy</h3>
        <div className="text-gray-700 text-sm">
          <ReactMarkdown components={MarkdownComponents}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  </div>
);

const TodoBlock = ({ items }: { items: TodoItem[] }) => (
  <div className="mb-6 ml-2 pl-4 border-l-2 border-gray-200">
    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tasks</h4>
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 text-sm">
          {item.status === 'done' && <CheckCircle2 size={16} className="text-green-600 shrink-0" />}
          {item.status === 'in-progress' && <Loader2 size={16} className="text-blue-600 animate-spin shrink-0" />}
          {item.status === 'pending' && <Circle size={16} className="text-gray-300 shrink-0" />}
          <span className={cn(
            "transition-colors duration-200",
            item.status === 'done' ? "text-gray-500 line-through decoration-gray-300" : "text-gray-900",
            item.status === 'in-progress' && "font-medium text-blue-700"
          )}>
            {item.task}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const CommandBlock = ({ command, output }: { command: string, output?: string }) => (
  <div className="mb-6 rounded-lg overflow-hidden border border-gray-200">
    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
      <Terminal size={14} className="text-gray-500" />
      <code className="text-xs font-mono text-gray-700 truncate">{command}</code>
    </div>
    <div className="bg-white p-4 overflow-x-auto">
      {output ? (
         <pre className="text-xs font-mono text-gray-600 leading-normal whitespace-pre-wrap">
          {output}
        </pre>
      ) : (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={12} className="animate-spin" />
          <span>Executing...</span>
        </div>
      )}
    </div>
  </div>
);

const FileReadBlock = ({ 
  path, 
  lines, 
  content_preview, 
  onClick 
}: { 
  path: string, 
  lines?: number, 
  content_preview?: string,
  onClick: (path: string) => void
}) => (
  <div className="mb-6 ml-2 pl-4 border-l-2 border-blue-200">
    <button 
      onClick={() => onClick(path)}
      className="flex items-center gap-2 mb-2 group hover:text-blue-600 transition-colors"
    >
      <FileCode size={16} className="text-blue-600 group-hover:scale-110 transition-transform" />
      <span className="text-sm font-medium text-gray-900 font-mono underline decoration-transparent group-hover:decoration-blue-600 decoration-1 underline-offset-2 transition-all">
        {path}
      </span>
      {lines && <span className="text-xs text-gray-400">({lines} lines)</span>}
    </button>
    {content_preview && (
      <div className="bg-gray-50 rounded border border-gray-100 p-3">
        <pre className="text-xs font-mono text-gray-600 overflow-x-auto">
          {content_preview}
        </pre>
      </div>
    )}
  </div>
);

const FileWriteBlock = ({ 
  path, 
  content_preview, 
  output,
  onClick 
}: { 
  path: string, 
  content_preview?: string, 
  output?: string,
  onClick: (path: string) => void
}) => (
  <div className="mb-6 ml-2 pl-4 border-l-2 border-amber-400">
    <div className="flex items-center justify-between mb-2">
      <button 
        onClick={() => onClick(path)}
        className="flex items-center gap-2 group hover:text-amber-600 transition-colors"
      >
        <PenTool size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
        <span className="text-sm font-semibold text-gray-900 font-mono underline decoration-transparent group-hover:decoration-amber-500 decoration-1 underline-offset-2 transition-all">
          {path}
        </span>
      </button>
      {output && <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">{output}</span>}
    </div>
    {content_preview && (
      <div className="bg-amber-50/30 rounded border border-amber-100 p-3">
        <pre className="text-xs font-mono text-gray-700 overflow-x-auto">
          {content_preview}
        </pre>
      </div>
    )}
  </div>
);

const ThoughtBlock = ({ content }: { content: string }) => (
  <div className="mb-6 flex items-start gap-3 bg-green-50/50 p-4 rounded-lg border border-green-100">
    <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0" />
    <div className="text-sm text-gray-800 font-medium flex-1 min-w-0">
      <ReactMarkdown components={MarkdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  </div>
);

// --- File Viewer Panel ---

const FileViewer = ({ 
  isOpen, 
  onClose, 
  path, 
  content 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  path: string | null, 
  content: string | null 
}) => {
  return (
    <div 
      className={cn(
        "fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 ease-in-out z-20 flex flex-col",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white border border-gray-200 rounded text-gray-500">
            <FileCode size={16} />
          </div>
          <span className="font-mono text-sm font-medium text-gray-700">{path || 'No file selected'}</span>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      
      <div className="flex-1 overflow-auto bg-[#1e1e1e]">
        {content ? (
          <SyntaxHighlighter
            language="typescript" // Should ideally detect from extension
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent', fontSize: '13px', lineHeight: '1.5' }}
            showLineNumbers={true}
            lineNumberStyle={{ minWidth: '3em', paddingRight: '1em', color: '#6e7681', textAlign: 'right' }}
          >
            {content}
          </SyntaxHighlighter>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading file...</span>
          </div>
        )}
      </div>
    </div>
  );
};


export default function App() {
  const [mode, setMode] = useState<'agent' | 'chat'>('agent');
  const [feed, setFeed] = useState<AgentEvent[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // File Viewer State
  const [filePanelOpen, setFilePanelOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  // Vision / Drag & Drop State
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const connect = () => {
    if (socketRef.current) socketRef.current.close();
    
    const ws = new WebSocket('ws://localhost:8000/ws');
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to WebSocket');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as AgentEvent;
      
      // Handle File Content Response
      if (data.type === 'file_content' && data.path && data.content) {
        if (data.path === viewingFile) { // Ensure it matches current request
          setFileContent(data.content);
        }
        return;
      }

      setFeed((prev) => {
        if (data.id) {
          const index = prev.findIndex(item => item.id === data.id);
          if (index !== -1) {
            const newFeed = [...prev];
            newFeed[index] = { ...newFeed[index], ...data };
            return newFeed;
          }
        }
        return [...prev, data];
      });
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsGenerating(false);
      console.log('Disconnected');
    };
  };

  useEffect(() => {
    connect();
    return () => socketRef.current?.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!filePanelOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [feed, filePanelOpen]);

  // Drag and Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const validImages = files.filter(file => file.type.startsWith('image/'));
      
      const base64Promises = validImages.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(base64Promises);
      setPendingImages(prev => [...prev, ...base64Images]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && pendingImages.length === 0) || !isConnected) return;

    const userMsg: AgentEvent = {
      type: 'user_message',
      content: input,
      images: pendingImages
    };

    setFeed(prev => [...prev, userMsg]);
    setIsGenerating(true);
    
    socketRef.current?.send(JSON.stringify({
      type: 'user_message',
      content: input,
      images: pendingImages, // Send images to backend
      mode: mode
    }));

    setInput('');
    setPendingImages([]); // Clear images
  };

  const handleStop = () => {
    socketRef.current?.close();
    setIsGenerating(false);
    setTimeout(connect, 500);
  };

  const handleFileClick = (path: string) => {
    setViewingFile(path);
    setFileContent(null); 
    setFilePanelOpen(true);
    
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'get_file_content',
        path: path
      }));
    }
  };

  return (
    <div 
      className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 flex flex-col relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-3xl">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
            <div className="bg-blue-100 p-4 rounded-full text-blue-600">
              <ImageIcon size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Drop images here</h3>
            <p className="text-gray-500">Upload screenshots for the agent to analyze</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <h1 className="text-base font-semibold tracking-tight text-gray-900">Agent UI</h1>
          </div>

          <div className="flex bg-gray-100/80 p-1 rounded-lg">
            <button
              onClick={() => setMode('agent')}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                mode === 'agent' 
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200/50" 
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <div className="flex items-center gap-2">
                <Terminal size={14} />
                <span>Agent</span>
              </div>
            </button>
            <button
              onClick={() => setMode('chat')}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                mode === 'chat' 
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200/50" 
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={14} />
                <span>Chat</span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Feed */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 overflow-y-auto">
        {feed.length === 0 ? (
          <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-gray-50 inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 border border-gray-100 shadow-sm">
              <Cpu size={24} className="text-blue-500" />
            </div>
            <h2 className="text-gray-900 font-medium mb-2 text-xl">What are we building today?</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              Ask me to audit your code, fix bugs, or explain complex logic.
              <br/>
              <span className="text-xs text-gray-400 mt-2 block">Tip: Drag & Drop screenshots to debug errors!</span>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {feed.map((event, index) => (
              <div key={event.id || index}>
                {event.type === 'user_message' && (event.content || (event.images && event.images.length > 0)) && <UserMessageBlock content={event.content || ''} images={event.images} />}
                {event.type === 'plan' && event.content && <PlanBlock content={event.content} />}
                {event.type === 'todo' && event.items && <TodoBlock items={event.items} />}
                {event.type === 'command' && event.command && <CommandBlock command={event.command} output={event.output} />}
                
                {event.type === 'file_read' && event.path && (
                  <FileReadBlock 
                    path={event.path} 
                    lines={event.lines} 
                    content_preview={event.content_preview} 
                    onClick={handleFileClick}
                  />
                )}
                
                {event.type === 'file_write' && event.path && (
                  <FileWriteBlock 
                    path={event.path} 
                    content_preview={event.content_preview} 
                    output={event.output} 
                    onClick={handleFileClick}
                  />
                )}
                
                {event.type === 'thought' && event.content && <ThoughtBlock content={event.content} />}
              </div>
            ))}
            <div ref={bottomRef} className="h-20" />
          </div>
        )}
      </main>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-6 px-6">
        <div className="max-w-3xl mx-auto relative">
          
          {/* Image Previews */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto p-2">
              {pendingImages.map((img, index) => (
                <div key={index} className="relative group">
                  <img src={img} alt="Preview" className="h-20 w-auto rounded-lg border border-gray-200 shadow-sm" />
                  <button 
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form 
            onSubmit={handleSendMessage}
            className="flex items-center gap-3 bg-white border border-gray-200 p-2 pl-4 rounded-2xl shadow-lg focus-within:border-gray-400 transition-all"
          >
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'agent' ? "Tell the agent what to do..." : "Ask a question..."}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
              autoFocus
            />
            
            {isGenerating ? (
              <button 
                type="button"
                onClick={handleStop}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Square size={18} fill="currentColor" />
              </button>
            ) : (
              <button 
                type="submit"
                disabled={(!input.trim() && pendingImages.length === 0) || !isConnected}
                className="p-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-900 transition-all active:scale-95"
              >
                <Send size={18} />
              </button>
            )}
          </form>
          <div className="mt-2 text-[10px] text-gray-400 flex justify-center gap-4">
             <span>Shift + Enter for new line</span>
             <span>Mode: <span className="text-gray-600 font-medium capitalize">{mode}</span></span>
          </div>
        </div>
      </div>

      {/* File Viewer Panel */}
      <FileViewer 
        isOpen={filePanelOpen} 
        onClose={() => setFilePanelOpen(false)} 
        path={viewingFile} 
        content={fileContent} 
      />
      
    </div>
  );
}
