import { getProductGroups } from "@/actions/get-product-groups";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { getWarehouses } from "@/actions/get-warehouses";
import { getTaxes } from "@/actions/get-taxes";
import { ProductsMasterClient } from "./components/products-master-client";
import { requireSession } from "@/lib/session";
import { ACCESS_LEVELS } from "@/lib/amplify-config";


export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  await requireSession(ACCESS_LEVELS.CASHIER);
  const { data: productGroups, error: groupsError } = await getProductGroups();
  const { data: warehouses, error: warehousesError } = await getWarehouses();
  const { data: taxes, error: taxesError } = await getTaxes();
  
  const error = groupsError || warehousesError || taxesError;

  return (
    <div className="flex flex-col gap-8 min-w-0">
       <h1 className="text-3xl font-bold tracking-tight">Maestro de Productos</h1>
        {error && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error al Cargar Datos</AlertTitle>
                <AlertDescription>
                    {error}
                </AlertDescription>
            </Alert>
        )}
      <ProductsMasterClient
        productGroups={productGroups || []}
        warehouses={warehouses || []}
        taxes={taxes || []}
        initialQuery={Array.isArray(searchParams?.q) ? searchParams?.q?.[0] : (searchParams?.q as string | undefined)}
        initialGroupId={(() => {
          const raw = Array.isArray(searchParams?.groupId) ? searchParams?.groupId?.[0] : (searchParams?.groupId as string | undefined);
          const n = raw ? Number(raw) : null;
          return n && Number.isFinite(n) ? n : null;
        })()}
      />
    </div>
  );
}
