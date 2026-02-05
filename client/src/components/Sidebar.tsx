import { RefreshCw, TagIcon } from "lucide-react";
import { Tag } from "../types";

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
  return (
    <aside className="w-80 border-r border-white/10 flex flex-col glass overflow-y-auto">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">My Tags</h2>
      </div>
      <div className="flex-1">
        {tags.map(tag => (
          <div key={tag.id} className="p-4 hover:bg-white/5 cursor-pointer border-b border-white/10 transition-colors group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <TagIcon size={18} className="text-blue-400" />
                <span className="font-semibold">{tag.name}</span>
              </div>
              <button 
                onClick={() => updateLocations(tag.id)}
                disabled={loading}
                className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400 group-hover:text-blue-400"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
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
  )
}