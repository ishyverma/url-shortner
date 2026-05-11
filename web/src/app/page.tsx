"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { QRDialog } from "@/components/qr-dialog";
import { 
  Plus, 
  Link2, 
  MousePointerClick, 
  TrendingUp, 
  ExternalLink, 
  Copy, 
  Trash2, 
  BarChart3,
  Search,
  MoreHorizontal,
  QrCode,
  Edit,
  Check,
  X
} from "lucide-react";
import { format } from "date-fns";
import { useEffect, useRef } from "react";

export default function DashboardPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSlug, setQrSlug] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const { data: linksData, isLoading } = useQuery({
    queryKey: ["links"],
    queryFn: () => api.links.list({ limit: 100 }),
  });

  const { data: statsData } = useQuery({
    queryKey: ["workspace-stats"],
    queryFn: () => api.analytics.workspace("default", { period: "7d" }),
    enabled: !!linksData?.data?.length,
  });

  const createMutation = useMutation({
    mutationFn: (data: { url: string; slug?: string }) => api.links.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      setIsCreateOpen(false);
      setNewUrl("");
      setNewSlug("");
    },
    onError: (error: Error) => {
      alert(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => api.links.delete(slug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["links"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ slug, url }: { slug: string; url: string }) => api.links.update(slug, { url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      setEditingSlug(null);
      setEditUrl("");
    },
  });

  const copyToClipboard = (slug: string) => {
    navigator.clipboard.writeText(`https://short.ly/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const startEdit = (slug: string, currentUrl: string) => {
    setEditingSlug(slug);
    setEditUrl(currentUrl);
    setTimeout(() => editInputRef.current?.focus(), 100);
  };

  const saveEdit = () => {
    if (editingSlug && editUrl) {
      updateMutation.mutate({ slug: editingSlug, url: editUrl });
    }
  };

  const cancelEdit = () => {
    setEditingSlug(null);
    setEditUrl("");
  };

  const filteredLinks = (linksData?.data || []).filter((link: any) => 
    link.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    link.originalUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClicks = statsData?.data?.totalClicks || 0;
  const links = filteredLinks;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Links</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your shortened URLs</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                New Link
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create New Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Destination URL</label>
                  <Input
                    placeholder="https://example.com"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Custom Short URL (optional)</label>
                  <div className="flex items-center gap-2 bg-secondary border border-border rounded-md px-3">
                    <span className="text-muted-foreground text-sm">short.ly/</span>
                    <Input
                      placeholder="my-link"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      className="border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => createMutation.mutate({ url: newUrl, slug: newSlug || undefined })}
                  disabled={!newUrl || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Link"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-secondary/50 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Links</p>
                  <p className="text-3xl font-semibold mt-1">{linksData?.data?.length || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Link2 className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/50 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clicks (7d)</p>
                  <p className="text-3xl font-semibold mt-1">{totalClicks.toLocaleString()}</p>
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
                  <p className="text-sm text-muted-foreground">Top Link</p>
                  <p className="text-lg font-semibold mt-1 truncate max-w-[150px]">
                    {statsData?.data?.topLinks?.[0]?.slug || "No links yet"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statsData?.data?.topLinks?.[0]?.totalClicks || 0} clicks
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-secondary/5 border-border">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">All Links</CardTitle>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search links..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64 bg-secondary border-border"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : links.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No links yet</p>
                <p className="text-sm mt-1">Create your first link to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Short URL</TableHead>
                    <TableHead className="text-muted-foreground">Destination</TableHead>
                    <TableHead className="text-muted-foreground">Clicks</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link: any) => (
                    <TableRow key={link.id} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {editingSlug === link.slug ? (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-sm">short.ly/</span>
                              <Input
                                ref={editInputRef}
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                className="w-32 text-foreground"
                              />
                              <Button size="icon" variant="ghost" onClick={saveEdit} className="h-6 w-6">
                                <Check className="w-3 h-3 text-green-500" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-6 w-6">
                                <X className="w-3 h-3 text-red-500" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="font-medium text-foreground">short.ly/{link.slug}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(link.slug)}
                              >
                                {copiedSlug === link.slug ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Copy className="w-3 h-3 text-muted-foreground" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {editingSlug !== link.slug && link.originalUrl}
                      </TableCell>
                      <TableCell className="text-foreground">{link.totalClicks || 0}</TableCell>
                      <TableCell>
                        <Badge variant={link.isActive ? "default" : "secondary"} className={link.isActive ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : ""}>
                          {link.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(link.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={`/${link.slug}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => {
                              setQrSlug(link.slug);
                              setQrOpen(true);
                            }}
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(link.slug, link.originalUrl)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={`/analytics/${link.slug}`}>
                              <BarChart3 className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-red-500"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this link?")) {
                                deleteMutation.mutate(link.slug);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <QRDialog open={qrOpen} onOpenChange={setQrOpen} slug={qrSlug} />
    </DashboardLayout>
  );
}