// Créez le fichier : components/dashboard/low-stock-items.tsx

"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

export function LowStockItems({ items, totalItems, itemsPerPage, currentPage }: {
    items: any[];
    totalItems: number;
    itemsPerPage: number;
    currentPage: number;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', String(newPage));
        router.push(`${pathname}?${params.toString()}`);
    }

    if (!items || items.length === 0) {
        return null;
    }

    return (
        <Card className="border-yellow-500">
            <CardHeader>
                <CardTitle className="flex items-center text-yellow-600"><Package className="h-5 w-5 mr-2"/> Articles en Stock Bas</CardTitle>
                <CardDescription>Ces articles ont une quantité inférieure à 5. Pensez à réapprovisionner.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Article</TableHead><TableHead className="text-right">Quantité Restante</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {items.map((item: any) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right font-bold text-yellow-700">{item.quantity_on_hand}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex justify-between items-center pt-4">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} sur {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <Button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>Précédent</Button>
                        <Button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}>Suivant</Button>
                    </div>
                </CardFooter>
            )}
        </Card>
    )
}