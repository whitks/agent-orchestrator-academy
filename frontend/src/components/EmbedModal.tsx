import React, { useState } from 'react';
import { Copy, Check, Code, ExternalLink, X } from 'lucide-react';

interface EmbedModalProps {
  tenantId: string;
  tenantName: string;
  themeColor: string;
  isOpen: boolean;
  onClose: () => void;
}

export const EmbedModal: React.FC<EmbedModalProps> = ({
  tenantId,
  tenantName,
  themeColor,
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const scriptTag = `<!-- Agent College Assistant for ${tenantName} -->
<script 
  src="http://localhost:8000/widget.js" 
  data-tenant-id="${tenantId}"
  data-api-url="http://localhost:8000"
  data-theme-color="${themeColor}"
  defer>
</script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200/90 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Code size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Embed on University Website</h3>
              <p className="text-[11px] text-slate-400">Drop-in assistant code for {tenantName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            Copy and paste this snippet right before the closing <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600">&lt;/body&gt;</code> tag on any college website or intranet page:
          </p>

          <div className="relative bg-slate-900 rounded-2xl p-4 text-xs font-mono text-slate-200 overflow-x-auto shadow-inner">
            <pre className="whitespace-pre-wrap">{scriptTag}</pre>
            <button
              onClick={copyToClipboard}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-sans transition-all cursor-pointer backdrop-blur-md"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 flex items-center justify-between text-xs text-indigo-900">
          <div>
            <span className="font-semibold block">Want to preview the widget in action?</span>
            <span className="text-[11px] text-indigo-700">Open a test portal with this widget injected live.</span>
          </div>
          <a
            href="http://localhost:8000/static/test_embed.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-2xs transition-colors shrink-0"
          >
            <span>Live Test</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
};
