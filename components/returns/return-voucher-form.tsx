"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PlusCircle, Trash2, Loader2, AlertCircle, User, Calendar, FileText, Truck, Package } from "lucide-react"

type ReturnLine = { local_id: string; item_id: string; quantity: string; reason: string }

export function ReturnVoucherForm({
  companyId,
  customers,
  items,
}: { companyId: string; customers: any[]; items: any[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [customerId, setCustomerId] = useState("")
  const [returnDate, setReturnDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [sourceDocRef, setSourceDocRef] = useState("")
  const [driverName, setDriverName] = useState("")
  const [vehicleReg, setVehicleReg] = useState("")
  const [lines, setLines] = useState<ReturnLine[]>([
    { local_id: crypto.randomUUID(), item_id: "", quantity: "1", reason: "" },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId)
  }, [customerId, customers])

  const addLine = () => setLines([...lines, { local_id: crypto.randomUUID(), item_id: "", quantity: "1", reason: "" }])
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index))
  const updateLine = (index: number, field: keyof ReturnLine, value: string) => {
    const newLines = [...lines]
    newLines[index][field] = value
    setLines(newLines)
  }

  const handleSave = async () => {
    if (!customerId || lines.some((l) => !l.item_id || !l.quantity)) {
      setError("Client et articles sont obligatoires.")
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const prefix = `BR-${new Date().getFullYear()}-`
      const { data: lastReturn } = await supabase
        .from("return_vouchers")
        .select("return_voucher_number")
        .eq("company_id", companyId)
        .like("return_voucher_number", `${prefix}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      let nextNum = 1
      if (lastReturn) {
        nextNum = Number.parseInt(lastReturn.return_voucher_number.split("-").pop() || "0") + 1
      }
      const newVoucherNumber = `${prefix}${String(nextNum).padStart(3, "0")}`

      const { data: newReturn, error: returnError } = await supabase
        .from("return_vouchers")
        .insert({
          company_id: companyId,
          customer_id: customerId,
          return_voucher_number: newVoucherNumber,
          return_date: returnDate,
          source_document_ref: sourceDocRef,
          driver_name: driverName,
          vehicle_registration: vehicleReg,
        })
        .select("id")
        .single()

      if (returnError) throw returnError

      const linesPayload = lines.map((line) => ({
        return_voucher_id: newReturn.id,
        item_id: line.item_id,
        quantity: Number.parseFloat(line.quantity),
        reason: line.reason,
      }))

      const { error: linesError } = await supabase.from("return_voucher_lines").insert(linesPayload)
      if (linesError) throw linesError

      router.push("/dashboard/returns")
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-indigo-500 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-b-2">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-600" />
            <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Informations Générales
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-semibold">
                <User className="h-4 w-4 text-indigo-500" />
                Client *
              </Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="border-2 focus:border-indigo-500 focus:ring-indigo-500">
                  <SelectValue placeholder="Sélectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-semibold">
                <Calendar className="h-4 w-4 text-indigo-500" />
                Date du Retour *
              </Label>
              <Input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="border-2 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          {selectedCustomer && (
            <div className="mt-4 p-4 border-2 border-indigo-200 rounded-lg bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 text-sm space-y-2">
              <p className="flex items-start gap-2">
                <span className="font-semibold text-indigo-700 dark:text-indigo-400 min-w-[120px]">Adresse:</span>
                <span className="text-foreground">{selectedCustomer.address || "N/A"}</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-semibold text-indigo-700 dark:text-indigo-400 min-w-[120px]">Téléphone:</span>
                <span className="text-foreground">{selectedCustomer.phone_number || "N/A"}</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-semibold text-indigo-700 dark:text-indigo-400 min-w-[120px]">
                  Matricule Fiscal:
                </span>
                <span className="text-foreground">{selectedCustomer.matricule_fiscal || "N/A"}</span>
              </p>
            </div>
          )}

          <div className="space-y-2 pt-4">
            <Label className="flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4 text-indigo-500" />
              Référence Facture / BL d'origine (Optionnel)
            </Label>
            <Input
              value={sourceDocRef}
              onChange={(e) => setSourceDocRef(e.target.value)}
              className="border-2 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Ex: FAC-2024-001"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-orange-500 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-orange-500/10 via-red-500/10 to-pink-500/10 border-b-2">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-600" />
            <CardTitle className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              Articles Retournés
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 px-2 py-2 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 rounded-lg border-2 border-orange-200">
              <div className="col-span-5 text-sm font-semibold text-orange-700 dark:text-orange-400">Article</div>
              <div className="col-span-2 text-sm font-semibold text-orange-700 dark:text-orange-400">Quantité</div>
              <div className="col-span-4 text-sm font-semibold text-orange-700 dark:text-orange-400">
                Raison du retour
              </div>
              <div className="col-span-1 text-sm font-semibold text-orange-700 dark:text-orange-400">Action</div>
            </div>

            {lines.map((line, index) => (
              <div
                key={line.local_id}
                className="grid grid-cols-12 gap-2 items-center p-2 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 rounded-lg transition-colors border-2 border-transparent hover:border-orange-200"
              >
                <div className="col-span-5">
                  <Select value={line.item_id} onValueChange={(v) => updateLine(index, "item_id", v)}>
                    <SelectTrigger className="border-2 focus:border-orange-500">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, "quantity", e.target.value)}
                    className="border-2 focus:border-orange-500"
                    min="1"
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    value={line.reason}
                    onChange={(e) => updateLine(index, "reason", e.target.value)}
                    placeholder="Ex: Défectueux, Erreur..."
                    className="border-2 focus:border-orange-500"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(index)}
                    className="hover:bg-red-100 dark:hover:bg-red-950/30"
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addLine}
            className="mt-4 border-2 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20 bg-transparent"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Ajouter un article
          </Button>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-500 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 border-b-2">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <CardTitle className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Informations de Transport
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="font-semibold">Chauffeur</Label>
              <Input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="border-2 focus:border-blue-500"
                placeholder="Nom du chauffeur"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Immatriculation Véhicule</Label>
              <Input
                value={vehicleReg}
                onChange={(e) => setVehicleReg(e.target.value)}
                className="border-2 focus:border-blue-500"
                placeholder="Ex: 123 TU 4567"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSave}
          disabled={isLoading}
          size="lg"
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              <Package className="h-4 w-4 mr-2" />
              Enregistrer le Bon de Retour
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
