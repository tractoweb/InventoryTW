import { DocumentsBrowser } from "./components/documents-browser";

export default function DocumentsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const raw = searchParams?.documentId;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const initialDocumentId = value ? Number(value) : null;

  return <DocumentsBrowser initialDocumentId={Number.isFinite(initialDocumentId) ? initialDocumentId : null} />;
}
