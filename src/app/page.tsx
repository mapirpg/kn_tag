'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { AddTagModal } from '@/components/AddTagModal';
import { Tag } from '@/types';
import api from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Map } from '@/components/Map';

export default function Home() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<{ 
    privateKey: string; 
    publicKey: string; 
    hashedPublicKey: string 
  } | null>(null);


  const { 
      data: tags, 
      isLoading: loadingTags, 
      refetch: refetchTags 
  } = useQuery({
    queryKey: ['tags'],
    queryFn:  async () => {
      const{ data } = await api.get<Tag[]>('/tags');
      return data;
    },
  })

  const { data: sessionStatus } = useQuery({
    queryKey: ['apple-session'],
    queryFn: async () => {
      const { data } = await api.get<{ hasSavedSession: boolean }>('/apple-session');
      return data;
    },
  });

  const hasSavedSession = sessionStatus?.hasSavedSession ?? false;

  const { mutate: mutateLocations } = useMutation({
    mutationFn: async (tagId: string) => {
      const { data } = await api.post(`/tags/${tagId}/update`, {});
      return data;
    },
    onSuccess: refetchTags,
    onError: (err: any) => {
      alert('Update failed: ' + (err.response?.data?.message || err.message));
    }
  })

  const updateLocations = (tagId: string) => {
    mutateLocations(tagId);
  }

  const onCloseModal = () => {
    setShowAddModal(false);
    setGeneratedKeys(null);
  };

  const isLoading = loadingTags;

  return (
    <div className="flex h-screen flex-col overflow-hidden text-slate-200 bg-[#0f1014]">
        <Header 
          setShowAddModal={setShowAddModal}
        />

      <div className="flex-1 flex overflow-hidden h-screen">
        <Sidebar 
          loading={isLoading} 
          tags={tags || []} 
          updateLocations={updateLocations} 
        />
        <Map />
      </div>

      {showAddModal && (
        <AddTagModal
          loading={isLoading}
          onCloseModal={onCloseModal}
          fetchTags={refetchTags}
          generatedKeys={generatedKeys}
          setGeneratedKeys={setGeneratedKeys}
        />
      )}
    </div>
  );
}
