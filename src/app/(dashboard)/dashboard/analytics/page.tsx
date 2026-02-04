'use client';

import { useState } from 'react';
import { useProductionMetrics, EnrichedPrintLogEntry } from '@/hooks/useDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Scale,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const COLORS = ['#22c55e', '#f97316', '#eab308'];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30');
  const { data: metrics, isLoading } = useProductionMetrics(parseInt(timeRange));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-500">Production metrics and insights</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  // Calculate summary stats from inventory print log
  const printLog = metrics?.printLog || [];
  const totalPrints = printLog.reduce((sum: number, p: EnrichedPrintLogEntry) => sum + p.num_prints, 0);
  const successfulPrints = printLog
    .filter((p: EnrichedPrintLogEntry) => p.status === 'success')
    .reduce((sum: number, p: EnrichedPrintLogEntry) => sum + p.num_prints, 0);
  const failedPrints = printLog
    .filter((p: EnrichedPrintLogEntry) => p.status === 'failed')
    .reduce((sum: number, p: EnrichedPrintLogEntry) => sum + p.num_prints, 0);
  const successRate = totalPrints > 0 ? ((successfulPrints / totalPrints) * 100).toFixed(1) : '100';
  // material_grams is per-print, calculated in the hook
  const totalMaterial = printLog.reduce((sum: number, p: EnrichedPrintLogEntry) => sum + p.material_used_grams, 0);

  // Prepare chart data
  const dailyData = Object.entries(metrics?.dailyProduction || {})
    .map(([date, data]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      completed: data.completed,
      failed: data.failed,
      material: Math.round(data.material),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-14); // Last 14 days

  const pieData = [
    { name: 'Successful', value: successfulPrints },
    { name: 'Failed', value: failedPrints },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500">Production metrics and insights</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Prints</p>
                <p className="text-2xl font-bold">{totalPrints}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Success Rate</p>
                <p className="text-2xl font-bold">{successRate}%</p>
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                parseFloat(successRate) >= 90 ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                {parseFloat(successRate) >= 90 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-yellow-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Successful</p>
                <p className="text-2xl font-bold text-green-600">{successfulPrints}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-2xl font-bold text-orange-600">{failedPrints}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily production chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Production</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No production data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="completed" name="Successful" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Success rate pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Success vs Failed</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Material usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Material Consumption
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Material Used</p>
              <p className="text-3xl font-bold text-gray-900">
                {(totalMaterial / 1000).toFixed(2)} kg
              </p>
              <p className="text-sm text-gray-500 mt-1">
                ({totalMaterial.toLocaleString()}g)
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Avg per Print</p>
              <p className="text-3xl font-bold text-gray-900">
                {totalPrints > 0 ? Math.round(totalMaterial / totalPrints) : 0}g
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Daily Average</p>
              <p className="text-3xl font-bold text-gray-900">
                {Math.round(totalMaterial / parseInt(timeRange))}g
              </p>
            </div>
          </div>

          {dailyData.length > 0 && (
            <div className="mt-6">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [`${value}g`, 'Material Used']}
                  />
                  <Line
                    type="monotone"
                    dataKey="material"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
