import { MapPin, Plus } from "lucide-react"

interface HeaderProps {
  password: string;
  setPassword: (password: string) => void;
  setShowAddModal: (show: boolean) => void;
}

export const Header = ({
  password,
  setPassword,
  setShowAddModal
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
        <input
          type="password"
          placeholder="Apple ID Password"
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm w-64"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
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