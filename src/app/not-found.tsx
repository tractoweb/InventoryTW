import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">
        La ruta que intentaste abrir no existe o fue movida.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
