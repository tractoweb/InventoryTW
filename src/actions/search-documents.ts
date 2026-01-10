"use server";
import { amplifyClient } from '@/lib/amplify-config';
import { unstable_noStore as noStore } from 'next/cache';
export type DocumentSearchResult = {
    id: number;
    number: string;
    customername: string | null;
};

export async function searchDocuments(searchTerm: string) {
  // Search should always be live
  noStore();
  
  if (!searchTerm) {
    return { data: [] };
  }

  try {
    // TODO: Implement document search in Amplify
    const data: DocumentSearchResult[] = [];
    return { data };
  } catch (error: any) {
    console.error('Error searching documents:', error);
    return { error: error.message || 'Error searching documents.' };
  }
}
