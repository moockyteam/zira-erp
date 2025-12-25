"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil, Clock, Calendar, Box, RefreshCcw, Trash2 } from "lucide-react"
import { Service } from "./service-manager"
import { Skeleton } from "@/components/ui/skeleton"

interface ServiceListProps {
    services: Service[]
    isLoading: boolean
    onEdit: (service: Service) => void
    onDelete: (serviceId: string) => Promise<void>
}

const BILLING_TYPE_LABELS = {
    'fixed': { label: 'Forfait', icon: Box, color: 'bg-blue-100 text-blue-800' },
    'hourly': { label: 'Heure', icon: Clock, color: 'bg-green-100 text-green-800' },
    'daily': { label: 'Jour', icon: Calendar, color: 'bg-purple-100 text-purple-800' },
    'subscription': { label: 'Abo.', icon: RefreshCcw, color: 'bg-orange-100 text-orange-800' }
}

export function ServiceList({ services, isLoading, onEdit, onDelete }: ServiceListProps) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDeleteClick = (e: React.MouseEvent, service: Service) => {
        e.stopPropagation()
        setServiceToDelete(service)
        setDeleteDialogOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!serviceToDelete) return
        setIsDeleting(true)
        await onDelete(serviceToDelete.id)
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        setServiceToDelete(null)
    }

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
        )
    }

    if (services.length === 0) {
        return (
            <div className="text-center p-12 border rounded-lg bg-slate-50 dark:bg-slate-900 border-dashed">
                <p className="text-muted-foreground">Aucun service trouvé. Créez votre premier service pour commencer.</p>
            </div>
        )
    }

    return (
        <>
            <div className="border rounded-md bg-white dark:bg-slate-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nom / Référence</TableHead>
                            <TableHead>Type de Facturation</TableHead>
                            <TableHead>Prix de Vente</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {services.map((service) => {
                            const billingInfo = BILLING_TYPE_LABELS[service.billing_type] || BILLING_TYPE_LABELS['fixed'];
                            const TypeIcon = billingInfo.icon;

                            return (
                                <TableRow key={service.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50" onClick={() => onEdit(service)}>
                                    <TableCell>
                                        <div className="font-medium">{service.name}</div>
                                        <div className="text-xs text-muted-foreground">{service.sku || '-'}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${billingInfo.color}`}>
                                            <TypeIcon className="w-3 h-3 mr-1" />
                                            {billingInfo.label}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-bold">
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: service.currency || 'EUR' }).format(service.price || 0)}
                                        </span>
                                        {service.billing_type === 'hourly' && <span className="text-xs text-muted-foreground ml-1">/h</span>}
                                        {service.billing_type === 'daily' && <span className="text-xs text-muted-foreground ml-1">/j</span>}
                                        {service.billing_type === 'subscription' && (
                                            <span className="text-xs text-muted-foreground ml-1">
                                                {service.unit === 'Year' ? '/an' : '/mois'}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={service.status === 'active' ? 'default' : 'secondary'}>
                                            {service.status === 'active' ? 'Actif' : 'Archivé'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit(service);
                                            }}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={(e) => handleDeleteClick(e, service)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce service ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer le service <strong>"{serviceToDelete?.name}"</strong> ?
                            Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Suppression..." : "Supprimer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
