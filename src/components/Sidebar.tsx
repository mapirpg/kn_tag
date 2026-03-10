'use client';

import { useState } from 'react';
import { RefreshCw, TagIcon, KeyRound } from "lucide-react";
import { Tag } from "@/types";
import { TagKeysModal } from "./TagKeysModal";

interface SidebarProps {
  tags: Tag[];
  loading: boolean;
  updateLocations: (tagId: string) => void;
}

export const Sidebar = ({
  loading,
  tags,
  updateLocations
}: SidebarProps) => {
  const [keysTag, setKeysTag] = useState<Tag | null>(null);

  return (
    <>
      <aside className="flex min-h-48 max-h-56 flex-col overflow-y-auto border-b border-white/10 glass lg:max-h-none lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r w-56">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">My Tags</h2>
        </div>
        <div className="flex-1 min-h-0">
          {tags.map(tag => (
            <div key={tag.id} className="p-4 hover:bg-white/5 cursor-pointer border-b border-white/10 transition-colors group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <TagIcon size={18} className="text-blue-400" />
                  <span className="font-semibold">{tag.name}</span>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => setKeysTag(tag)}
                    className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400 group-hover:text-slate-300"
                    title="View keys"
                  >
                    <KeyRound size={14} />
                  </button>
                  <button 
                    onClick={() => updateLocations(tag.id)}
                    disabled={loading}
                    className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400 group-hover:text-blue-400"
                    title="Refresh location"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              {tag.locations?.[0] ? (
                <div className="text-xs text-slate-500">
                  Last seen: {new Date(tag.locations[0].timestamp).toLocaleString()}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No reports found</div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {keysTag && <TagKeysModal tag={keysTag} onClose={() => setKeysTag(null)} />}
    </>
  );
}