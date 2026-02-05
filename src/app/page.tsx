'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Map } from '@/components/Map';
import { Sidebar } from '@/components/Sidebar';
import { AddTagModal } from '@/components/AddTagModal';
import { Tag } from '@/types';
import api from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

// Dynamically import Map component to avoid SSR issues with Leaflet
const MapWithNoSSR = dynamic(() => import('@/components/Map').then(mod => mod.Map), {
  ssr: false,
});

export default function Home() {
  const [password, setPassword] = useState('');
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

  const { mutate: mutateLocations } = useMutation({
    mutationFn: async (tagId: string) => {
      const { data } = await api.post(`/tags/${tagId}/update`, { password });
      return data;
    },
    onSuccess: refetchTags,
    onError: (err: any) => {
      alert('Update failed: ' + (err.response?.data?.message || err.message));
    }
  })

  const updateLocations = (tagId: string) => {
    if (!password) {
      alert('Please enter your Find My password to update locations');
      return;
    }

    mutateLocations(tagId);
  }

  const onCloseModal = () => {
    setShowAddModal(false);
    setGeneratedKeys(null);
  };

  const isLoading = loadingTags;

  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-200 bg-[#0f1014]">
      <Header 
        password={password}
        setPassword={setPassword}
        setShowAddModal={setShowAddModal}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          loading={isLoading} 
          tags={tags || []} 
          updateLocations={updateLocations} 
        />
        <MapWithNoSSR tags={tags || []} />
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
