import { redirect } from 'next/navigation';
import { getDocumentDetails } from '@/actions/get-document-details';
import { NewDocumentForm } from '@/app/documents/new/components/new-document-form';

interface PageProps {
  params: Promise<{ documentId: string }>;
}

export default async function EditDocumentPage(props: PageProps) {
  const params = await props.params;
  const documentId = Number(params.documentId);

  if (!Number.isFinite(documentId) || documentId <= 0) {
    redirect('/documents');
  }

  const docRes = await getDocumentDetails(documentId);

  if (docRes?.error || !docRes?.data) {
    redirect('/documents');
  }

  const doc = docRes.data;

  return <NewDocumentForm mode="edit" documentToEdit={doc} />;
}
