'use client'

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Eye, Printer } from "lucide-react"
import Image from "next/image"

// Type mis à jour pour inclure toutes les infos de l'entreprise
type FullVoucher = {
  id: string;
  reference: string | null;
  voucher_date: string;
  reason: string | null;
  companies: {
    name: string | null;
    matricule_fiscal: string | null;
    logo_url: string | null;
    address: string | null;
  } | null;
  stock_issue_voucher_lines: {
    quantity: number;
    items: { name: string | null, reference: string | null } | null;
  }[];
}

export function VoucherPreviewDialog({ voucherId }: { voucherId: string }) {
  const supabase = createClient()
  const [voucherData, setVoucherData] = useState<FullVoucher | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchVoucherData = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('stock_issue_vouchers')
      .select(`
        id, reference, voucher_date, reason,
        companies(name, matricule_fiscal, logo_url, address),
        stock_issue_voucher_lines(quantity, items(name, reference))
      `)
      .eq('id', voucherId)
      .single()
    
    if (data) setVoucherData(data as FullVoucher)
    setIsLoading(false)
  }

  const handlePrint = () => {
    window.open(`/dashboard/stock-issues/print/${voucherId}?print=true`, '_blank');
  }

  return (
    <Dialog onOpenChange={(open) => { if (open) fetchVoucherData() }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Aperçu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Aperçu du Bon de Sortie : {voucherData?.reference}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 border rounded-md">
          {isLoading && <p>Chargement...</p>}
          {voucherData && (
            <div className="font-sans text-black">
              <header className="flex justify-between items-start mb-12 border-b-2 border-black pb-4">
                <div className="flex items-center gap-4">
                  {voucherData.companies?.logo_url && (
                    <Image src={voucherData.companies.logo_url} alt="Logo" width={80} height={80} className="object-contain" />
                  )}
                  <div>
                    <h2 className="text-xl font-bold">{voucherData.companies?.name}</h2>
                    <p className="text-xs">Adresse: {voucherData.companies?.address}</p>
                    <p className="text-xs">Matricule Fiscal: {voucherData.companies?.matricule_fiscal}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-bold">Bon de Sortie</h1>
                  <p>Date : {new Date(voucherData.voucher_date).toLocaleDateString('fr-FR')}</p>
                </div>
              </header>

              <div className="mb-8">
                <p><strong>Motif :</strong> {voucherData.reason}</p>
              </div>

              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Réf. Article</th>
                    <th className="p-2 border">Désignation</th>
                    <th className="p-2 border text-right">Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherData.stock_issue_voucher_lines.map((line, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2 border">{line.items?.reference}</td>
                      <td className="p-2 border">{line.items?.name}</td>
                      <td className="p-2 border text-right">{line.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Lancer l'impression
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
