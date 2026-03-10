import { MapPin, Plus } from "lucide-react"

interface HeaderProps {
  setShowAddModal: (show: boolean) => void;
}

export const Header = ({
  setShowAddModal,
}: HeaderProps) => {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 glass z-50">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <MapPin size={24} className="text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">KnTag Server</h1>
      </div>

      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all text-sm"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={18} />
          Add Tag
        </button>
      </div>
    </header>
  )
}