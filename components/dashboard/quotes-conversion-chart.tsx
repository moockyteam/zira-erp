"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function QuotesConversionChart({ data }: { data: any }) {
  const chartData = [
    { name: "En attente", value: data.pending, fill: "#f59e0b" },
    { name: "Confirmés", value: data.confirmed, fill: "#10b981" },
    { name: "Refusés", value: data.rejected, fill: "#ef4444" },
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#8884d8" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
