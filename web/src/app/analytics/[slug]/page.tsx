"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  ArrowLeft, 
  ExternalLink, 
  Globe, 
  Monitor, 
  Globe2, 
  Link2, 
  MousePointerClick,
  Users,
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Check,
  BarChart3,
  PieChart,
  Search,
  Download
} from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { format, subDays } from "date-fns";

const COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

const countryFlags: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", IN: "🇮🇳", JP: "🇯🇵", BR: "🇧🇷",
  CA: "🇨🇦", AU: "🇦🇺", ES: "🇪🇸", IT: "🇮🇹", NL: "🇳🇱", SE: "🇸🇪", CH: "🇨🇭",
  KR: "🇰🇷", CN: "🇨🇳", SG: "🇸🇬", MX: "🇲🇽", ID: "🇮🇩", TH: "🇹🇭", PH: "🇵🇭",
  VN: "🇻🇳", MY: "🇲🇾", PK: "🇵🇰", BD: "🇧🇩", EG: "🇪🇬", NG: "🇳🇬", ZA: "🇿🇦",
};

const deviceIcons: Record<string, string> = {
  desktop: "🖥️",
  mobile: "📱",
  tablet: "📱",
};

const browserIcons: Record<string, string> = {
  chrome: "🔵",
  firefox: "🔥",
  safari: "🧭",
  edge: "🔷",
  opera: "🟠",
};

