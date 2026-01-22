"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { createDocument, listDocuments } from "@/services/document-crud-service";
import documentData from "@/lib/data/Document.json";

interface UploadLog {
	documentId: number;
	number: string;
	status: "nuevo" | "existente" | "error";
	message?: string;
}

function toInt(value: any): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function toFloat(value: any): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function toBool(value: any): boolean {
	return value === true || value === 1 || value === "1" || value === "true";
}

function toDateOnly(value: any): string | undefined {
	if (!value) return undefined;
	if (typeof value === "string") {
		const trimmed = value.trim();
		const datePart = trimmed.split(" ")[0];
		if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
	}
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return undefined;
	return d.toISOString().slice(0, 10);
}

function toDateTimeISO(value: any): string | undefined {
	if (!value) return undefined;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") {
		const trimmed = value.trim();
		const [datePart, rawTimePart] = trimmed.split(" ");
		if (datePart && rawTimePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
			const [hhmmss, fraction = ""] = rawTimePart.split(".");
			const ms = fraction ? String(fraction).padEnd(3, "0").slice(0, 3) : "000";
			const isoCandidate = `${datePart}T${hhmmss}.${ms}`;
			const d = new Date(isoCandidate);
			if (!Number.isNaN(d.getTime())) return d.toISOString();
		}
	}
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return undefined;
	return d.toISOString();
}

export default function UploadDocument() {
	const [log, setLog] = useState<UploadLog[]>([]);
	const [loading, setLoading] = useState(false);

	const handleUpload = async () => {
		setLoading(true);
		const results: UploadLog[] = [];

		try {
			const existingResult = (await listDocuments()) ?? { data: [] };
			const existing = Array.isArray(existingResult)
				? existingResult
				: (existingResult as any).data ?? [];

			const existingIds = new Set(existing.map((d: any) => Number(d.documentId)));
			const seenInJson = new Set<number>();

			for (const row of (documentData ?? []) as any[]) {
				const documentId = toInt(row.documentId ?? row.DocumentId ?? row.Id);
				const number = String(row.number ?? row.Number ?? "").trim();

				if (!documentId || !number) {
					results.push({
						documentId: documentId ?? -1,
						number: number || "-",
						status: "error",
						message: "documentId y number son obligatorios",
					});
					continue;
				}

				if (seenInJson.has(documentId)) {
					results.push({
						documentId,
						number,
						status: "existente",
						message: "Duplicado en Document.json (mismo documentId)",
					});
					continue;
				}
				seenInJson.add(documentId);

				if (existingIds.has(documentId)) {
					results.push({ documentId, number, status: "existente", message: "Ya existe en la base" });
					continue;
				}

				const userId = toInt(row.userId ?? row.UserId) ?? 1;
				const documentTypeId = toInt(row.documentTypeId ?? row.DocumentTypeId) ?? 1;
				const warehouseId = toInt(row.warehouseId ?? row.WarehouseId) ?? 1;
				const total = toFloat(row.total ?? row.Total);
				const date = toDateOnly(row.date ?? row.Date);
				const stockDate =
					toDateTimeISO(row.stockDate ?? row.StockDate) ??
					toDateTimeISO(row.dateCreated ?? row.DateCreated) ??
					(date ? toDateTimeISO(`${date} 00:00:00`) : undefined);

				if (!date || !stockDate || total === null) {
					results.push({
						documentId,
						number,
						status: "error",
						message: "date (YYYY-MM-DD), stockDate (datetime) y total son obligatorios",
					});
					continue;
				}

				const customerId = toInt(row.customerId ?? row.CustomerId);
				const clientId = toInt(row.clientId ?? row.ClientId ?? row.idClient ?? row.IdClient);
				const clientNameSnapshot =
					typeof (row.clientNameSnapshot ?? row.ClientNameSnapshot ?? row.clientName ?? row.ClientName) === "string"
						? String(row.clientNameSnapshot ?? row.ClientNameSnapshot ?? row.clientName ?? row.ClientName).trim()
						: undefined;
				const idempotencyKey =
					typeof (row.idempotencyKey ?? row.IdempotencyKey) === "string"
						? String(row.idempotencyKey ?? row.IdempotencyKey).trim()
						: undefined;
				const dueDate = toDateOnly(row.dueDate ?? row.DueDate);

				try {
					await createDocument({
						documentId,
						number,
						userId,
						customerId: customerId ?? undefined,
						clientId: clientId ?? undefined,
						clientNameSnapshot: clientNameSnapshot || undefined,
						orderNumber: row.orderNumber ?? row.OrderNumber ?? undefined,
						date,
						stockDate,
						total,
						isClockedOut: toBool(row.isClockedOut ?? row.IsClockedOut),
						documentTypeId,
						warehouseId,
						idempotencyKey: idempotencyKey || undefined,
						referenceDocumentNumber:
							row.referenceDocumentNumber ?? row.ReferenceDocumentNumber ?? undefined,
						internalNote: row.internalNote ?? row.InternalNote ?? undefined,
						note: row.note ?? row.Note ?? undefined,
						dueDate: dueDate ?? undefined,
						discount: toFloat(row.discount ?? row.Discount) ?? 0,
						discountType: toInt(row.discountType ?? row.DiscountType) ?? 0,
						paidStatus: toInt(row.paidStatus ?? row.PaidStatus) ?? 0,
						discountApplyRule: toInt(row.discountApplyRule ?? row.DiscountApplyRule) ?? 0,
						serviceType: toInt(row.serviceType ?? row.ServiceType) ?? 0,
					});
					results.push({ documentId, number, status: "nuevo" });
					existingIds.add(documentId);
				} catch (e: any) {
					results.push({ documentId, number, status: "error", message: e.message });
				}
			}
		} catch (e: any) {
			results.push({ documentId: -1, number: "-", status: "error", message: e.message });
		}

		setLog(results);
		setLoading(false);
	};

	return (
		<div className="my-6">
			<Button onClick={handleUpload} disabled={loading}>
				{loading ? "Subiendo..." : "Subir Documentos desde Document.json"}
			</Button>
			<div className="mt-6">
				<h2 className="font-semibold mb-2">Registro de subida:</h2>
				<div className="overflow-x-auto">
					<table className="min-w-full text-sm border border-gray-200">
						<thead>
							<tr className="bg-gray-100">
								<th className="px-2 py-1 border">ID</th>
								<th className="px-2 py-1 border">Número</th>
								<th className="px-2 py-1 border">Estado</th>
								<th className="px-2 py-1 border">Mensaje</th>
							</tr>
						</thead>
						<tbody>
							{log.length === 0 ? (
								<tr>
									<td colSpan={4} className="text-center text-gray-500 py-2">
										No se han subido registros.
									</td>
								</tr>
							) : (
								log.map((item, i) => (
									<tr
										key={i}
										className={
											item.status === "nuevo"
												? "text-green-600"
												: item.status === "existente"
												? "text-gray-500"
												: "text-red-600"
										}
									>
										<td className="border px-2 py-1">{item.documentId ?? "-"}</td>
										<td className="border px-2 py-1">{item.number ?? "-"}</td>
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
