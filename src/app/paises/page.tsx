import React from 'react';
import dynamic from 'next/dynamic';

const UploadCountry = dynamic(() => import('./upload-country'), { ssr: false });

export default function PaisesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Países</h1>
      <p className="text-gray-600 mb-4">Aquí podrás gestionar los países registrados en el sistema.</p>
      <UploadCountry />
    </div>
  );
}
