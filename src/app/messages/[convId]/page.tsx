'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ConvPanel from '@/components/ConvPanel';
import { useAuth } from '@/context/AuthContext';

export default function ConvPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const convId = params.convId as string;
  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);
  if (loading || !user) return null;
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <ConvPanel convId={convId} />
    </div>
  );
}
