// components/dashboard-manager.tsx

"use client"

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
// import { CompanySelector } from "@/components/company-selector"; // REMOVE
import { useCompany } from "@/components/providers/company-provider"; // ADD
import { DashboardClient } from "@/components/dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

const dateRanges = [
  { label: "Ce mois-ci", value: "this_month" },
  { label: "Cette semaine", value: "this_week" },
  { label: "Ce trimestre", value: "this_quarter" },
  { label: "Cette année", value: "this_year" },
];

export function DashboardManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient();
  const { selectedCompany } = useCompany(); // ADD

  // const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null); // REMOVE
  const selectedCompanyId = selectedCompany?.id;
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");

  // REMOVE Sync effect
  /*
  useEffect(() => {
    if (userCompanies && userCompanies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id);
    }
  }, [userCompanies, selectedCompanyId]);
  */

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!selectedCompanyId) return;
      setIsLoading(true);

      const today = new Date();
      let startDate, endDate;

      switch (period) {
        case 'this_week':
          startDate = startOfWeek(today);
          endDate = endOfWeek(today);
          break;
        case 'this_quarter':
          startDate = startOfQuarter(today);
          endDate = endOfQuarter(today);
          break;
        case 'this_year':
          startDate = startOfYear(today);
          endDate = endOfYear(today);
          break;
        default: // this_month
          startDate = startOfMonth(today);
          endDate = endOfMonth(today);
      }

      const { data, error } = await supabase.rpc('get_dashboard_analytics', {
        p_company_id: selectedCompanyId,
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd'),
      });

      if (error) console.error("Erreur RPC Dashboard:", error);
      setDashboardData(data);
      setIsLoading(false);
    };

    fetchDashboardData();
  }, [selectedCompanyId, period, supabase]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          {/* <CompanySelector ... /> */}
        </div>
        <div className="w-full md:w-48">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {dateRanges.map(range => <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <DashboardClient data={dashboardData} />
      )}
    </div>
  );
}
