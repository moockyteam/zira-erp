"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function DeliveryNotesChart({ data }: { data: any }) {
  const chartData = [
    { name: "Brouillon", value: data.draft, fill: "#94a3b8" },
    { name: "Livrés", value: data.delivered, fill: "#10b981" },
    { name: "Annulés", value: data.cancelled, fill: "#ef4444" },
  ]

  return (
    <ResponsiveContainer width="100%" height={250}>
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
