import { useState } from "react"
import {
  TrendingUpIcon,
  TrendingDownIcon,
  WalletIcon,
  BarChart3Icon,
  DownloadIcon,
  FileDownIcon,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ErrorState } from "@/components/common/ErrorState"
import { EmptyState } from "@/components/common/EmptyState"
import { useDashboardSummary } from "@/features/dashboard/api"
import {
  downloadTransactionsCsv,
  downloadSummaryCsv,
} from "@/features/exports/api"
import { formatTHB } from "@/lib/format"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { textSuccess, textDanger, CHART_COLORS } from "@/lib/colors"

// ── Thai month labels (Buddhist year) ──────────────────────────────────────

const thaiShortMonths = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
]

function formatMonthLabel(year: number, month: number): string {
  const buddhistYear = year + 543
  return `${thaiShortMonths[month - 1]} ${buddhistYear}`
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [categoryType, setCategoryType] = useState<"income" | "expense">(
    "expense",
  )
  const { data, isLoading, isError, error, refetch } =
    useDashboardSummary(categoryType)

  // ── Loading state ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (isError) {
    return (
      <ErrorState
        title="โหลดข้อมูลแดชบอร์ดไม่สำเร็จ"
        message={error?.message ?? "กรุณาลองใหม่อีกครั้ง"}
        onRetry={() => refetch()}
      />
    )
  }

  // ── No data state ──────────────────────────────────────────────────────

  if (!data) {
    return (
      <EmptyState
        title="ไม่มีข้อมูล"
        description="ยังไม่มีข้อมูลรายการในเดือนนี้"
        icon={BarChart3Icon}
      />
    )
  }

  const { currentMonth, last6Months, byCategory } = data

  // ── Prepare chart data ─────────────────────────────────────────────────

  const lineChartData = last6Months.map((m) => ({
    label: formatMonthLabel(m.year, m.month),
    income: Number.parseFloat(m.income),
    expense: Number.parseFloat(m.expense),
  }))

  const barChartData = byCategory.map((c) => ({
    name: c.name,
    total: Number.parseFloat(c.total),
    count: c.count,
  }))

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline">
                <DownloadIcon className="mr-2 size-4" />
                ส่งออก
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                toast.promise(downloadSummaryCsv(), {
                  loading: "กำลังส่งออกรายงานสรุป...",
                  success: "ส่งออกรายงานสรุปสำเร็จ",
                  error: "ส่งออกรายงานสรุปไม่สำเร็จ",
                })
              }}
            >
              <BarChart3Icon className="mr-2 size-4" />
              ส่งออกรายงานสรุป (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                toast.promise(downloadTransactionsCsv({}), {
                  loading: "กำลังส่งออกรายการ...",
                  success: "ส่งออกรายการสำเร็จ",
                  error: "ส่งออกรายการไม่สำเร็จ",
                })
              }}
            >
              <FileDownIcon className="mr-2 size-4" />
              ส่งออกรายการ (CSV)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Income card */}
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2 text-sm font-medium", textSuccess)}>
              <TrendingUpIcon className="size-4" />
              รายรับ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-2xl font-bold">
              {formatTHB(currentMonth.income)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatMonthLabel(currentMonth.year, currentMonth.month)}
            </p>
          </CardContent>
        </Card>

        {/* Expense card */}
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2 text-sm font-medium", textDanger)}>
              <TrendingDownIcon className="size-4" />
              รายจ่าย
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-2xl font-bold">
              {formatTHB(currentMonth.expense)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatMonthLabel(currentMonth.year, currentMonth.month)}
            </p>
          </CardContent>
        </Card>

        {/* Balance card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-blue-600">
              <WalletIcon className="size-4" />
              คงเหลือ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-bold",
                Number.parseFloat(currentMonth.balance) >= 0
                  ? textSuccess
                  : textDanger,
              )}
            >
              {formatTHB(currentMonth.balance)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatMonthLabel(currentMonth.year, currentMonth.month)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 6-month trend line chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              แนวโน้ม 6 เดือน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lineChartData.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">
                ไม่มีข้อมูลแนวโน้ม
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v: number) =>
                        v >= 10000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        fontSize: 13,
                      }}
                      formatter={(value, name) => {
                        const label =
                          name === "income" ? "รายรับ" : "รายจ่าย"
                        return [formatTHB(Number(value ?? 0).toFixed(2)), label]
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CHART_COLORS[0] }}
                      name="income"
                    />
                    <Line
                      type="monotone"
                      dataKey="expense"
                      stroke={CHART_COLORS[1]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CHART_COLORS[1] }}
                      name="expense"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* By-category bar chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {categoryType === "expense" ? "หมวดหมู่รายจ่าย" : "หมวดหมู่รายรับ"}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={categoryType === "expense" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryType("expense")}
                  className="h-7 text-xs"
                >
                  รายจ่าย
                </Button>
                <Button
                  variant={categoryType === "income" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryType("income")}
                  className="h-7 text-xs"
                >
                  รายรับ
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {barChartData.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">
                ไม่มีข้อมูลหมวดหมู่
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    layout="vertical"
                    margin={{ left: 0, right: 20, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v: number) =>
                        v >= 10000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        fontSize: 13,
                      }}
                      formatter={(value) => [
                        formatTHB(Number(value ?? 0).toFixed(2)),
                        "ยอดรวม",
                      ]}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} minPointSize={2}>
                      {barChartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
