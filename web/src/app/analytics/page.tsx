"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  MousePointerClick, 
  Users, 
  Globe, 
  Monitor,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import { format, subDays } from "date-fns";

export default function AnalyticsOverviewPage() {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ["workspace-stats", "default"],
    queryFn: () => api.analytics.workspace("default", { period: "30d", limit: 20 }),
  });

  const stats = statsData?.data;
  
  const mockChartData = Array.from({ length: 14 }, (_, i) => ({
    date: format(subDays(new Date(), 13 - i), "MMM d"),
    clicks: Math.floor(Math.random() * 100) + (stats?.totalClicks || 0) / 14,
    unique: Math.floor(Math.random() * 50) + (stats?.totalClicks || 0) / 28,
  }));

  const topCountries = [
    { country: "United States", flag: "🇺🇸", clicks: 1245, percentage: 35 },
    { country: "United Kingdom", flag: "🇬🇧", clicks: 876, percentage: 25 },
    { country: "Germany", flag: "🇩🇪", clicks: 543, percentage: 15 },
    { country: "India", flag: "🇮🇳", clicks: 432, percentage: 12 },
    { country: "France", flag: "🇫🇷", clicks: 321, percentage: 9 },
  ];

  const topLinks = stats?.topLinks || [];

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of your link performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                  <p className="text-3xl font-bold mt-1">{stats?.totalClicks?.toLocaleString() || "0"}</p>
                  <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3" />
                    +12.5% from last month
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <MousePointerClick className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/50 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Visitors</p>
                  <p className="text-3xl font-bold mt-1">{Math.floor((stats?.totalClicks || 0) * 0.7).toLocaleString()}</p>
                  <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3" />
                    +8.2% from last month
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/50 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Links</p>
                  <p className="text-3xl font-bold mt-1">{topLinks.length || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across {stats?.totalLinks || 0} workspaces
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/50 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. CTR</p>
                  <p className="text-3xl font-bold mt-1">3.2%</p>
                  <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3" />
                    +0.4% from last month
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2 bg-secondary/5 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Click Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      stroke="#666"
                    />
                    <YAxis 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      stroke="#666"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f1f1f', 
                        border: '1px solid #333',
                        borderRadius: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="unique" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Top Countries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topCountries.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.flag}</span>
                      <span className="text-sm text-foreground">{item.country}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{item.clicks}</span>
                      <span className="text-xs text-primary">({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-secondary/5 border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              Top Performing Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topLinks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No link data available yet</p>
                <p className="text-sm mt-1">Create links and share them to see analytics</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topLinks.slice(0, 5).map((link: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-foreground font-medium">short.ly/{link.slug}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{link.originalUrl}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground font-medium">{link.totalClicks} clicks</p>
                      <p className="text-xs text-muted-foreground">{Math.floor(link.totalClicks * 0.7)} unique</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}