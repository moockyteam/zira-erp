"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const COLORS = {
  draft: "#94a3b8",
  sent: "#3b82f6",
  paid: "#10b981",
  partial: "#f59e0b",
  cancelled: "#ef4444",
}

export function InvoicesStatusChart({ data }: { data: any }) {
  const chartData = [
    { name: "Brouillon", value: data.draft, color: COLORS.draft },
    { name: "Envoyées", value: data.sent, color: COLORS.sent },
    { name: "Payées", value: data.paid, color: COLORS.paid },
    { name: "Partielles", value: data.partial, color: COLORS.partial },
    { name: "Annulées", value: data.cancelled, color: COLORS.cancelled },
  ].filter((item) => item.value > 0)

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Aucune facture pour cette période</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
            <div>
              <div className="text-sm font-medium">{item.name}</div>
              <div className="text-lg font-bold">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