export default function AnalyticsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [dateRange, setDateRange] = useState("7d");
  const [copied, setCopied] = useState(false);

  const { data: linkData } = useQuery({
    queryKey: ["link", slug],
    queryFn: () => api.links.get(slug),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats", slug],
    queryFn: () => api.analytics.stats(slug),
  });

  const { data: timeseries } = useQuery({
    queryKey: ["timeseries", slug, dateRange],
    queryFn: () => api.analytics.timeseries(slug, { interval: dateRange === "24h" ? "hour" : "day" }),
  });

  const { data: countries } = useQuery({
    queryKey: ["countries", slug],
    queryFn: () => api.analytics.countries(slug),
  });

  const { data: devices } = useQuery({
    queryKey: ["devices", slug],
    queryFn: () => api.analytics.devices(slug),
  });

  const { data: browsers } = useQuery({
    queryKey: ["browsers", slug],
    queryFn: () => api.analytics.browsers(slug),
  });

  const { data: referrers } = useQuery({
    queryKey: ["referrers", slug],
    queryFn: () => api.analytics.referrers(slug),
  });

  const { data: os } = useQuery({
    queryKey: ["os", slug],
    queryFn: () => api.analytics.os(slug),
  });

  const { data: utmData } = useQuery({
    queryKey: ["utm", slug],
    queryFn: () => api.analytics.utm(slug),
  });

  const copyLink = () => {
    navigator.clipboard.writeText(`https://short.ly/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statsData = stats?.data || {};
  const linkInfo = linkData?.data;

  const chartData = timeseries?.data?.map((d: any) => ({
    date: format(new Date(d.timestamp), dateRange === "24h" ? "HH:mm" : "MMM d"),
    clicks: d.clicks,
    unique: d.uniqueVisitors,
  })) || [];

  const countryData = (countries?.data || []).map((c: any) => ({
    name: c.country,
    flag: countryFlags[c.country] || "🌍",
    value: c.clicks,
    percentage: c.percentage,
  }));

  const deviceData = (devices?.data || []).map((d: any) => ({
    name: d.device || "Unknown",
    icon: deviceIcons[d.device?.toLowerCase()] || "📱",
    value: d.clicks,
  }));

  const browserData = (browsers?.data || []).map((b: any) => ({
    name: b.browser || "Unknown",
    icon: browserIcons[b.browser?.toLowerCase()] || "🌐",
    value: b.clicks,
  }));

  const referrerData = (referrers?.data || []).map((r: any) => ({
    name: r.refDomain === "" ? "Direct" : r.refDomain,
    value: r.clicks,
  })).slice(0, 10);

  const osData = (os?.data || []).map((o: any) => ({
    name: o.os || "Unknown",
    value: o.clicks,
  }));

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">/{slug}</h1>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyLink}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground truncate max-w-md">{linkInfo?.originalUrl}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href={`/${slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-secondary/50 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                  <p className="text-3xl font-semibold mt-1">{formatNumber(statsData.totalClicks || 0)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
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
                  <p className="text-3xl font-semibold mt-1">{formatNumber(statsData.uniqueClicks || 0)}</p>
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
                  <p className="text-sm text-muted-foreground">Last 24h</p>
                  <p className="text-3xl font-semibold mt-1">{formatNumber(statsData.last24hClicks || 0)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/50 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Last 7d</p>
                  <p className="text-3xl font-semibold mt-1">{formatNumber(statsData.last7dClicks || 0)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-secondary/5 border-border mb-8">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">Click Trends</CardTitle>
              <div className="flex items-center gap-2">
                {["24h", "7d", "30d"].map((range) => (
                  <Button
                    key={range}
                    variant={dateRange === range ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setDateRange(range)}
                    className={dateRange === range ? "bg-primary text-primary-foreground" : ""}
                  >
                    {range === "24h" ? "24 Hours" : range === "7d" ? "7 Days" : "30 Days"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {chartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No data available yet</p>
                  <p className="text-sm">Clicks will appear here once users visit your link</p>
                </div>
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
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
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorClicks)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="unique" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorUnique)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Clicks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-sm text-muted-foreground">Unique Visitors</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-secondary border-border">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
            <TabsTrigger value="geography" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Geography</TabsTrigger>
            <TabsTrigger value="devices" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Devices</TabsTrigger>
            <TabsTrigger value="browsers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Browsers</TabsTrigger>
            <TabsTrigger value="referrers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Referrers</TabsTrigger>
            <TabsTrigger value="utm" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">UTM</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-secondary/5 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    Top Countries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {countryData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data available</div>
                  ) : (
                    <div className="space-y-3">
                      {countryData.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{item.flag}</span>
                            <span className="text-foreground">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{item.value} clicks</span>
                            <Badge variant="secondary">{item.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-secondary/5 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-primary" />
                    Top Devices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {deviceData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data available</div>
                  ) : (
                    <div className="space-y-3">
                      {deviceData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{item.icon}</span>
                            <span className="text-foreground capitalize">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{item.value} clicks</span>
                            <Badge variant="secondary">
                              {Math.round((item.value / (deviceData.reduce((a, b) => a + b.value, 0) || 1)) * 100)}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="geography">
            <Card className="bg-secondary/5 border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-primary" />
                  Clicks by Country
                </CardTitle>
              </CardHeader>
              <CardContent>
                {countryData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No geographic data available</p>
                    <p className="text-sm mt-1">Country data requires public IP addresses</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {countryData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.flag}</span>
                          <span className="text-foreground font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full" 
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground w-20 text-right">{item.value} clicks</span>
                          <Badge variant="secondary" className="w-14 text-center">{item.percentage}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="devices">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-secondary/5 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-primary" />
                    Devices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {deviceData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data available</div>
                  ) : (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={deviceData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {deviceData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1f1f1f', 
                              border: '1px solid #333',
                              borderRadius: '8px',
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
                <CardContent className="-mt-8">
                  <div className="space-y-2">
                    {deviceData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-foreground capitalize">{item.name}</span>
                        </div>
                        <span className="text-muted-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-secondary/5 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    Operating Systems
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {osData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data available</div>
                  ) : (
                    <div className="space-y-3">
                      {osData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-foreground">{item.name}</span>
                          <Badge variant="secondary">{item.value}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="browsers">
            <Card className="bg-secondary/5 border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-primary" />
                  Browsers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {browserData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No browser data available</p>
                  </div>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={browserData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                        <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} stroke="#666" />
                        <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="#666" width={80} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1f1f1f', 
                            border: '1px solid #333',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrers">
            <Card className="bg-secondary/5 border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-primary" />
                  Top Referrers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {referrerData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ArrowUpRight className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No referrer data available</p>
                    <p className="text-sm mt-1">Referrers show where your traffic comes from</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrerData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {idx + 1}
                          </div>
                          <span className="text-foreground font-medium">{item.name || "Direct"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full" 
                              style={{ width: `${(item.value / (referrerData.reduce((a, b) => a + b.value, 0) || 1)) * 100}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground w-16 text-right">{item.value} clicks</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="utm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-secondary/5 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-sm">UTM Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  {utmData?.data?.bySource?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No data available</div>
                  ) : (
                    <div className="space-y-3">
                      {utmData?.data?.bySource?.slice(0, 5).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-foreground text-sm truncate">{item.source || "Unknown"}</span>
                          <Badge variant="secondary">{item.clicks}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-secondary/5 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-sm">UTM Mediums</CardTitle>
                </CardHeader>
                <CardContent>
                  {utmData?.data?.byMedium?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No data available</div>
                  ) : (
                    <div className="space-y-3">
                      {utmData?.data?.byMedium?.slice(0, 5).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-foreground text-sm truncate">{item.medium || "Unknown"}</span>
                          <Badge variant="secondary">{item.clicks}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-secondary/5 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-sm">UTM Campaigns</CardTitle>
                </CardHeader>
                <CardContent>
                  {utmData?.data?.byCampaign?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No data available</div>
                  ) : (
                    <div className="space-y-3">
                      {utmData?.data?.byCampaign?.slice(0, 5).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-foreground text-sm truncate">{item.campaign || "Unknown"}</span>
                          <Badge variant="secondary">{item.clicks}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}