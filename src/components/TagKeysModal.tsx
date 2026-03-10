'use client';

import { X, Copy, Check } from 'lucide-react';
import { Tag } from '@/types';
import { useState } from 'react';

interface TagKeysModalProps {
  tag: Tag;
  onClose: () => void;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
        <span className="flex-1 text-xs text-slate-300 font-mono break-all">{value}</span>
        <button
          onClick={copy}
          className="shrink-0 p-1 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export function TagKeysModal({ tag, onClose }: TagKeysModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="font-semibold text-slate-100">Keys — {tag.name}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <CopyField label="Public Key" value={tag.publicKey} />
          <CopyField label="Private Key" value={tag.privateKey} />
          <CopyField label="Hashed Public Key" value={tag.hashedPublicKey} />
        </div>
      </div>
    </div>
  );
}
