"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { listUsers, createUser } from "@/services/user-service";
import userData from "@/lib/data/User.json";

interface UploadLog {
  userId: number;
  username: string;
  status: "nuevo" | "existente" | "error";
  message?: string;
}

export default function UploadUser() {
  const [log, setLog] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    setEmpty(false);
    const results: UploadLog[] = [];
    try {
      const existingResult = (await listUsers()) ?? { data: [] };
      const existing = Array.isArray(existingResult) ? existingResult : existingResult.data ?? [];
      const existingIds = new Set(existing.map((u: any) => u.userId));
      function toAmplifyUser(row: any) {
        return {
          userId: row.userId ?? row.UserId ?? row.Id ?? row.id,
          username: row.username ?? row.Username,
          password: row.password ?? row.Password,
          accessLevel: row.accessLevel ?? row.AccessLevel ?? 0,
          firstName: row.firstName ?? row.FirstName,
          lastName: row.lastName ?? row.LastName,
          email: row.email ?? row.Email,
          isEnabled: typeof row.isEnabled === "boolean" ? row.isEnabled : (row.IsEnabled === 1 || row.IsEnabled === true),
        };
      }
      const dataArr = Array.isArray(userData) ? userData : [];
      if (dataArr.length === 0) {
        setEmpty(true);
        setLog([]);
        setLoading(false);
        return;
      }
      for (const row of dataArr) {
    // Accedemos usando las llaves tal cual están en el JSON (PascalCase)
    const userId = row.Id;
    let usernameValue = row.Username;
    let usernameDisplay: string = (usernameValue && usernameValue !== "null") 
      ? String(usernameValue) 
      : "(sin usuario)";

    try {
      if (existingIds.has(userId)) {
        results.push({ userId, username: usernameDisplay, status: "existente", message: "Ya existe en la base" });
      } else if (usernameDisplay === "(sin usuario)") {
        results.push({ userId, username: usernameDisplay, status: "error", message: "El campo 'Username' es obligatorio" });
      } else {
        await createUser(toAmplifyUser(row));
        results.push({ userId, username: usernameDisplay, status: "nuevo" });
        existingIds.add(userId);
      }
    } catch (e: any) {
      results.push({ userId, username: usernameDisplay, status: "error", message: e.message });
    }
  }
    } catch (e: any) {
      results.push({ userId: -1, username: "-", status: "error", message: e.message });
    }
    setLog(results);
    setLoading(false);
  };

  return (
    <div className="my-6">
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir Usuarios desde User.json"}
      </Button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Registro de subida:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 border">ID</th>
                <th className="px-2 py-1 border">Usuario</th>
                <th className="px-2 py-1 border">Estado</th>
                <th className="px-2 py-1 border">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {empty || log.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-gray-500 py-2">No se han subido registros.</td></tr>
              ) : (
                log.map((item, i) => (
                  <tr key={i} className={
                    item.status === "nuevo" ? "text-green-600" :
                    item.status === "existente" ? "text-gray-500" :
                    "text-red-600"
                  }>
                    <td className="border px-2 py-1">{item.userId ?? "-"}</td>
                    <td className="border px-2 py-1">{item.username ?? "(sin usuario)"}</td>
                    <td className="border px-2 py-1">{item.status}</td>
                    <td className="border px-2 py-1">{item.message ?? ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
