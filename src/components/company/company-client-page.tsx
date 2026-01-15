"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import { useToast } from "@/hooks/use-toast";

import { listCompaniesAdminAction, type CompanyAdminRow } from "@/actions/list-companies-admin";
import { upsertCompanyAction } from "@/actions/upsert-company";

export default function CompanyClientPage() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [company, setCompany] = React.useState<CompanyAdminRow | null>(null);

  const [name, setName] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [city, setCity] = React.useState("");
  const [countryId, setCountryId] = React.useState<string>("");
  const [bankAccountNumber, setBankAccountNumber] = React.useState("");
  const [bankDetails, setBankDetails] = React.useState("");
  const [logo, setLogo] = React.useState("");

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const res = await listCompaniesAdminAction();
      if (res.error) throw new Error(res.error);

      const first = (res.data ?? [])[0] ?? null;
      setCompany(first);

      setName(first?.name ?? "");
      setTaxNumber(first?.taxNumber ?? "");
      setEmail(first?.email ?? "");
      setPhoneNumber(first?.phoneNumber ?? "");
      setAddress(first?.address ?? "");
      setPostalCode(first?.postalCode ?? "");
      setCity(first?.city ?? "");
      setCountryId(first?.countryId ? String(first.countryId) : "");
      setBankAccountNumber(first?.bankAccountNumber ?? "");
      setBankDetails(first?.bankDetails ?? "");
      setLogo(first?.logo ?? "");
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar datos de empresa");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      if (!name.trim()) throw new Error("Nombre requerido");

      const res = await upsertCompanyAction({
        idCompany: company?.idCompany,
        name,
        taxNumber: taxNumber ? taxNumber : undefined,
        email: email ? email : undefined,
        phoneNumber: phoneNumber ? phoneNumber : undefined,
        address: address ? address : undefined,
        postalCode: postalCode ? postalCode : undefined,
        city: city ? city : undefined,
        countryId: countryId ? Number(countryId) : undefined,
        bankAccountNumber: bankAccountNumber ? bankAccountNumber : undefined,
        bankDetails: bankDetails ? bankDetails : undefined,
        logo: logo ? logo : undefined,
      });

      if (!res.success) throw new Error(res.error || "No se pudo guardar");

      toast({ title: "Empresa guardada" });
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi empresa</h1>
          <p className="text-muted-foreground">Datos del registro Company (para reportes, documentos y configuración).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading || saving}>
            Refrescar
          </Button>
          <Button onClick={save} disabled={loading || saving || !name.trim()}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Cargando…</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-8 w-1/3" />
          </CardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Empresa</CardTitle>
            <CardDescription>
              {company ? `ID: ${company.idCompany}` : "No existe empresa aún. Puedes crearla guardando este formulario."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>NIT / Tax number</Label>
                <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} disabled={saving} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={saving} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2 md:col-span-2">
                <Label>Dirección</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={saving} />
              </div>
              <div className="grid gap-2">
                <Label>Código postal</Label>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} disabled={saving} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Ciudad</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} disabled={saving} />
              </div>
              <div className="grid gap-2">
                <Label>countryId</Label>
                <Input type="number" value={countryId} onChange={(e) => setCountryId(e.target.value)} disabled={saving} placeholder="(opcional)" />
              </div>
              <div className="grid gap-2">
                <Label>Logo (URL/base64)</Label>
                <Input value={logo} onChange={(e) => setLogo(e.target.value)} disabled={saving} placeholder="(opcional)" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Cuenta bancaria</Label>
                <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} disabled={saving} />
              </div>
              <div className="grid gap-2">
                <Label>Detalles bancarios</Label>
                <Input value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} disabled={saving} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button asChild variant="outline">
          <a href="/json/company">Importar empresa (JSON)</a>
        </Button>
      </div>
    </div>
  );
}
