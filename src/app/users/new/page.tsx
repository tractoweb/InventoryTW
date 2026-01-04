"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import UserForm, { UserFormData } from '../../../components/forms/UserForm'; // Import the form type
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

// Generate the client inside the component or within a useEffect hook
// to ensure Amplify is configured before it's called.

const accessLevelMap: { [key: string]: number } = {
  'ADMIN': 1,
  'CAJERO': 0,
  'BODEGUERO': 2,
};

export default function NewUserPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize the client inside the component
  const client = generateClient<Schema>();

  const handleCreateUser = async (data: UserFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Map the string accessLevel to its corresponding number
      const accessLevelNumber = accessLevelMap[data.accessLevel];

      const { errors, data: newUser } = await client.models.User.create({
        ...data,
        accessLevel: accessLevelNumber, // Send the number instead of the string
      });

      if (errors) {
        throw new Error(errors.map((e) => e.message).join('\n'));
      }

      if (!newUser) {
        throw new Error('Could not create user. The operation returned no data.');
      }

      alert(`User "${newUser.username}" created successfully!`);
      router.push('/tables/User');

    } catch (e: any) {
      console.error('Error creating user:', e);
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="flex items-center">
        <h1 className="font-semibold text-lg md:text-2xl">Crear Nuevo Usuario</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Usuario</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <UserForm onSubmit={handleCreateUser} isLoading={isLoading} />
        </CardContent>
      </Card>
    </main>
  );
}
