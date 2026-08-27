import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ActiveBadge } from "@/components/shared/status-badge";
import { ErrorState } from "@/components/shared/states";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { writeAudit } from "@/lib/audit";
import { friendlyError } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/tedarikciler")({
  head: () => ({
    meta: [
      {
        title: "Tedarikçiler | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Tedarikçi kayıtlarını yönetin.",
      },
    ],
  }),

  component: SuppliersPage,
});

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tax_office: string | null;
  tax_number: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  payment_term_days: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type SupplierFormValues = {
  id?: string;
  code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tax_office: string | null;
  tax_number: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  payment_term_days: number;
  notes: string | null;
  is_active: boolean;
};

const db = supabase as any;

function SuppliersPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [editingSupplier, setEditingSupplier] =
    useState<SupplierRow | null>(null);

  /*
   * =====================================================
   * TEDARİKÇİLER
   * =====================================================
   */

  const suppliers = useQuery<SupplierRow[]>({
    queryKey: ["suppliers"],

    queryFn: async () => {
      const { data, error } = await db
        .from("suppliers")
        .select(`
          id,
          code,
          name,
          contact_name,
          phone,
          email,
          tax_office,
          tax_number,
          address,
          city,
          country,
          payment_term_days,
          notes,
          is_active,
          created_at
        `)
        .is("deleted_at", null)
        .order("name");

      if (error) {
        throw error;
      }

      return (data ?? []).map(
        (item: any): SupplierRow => ({
          id: item.id,
          code: item.code,
          name: item.name,
          contact_name:
            item.contact_name ?? null,
          phone:
            item.phone ?? null,
          email:
            item.email ?? null,
          tax_office:
            item.tax_office ?? null,
          tax_number:
            item.tax_number ?? null,
          address:
            item.address ?? null,
          city:
            item.city ?? null,
          country:
            item.country ?? null,
          payment_term_days:
            Number(
              item.payment_term_days ?? 0,
            ),
          notes:
            item.notes ?? null,
          is_active:
            Boolean(
              item.is_active,
            ),
          created_at:
            item.created_at,
        }),
      );
    },
  });

  /*
   * =====================================================
   * KAYDET / GÜNCELLE
   * =====================================================
   */

  const saveSupplier = useMutation({
    mutationFn: async (
      values: SupplierFormValues,
    ) => {
      const payload = {
        code:
          values.code
            .trim()
            .toUpperCase(),

        name:
          values.name.trim(),

        contact_name:
          values.contact_name?.trim() ||
          null,

        phone:
          values.phone?.trim() ||
          null,

        email:
          values.email?.trim() ||
          null,

        tax_office:
          values.tax_office?.trim() ||
          null,

        tax_number:
          values.tax_number?.trim() ||
          null,

        address:
          values.address?.trim() ||
          null,

        city:
          values.city?.trim() ||
          null,

        country:
          values.country?.trim() ||
          "Türkiye",

        payment_term_days:
          values.payment_term_days,

        notes:
          values.notes?.trim() ||
          null,

        is_active:
          values.is_active,
      };

      if (values.id) {
        const { error } = await db
          .from("suppliers")
          .update(payload)
          .eq("id", values.id);

        if (error) {
          throw error;
        }

        await writeAudit({
          action: "update",
          module: "tedarikciler",
          recordId: values.id,
          newData: payload,
          description: `${payload.name} tedarikçisi güncellendi`,
        });

        return;
      }

      const { data, error } = await db
        .from("suppliers")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "tedarikciler",
        recordId:
          String(data.id),
        newData:
          payload,
        description: `${payload.name} tedarikçisi oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success(
        "Tedarikçi kaydedildi.",
      );

      setDialogOpen(false);
      setEditingSupplier(null);

      void queryClient.invalidateQueries({
        queryKey: ["suppliers"],
      });
    },

    onError: (error) => {
      toast.error(
        friendlyError(error),
      );
    },
  });

  /*
   * =====================================================
   * SİL
   * =====================================================
   */

  const deleteSupplier = useMutation({
    mutationFn: async (
      supplier: SupplierRow,
    ) => {
      const { error } = await db
        .from("suppliers")
        .update({
          deleted_at:
            new Date().toISOString(),
          is_active: false,
        })
        .eq("id", supplier.id);

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "delete",
        module: "tedarikciler",
        recordId: supplier.id,
        description: `${supplier.name} tedarikçisi silindi`,
      });
    },

    onSuccess: () => {
      toast.success(
        "Tedarikçi silindi.",
      );

      void queryClient.invalidateQueries({
        queryKey: ["suppliers"],
      });
    },

    onError: (error) => {
      toast.error(
        friendlyError(error),
      );
    },
  });

  /*
   * =====================================================
   * TABLO
   * =====================================================
   */

  const columns: Column<SupplierRow>[] = [
    {
      id: "code",
      header: "Kod",

      cell: (row) => (
        <span className="font-mono text-sm">
          {row.code}
        </span>
      ),

      value: (row) =>
        row.code,

      sortable: true,
    },

    {
      id: "name",
      header: "Firma",

      cell: (row) => (
        <div>
          <div className="font-medium">
            {row.name}
          </div>

          {row.city ? (
            <div className="text-xs text-muted-foreground">
              {row.city}
              {row.country
                ? ` / ${row.country}`
                : ""}
            </div>
          ) : null}
        </div>
      ),

      value: (row) =>
        row.name,

      sortable: true,
    },

    {
      id: "contact",
      header: "Yetkili",

      cell: (row) =>
        row.contact_name ?? "—",

      value: (row) =>
        row.contact_name ?? "",

      sortable: true,
    },

    {
      id: "phone",
      header: "Telefon",

      cell: (row) =>
        row.phone ?? "—",

      value: (row) =>
        row.phone ?? "",
    },

    {
      id: "email",
      header: "E-posta",

      cell: (row) =>
        row.email ?? "—",

      value: (row) =>
        row.email ?? "",
    },

    {
      id: "term",
      header: "Vade",

      cell: (row) =>
        row.payment_term_days > 0
          ? `${row.payment_term_days} gün`
          : "Peşin",

      value: (row) =>
        row.payment_term_days,

      sortable: true,
    },

    {
      id: "status",
      header: "Durum",

      cell: (row) => (
        <ActiveBadge
          active={row.is_active}
        />
      ),

      value: (row) =>
        row.is_active
          ? "aktif"
          : "pasif",
    },

    {
      id: "actions",
      header: "",

      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Düzenle"
            onClick={() => {
              setEditingSupplier(row);
              setDialogOpen(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Sil"
            disabled={
              deleteSupplier.isPending
            }
            onClick={() => {
              if (
                window.confirm(
                  `${row.name} tedarikçisini silmek istediğinize emin misiniz?`,
                )
              ) {
                deleteSupplier.mutate(
                  row,
                );
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),

      className:
        "text-right",
    },
  ];

  if (suppliers.isError) {
    return (
      <>
        <PageHeader
          title="Tedarikçiler"
          description="Tedarikçi kayıtlarını yönetin."
        />

        <ErrorState
          onRetry={() => {
            void suppliers.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tedarikçiler"
        description="Satın alma süreçlerinde kullanılacak tedarikçi kayıtlarını yönetin."
      />

      <DataTable
        columns={columns}
        rows={suppliers.data ?? []}
        rowKey={(row) => row.id}
        loading={suppliers.isLoading}
        searchPlaceholder="Firma, kod, yetkili, telefon veya e-posta ara..."
        mobileTitle={(row) =>
          row.name
        }
        emptyTitle="Henüz tedarikçi yok"
        emptyDescription="İlk tedarikçinizi oluşturarak başlayın."
        toolbar={
          <Button
            onClick={() => {
              setEditingSupplier(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Yeni Tedarikçi
          </Button>
        }
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingSupplier(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier
                ? "Tedarikçiyi düzenle"
                : "Yeni tedarikçi"}
            </DialogTitle>

            <DialogDescription>
              Firma, iletişim, vergi ve ödeme bilgilerini girin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="supplier-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              const form =
                new FormData(
                  event.currentTarget,
                );

              const code =
                String(
                  form.get(
                    "code",
                  ) ?? "",
                ).trim();

              const name =
                String(
                  form.get(
                    "name",
                  ) ?? "",
                ).trim();

              const paymentTermDays =
                Number(
                  form.get(
                    "payment_term_days",
                  ) ?? 0,
                );

              if (!code) {
                toast.error(
                  "Tedarikçi kodu zorunludur.",
                );

                return;
              }

              if (!name) {
                toast.error(
                  "Firma adı zorunludur.",
                );

                return;
              }

              if (
                !Number.isInteger(
                  paymentTermDays,
                ) ||
                paymentTermDays < 0
              ) {
                toast.error(
                  "Vade günü 0 veya daha büyük tam sayı olmalıdır.",
                );

                return;
              }

              saveSupplier.mutate({
                ...(editingSupplier
                  ? {
                      id:
                        editingSupplier.id,
                    }
                  : {}),

                code,
                name,

                contact_name:
                  String(
                    form.get(
                      "contact_name",
                    ) ?? "",
                  ) || null,

                phone:
                  String(
                    form.get(
                      "phone",
                    ) ?? "",
                  ) || null,

                email:
                  String(
                    form.get(
                      "email",
                    ) ?? "",
                  ) || null,

                tax_office:
                  String(
                    form.get(
                      "tax_office",
                    ) ?? "",
                  ) || null,

                tax_number:
                  String(
                    form.get(
                      "tax_number",
                    ) ?? "",
                  ) || null,

                address:
                  String(
                    form.get(
                      "address",
                    ) ?? "",
                  ) || null,

                city:
                  String(
                    form.get(
                      "city",
                    ) ?? "",
                  ) || null,

                country:
                  String(
                    form.get(
                      "country",
                    ) ?? "",
                  ) || "Türkiye",

                payment_term_days:
                  paymentTermDays,

                notes:
                  String(
                    form.get(
                      "notes",
                    ) ?? "",
                  ) || null,

                is_active:
                  String(
                    form.get(
                      "is_active",
                    ) ?? "true",
                  ) === "true",
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="supplier-code">
                Tedarikçi Kodu
              </Label>

              <Input
                id="supplier-code"
                name="code"
                required
                placeholder="Örn. TED-001"
                defaultValue={
                  editingSupplier?.code ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Durum
              </Label>

              <Select
                name="is_active"
                defaultValue={String(
                  editingSupplier?.is_active ??
                    true,
                )}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="true">
                    Aktif
                  </SelectItem>

                  <SelectItem value="false">
                    Pasif
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-name">
                Firma Adı
              </Label>

              <Input
                id="supplier-name"
                name="name"
                required
                placeholder="Örn. ABC Metal Sanayi A.Ş."
                defaultValue={
                  editingSupplier?.name ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Yetkili Kişi
              </Label>

              <Input
                name="contact_name"
                placeholder="Ad Soyad"
                defaultValue={
                  editingSupplier?.contact_name ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Telefon
              </Label>

              <Input
                name="phone"
                placeholder="05xx xxx xx xx"
                defaultValue={
                  editingSupplier?.phone ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                E-posta
              </Label>

              <Input
                name="email"
                type="email"
                placeholder="satinalma@firma.com"
                defaultValue={
                  editingSupplier?.email ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Vade
              </Label>

              <Input
                name="payment_term_days"
                type="number"
                min="0"
                step="1"
                defaultValue={
                  editingSupplier?.payment_term_days ??
                  0
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Vergi Dairesi
              </Label>

              <Input
                name="tax_office"
                defaultValue={
                  editingSupplier?.tax_office ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Vergi Numarası
              </Label>

              <Input
                name="tax_number"
                defaultValue={
                  editingSupplier?.tax_number ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Şehir
              </Label>

              <Input
                name="city"
                placeholder="İstanbul"
                defaultValue={
                  editingSupplier?.city ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Ülke
              </Label>

              <Input
                name="country"
                defaultValue={
                  editingSupplier?.country ??
                  "Türkiye"
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>
                Adres
              </Label>

              <Textarea
                name="address"
                rows={3}
                placeholder="Firma adresi..."
                defaultValue={
                  editingSupplier?.address ??
                  ""
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>
                Notlar
              </Label>

              <Textarea
                name="notes"
                rows={3}
                placeholder="Tedarikçi hakkında not..."
                defaultValue={
                  editingSupplier?.notes ??
                  ""
                }
              />
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
              }}
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              form="supplier-form"
              disabled={
                saveSupplier.isPending
              }
            >
              <Building2 className="mr-2 size-4" />

              {saveSupplier.isPending
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}