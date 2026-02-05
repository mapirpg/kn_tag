import { useState } from "react";
import api from "@/lib/api";
import { Tag } from "@/types";
import { useForm } from "react-hook-form";
import { CheckCircle, Copy, Key, TagIcon, X } from "lucide-react";

interface AddTagModalProps {
  onCloseModal: () => void;
  fetchTags: () => void;
  loading: boolean;
  generatedKeys: {
    publicKey: string;
    privateKey: string;
    hashedPublicKey: string;
  } | null;
  setGeneratedKeys: (keys: { 
    publicKey: string; 
    privateKey: string; 
    hashedPublicKey: string
  } | null) => void;
}

export const AddTagModal = ({
  onCloseModal,
  fetchTags,
  loading,
  generatedKeys,
  setGeneratedKeys
}: AddTagModalProps) => {
  const { register, handleSubmit, reset, formState: { errors, isValid } } = useForm<{ name: string }>({ mode: 'onChange' });
  const [copied, setCopied] = useState<string | null>(null);

  const handleCloseModal = () => {
    onCloseModal();
    setGeneratedKeys(null);
    setCopied(null);
    reset();
  }

  const generateKeys = async () => {
    try {
      const res = await api.post('/tags/generate');
      setGeneratedKeys(res.data);
    } catch (err: any) {
      alert('Failed to generate keys: ' + (err.response?.data?.message || err.message));
    }
  };

  const createTag = async (data: { name: string }) => {
    if (!generatedKeys) {
      alert('Please generate keys first');
      return;
    }
    try {
      await api.post('/tags', {
        name: data.name.trim(),
        publicKey: generatedKeys.publicKey,
        privateKey: generatedKeys.privateKey,
      });
      fetchTags();
      handleCloseModal();
    } catch (err: any) {
      alert('Failed to create tag: ' + (err.response?.data?.message || err.message));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-9999 p-4 transition-all animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl animate-in zoom-in-95 duration-200">
          <form onSubmit={handleSubmit(createTag)}>
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <TagIcon size={20} className="text-white" />
              </div>
              <h2 className="text-xl font-bold">Add New Tag</h2>
            </div>
            <button 
              type="button"
              onClick={handleCloseModal}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-6">
            {/* Tag Name */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">Tag Name</label>
              <input
                type="text"
                placeholder="e.g., My Backpack, Keys, Wallet"
                className={`w-full px-4 py-3 bg-white/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.name ? 'border-red-500' : 'border-white/10'}`}
                {...register('name', { 
                  required: 'Tag name is required',
                  minLength: { value: 2, message: 'Name must be at least 2 characters' },
                  maxLength: { value: 50, message: 'Name must be less than 50 characters' },
                  pattern: { value: /^[a-zA-Z0-9\s-_]+$/, message: 'Only letters, numbers, spaces, hyphens and underscores allowed' }
                })}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1 block">{errors.name.message}</p>}
            </div>

            {/* Generate Keys Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-300">Encryption Keys</label>
                <button
                  type="button"
                  onClick={generateKeys}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Key size={16} />
                  Generate Keys
                </button>
              </div>

              {generatedKeys && (
                <div className="space-y-3 bg-white/5 p-4 rounded-lg border border-white/10">
                  {/* Public Key */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Public Key</span>
                      <button
                        onClick={() => copyToClipboard(generatedKeys.publicKey, 'public')}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        {copied === 'public' ? (
                          <CheckCircle size={14} className="text-green-400" />
                        ) : (
                          <Copy size={14} className="text-slate-400" />
                        )}
                      </button>
                    </div>
                    <code className="block text-xs bg-black/30 p-3 rounded border border-white/5 break-all font-mono text-slate-300">
                      {generatedKeys.publicKey}
                    </code>
                  </div>

                  {/* Private Key */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Private Key</span>
                      <button
                        onClick={() => copyToClipboard(generatedKeys.privateKey, 'private')}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        {copied === 'private' ? (
                          <CheckCircle size={14} className="text-green-400" />
                        ) : (
                          <Copy size={14} className="text-slate-400" />
                        )}
                      </button>
                    </div>
                    <code className="block text-xs bg-black/30 p-3 rounded border border-white/5 break-all font-mono text-slate-300">
                      {generatedKeys.privateKey}
                    </code>
                  </div>

                  {/* Hashed Public Key */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Hashed Public Key (For Apple)</span>
                      <button
                        onClick={() => copyToClipboard(generatedKeys.hashedPublicKey, 'hashed')}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        {copied === 'hashed' ? (
                          <CheckCircle size={14} className="text-green-400" />
                        ) : (
                          <Copy size={14} className="text-slate-400" />
                        )}
                      </button>
                    </div>
                    <code className="block text-xs bg-black/30 p-3 rounded border border-white/5 break-all font-mono text-slate-300">
                      {generatedKeys.hashedPublicKey}
                    </code>
                  </div>

                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-xs text-yellow-200">
                      <strong>Important:</strong> Use the <strong>Public Key</strong> to configure your ESP32 or OpenHaystack beacon.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || !generatedKeys || loading}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Tag'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}