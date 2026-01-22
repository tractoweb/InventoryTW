"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import { buildPaymentReminderDraftAction, type PaymentReminderDraft } from "@/actions/build-payment-reminder-draft";
import { sendPaymentReminderCustomAction } from "@/actions/send-payment-reminder-custom";
import { useToast } from "@/hooks/use-toast";

export type PaymentReminderDoc = {
  documentId: number;
  number?: string;
  pendingApprox?: number;
  dueDate?: string | null;
  daysOverdue?: number;
};

export type PaymentReminderDialogInput = {
  kind: "client" | "supplier";
  partyName: string;
  to: string;
  docs: PaymentReminderDoc[];
};

export function PaymentReminderDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: PaymentReminderDialogInput | null;
}) {
  const { toast } = useToast();

  const [loading, startTransition] = React.useTransition();

  const [draft, setDraft] = React.useState<PaymentReminderDraft | null>(null);
  const [draftError, setDraftError] = React.useState<string | null>(null);

  const [cc, setCc] = React.useState<string>("");
  const [subject, setSubject] = React.useState<string>("");
  const [text, setText] = React.useState<string>("");

  const [selectedDocIds, setSelectedDocIds] = React.useState<number[]>([]);
  const [confirm, setConfirm] = React.useState(false);

  const maxAttachments = 3;

  const canSend = Boolean(draft?.configured) && Boolean(props.input?.to?.trim()) && subject.trim().length > 0 && text.trim().length > 0;

  const isDraftLoading = props.open && Boolean(props.input) && !draft && !draftError;

  React.useEffect(() => {
    if (!props.open) return;
    if (!props.input) return;

    setDraft(null);
    setDraftError(null);
    setConfirm(false);

    startTransition(async () => {
      try {
        const res = await buildPaymentReminderDraftAction({
          kind: props.input!.kind,
          to: props.input!.to,
          partyName: props.input!.partyName,
          docs: props.input!.docs,
        });

        if (!res?.success) throw new Error(res?.error ?? "No se pudo preparar el borrador");

        setDraft(res.data);
        setCc(String(res.data.defaultCc ?? ""));
        setSubject(res.data.subject);
        setText(res.data.text);
        setSelectedDocIds(res.data.attachments.filter((a) => a.defaultSelected).map((a) => a.documentId));
      } catch (e: any) {
        setDraftError(e?.message ?? "No se pudo preparar el borrador");
      }
    });
  }, [props.open, props.input]);

  async function onSend() {
    if (!props.input) return;
    if (!canSend) return;
    if (!confirm) {
      toast({ variant: "destructive", title: "Confirmación", description: "Debes confirmar antes de enviar." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await sendPaymentReminderCustomAction({
          kind: props.input!.kind,
          to: props.input!.to,
          cc: cc.trim() ? cc.trim() : null,
          subject: subject.trim(),
          text: text,
          attachDocIds: selectedDocIds.slice(0, maxAttachments),
        });
        if (!res?.success) throw new Error(res?.error ?? "No se pudo enviar el email");

        toast({ title: "Email enviado", description: `Se envió a ${props.input!.to}.` });
        props.onOpenChange(false);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo enviar" });
      }
    });
  }

  function toggleDoc(documentId: number, checked: boolean) {
    setSelectedDocIds((prev) => {
      const set = new Set(prev);
      if (checked) {
        if (set.size >= maxAttachments) return Array.from(set);
        set.add(documentId);
      } else {
        set.delete(documentId);
      }
      return Array.from(set);
    });
  }

  const attachmentCount = selectedDocIds.length;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        props.onOpenChange(next);
        if (!next) {
          setDraft(null);
          setDraftError(null);
          setConfirm(false);
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar recordatorio</DialogTitle>
          <DialogDescription>Revisa y confirma antes de enviar. Máximo {maxAttachments} PDFs adjuntos.</DialogDescription>
        </DialogHeader>

        {draftError ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{draftError}</AlertDescription>
          </Alert>
        ) : null}

        {isDraftLoading ? (
          <Alert>
            <AlertTitle>Preparando email…</AlertTitle>
            <AlertDescription>Construyendo borrador y verificando configuración SMTP.</AlertDescription>
          </Alert>
        ) : null}

        {draft && !draft.configured ? (
          <Alert variant="destructive">
            <AlertTitle>Email no configurado</AlertTitle>
            <AlertDescription>
              Falta configurar SMTP en el servidor.
              {Array.isArray(draft.missing) && draft.missing.length > 0 ? (
                <>
                  {" "}Faltan: <span className="font-mono">{draft.missing.join(", ")}</span>.
                </>
              ) : (
                <> (por lo menos `SMTP_HOST` y `SMTP_FROM`).</>
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>From</Label>
              <Input value={String(draft?.from ?? "")} readOnly placeholder="SMTP_FROM" />
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              <Input value={String(props.input?.to ?? "")} readOnly />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>CC</Label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="grid gap-1.5">
            <Label>Asunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>Mensaje</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[180px]" />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium">Adjuntos ({attachmentCount}/{maxAttachments})</div>
            <div className="rounded-md border">
              <div className="max-h-[180px] overflow-auto p-2 grid gap-2">
                {(draft?.attachments ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin adjuntos sugeridos.</div>
                ) : (
                  (draft?.attachments ?? []).map((a) => {
                    const checked = selectedDocIds.includes(a.documentId);
                    const disabled = !checked && selectedDocIds.length >= maxAttachments;
                    return (
                      <label key={a.documentId} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(v) => toggleDoc(a.documentId, Boolean(v))}
                        />
                        <span className={disabled ? "text-muted-foreground" : ""}>{a.label}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            {selectedDocIds.length >= maxAttachments ? (
              <div className="text-xs text-muted-foreground">Límite alcanzado: desmarca uno para elegir otro.</div>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(Boolean(v))} />
            Confirmo que la información es correcta.
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSend} disabled={loading || !canSend || !confirm}>
            {loading ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
