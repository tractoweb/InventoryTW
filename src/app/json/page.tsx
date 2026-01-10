"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function JsonImportPage() {
  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Importar Datos desde JSON</h1>
      <div className="flex flex-col gap-4 mb-8">
        <Link href="/json/paises">
          <Button className="w-full">Importar Países</Button>
        </Link>
        <Link href="/json/productgroups">
          <Button className="w-full">Importar Grupos de Producto</Button>
        </Link>
        <Link href="/json/currency">
          <Button className="w-full">Importar Monedas</Button>
        </Link>
        <Link href="/json/company">
          <Button className="w-full">Importar Empresas</Button>
        </Link>
        <Link href="/json/tax">
          <Button className="w-full">Importar Impuestos</Button>
        </Link>
        <Link href="/json/warehouse">
          <Button className="w-full">Importar Almacenes</Button>
        </Link>
        <Link href="/json/paymenttype">
          <Button className="w-full">Importar Tipos de Pago</Button>
        </Link>
        <Link href="/json/documenttype">
          <Button className="w-full">Importar Tipos de Documento</Button>
        </Link>
        <Link href="/json/documentcategory">
          <Button className="w-full">Importar Categorías de Documento</Button>
        </Link>
      </div>
      <div className="flex flex-col gap-4 mb-8">
        <Link href="/json/product">
          <Button className="w-full">Importar Productos</Button>
        </Link>
        <Link href="/json/barcode">
          <Button className="w-full">Importar Códigos de Barras</Button>
        </Link>
        <Link href="/json/stock">
          <Button className="w-full">Importar Stock</Button>
        </Link>
        <Link href="/json/customer">
          <Button className="w-full">Importar Clientes</Button>
        </Link>
        <Link href="/json/user">
          <Button className="w-full">Importar Usuarios</Button>
        </Link>
        <Link href="/json/counter">
          <Button className="w-full">Importar Contadores</Button>
        </Link>
        <Link href="/json/customerDiscount">
          <Button className="w-full">Importar Descuentos de Cliente</Button>
        </Link>
        <Link href="/json/producttax">
          <Button className="w-full">Importar Impuestos de Producto</Button>
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        <Link href="/json/document">
          <Button className="w-full">Importar Documentos</Button>
        </Link>
        <Link href="/json/documentitem">
          <Button className="w-full">Importar Items de Documento</Button>
        </Link>
        <Link href="/json/documentitemtax">
          <Button className="w-full">Importar Impuestos de Item Documento</Button>
        </Link>
        <Link href="/json/payment">
          <Button className="w-full">Importar Pagos</Button>
        </Link>
        <Link href="/json/stockcontrol">
          <Button className="w-full">Importar Control de Stock</Button>
        </Link>
        <Link href="/json/startingcash">
          <Button className="w-full">Importar Caja Inicial</Button>
        </Link>
        <Link href="/json/zreport">
          <Button className="w-full">Importar Z-Reports</Button>
        </Link>
        <Link href="/json/documentitempriceview">
          <Button className="w-full">Importar Precios de Item Documento</Button>
        </Link>
      </div>
    </div>
  );
}
