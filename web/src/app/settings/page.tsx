"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Settings, Key, Globe, Bell, Shield, Palette } from "lucide-react";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your workspace settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-secondary/5 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Workspace
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your workspace details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Workspace Name</label>
                <Input defaultValue="Default" className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Workspace Slug</label>
                <Input defaultValue="default" className="bg-secondary border-border" disabled />
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                API Key
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your API key for programmatic access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Current API Key</label>
                <div className="flex items-center gap-2">
                  <Input 
                    defaultValue="••••••••••••••••••••••••••••••••" 
                    className="bg-secondary border-border font-mono"
                    disabled
                  />
                  <Button variant="outline" size="sm">Copy</Button>
                </div>
              </div>
              <Button variant="outline" className="border-border">
                Regenerate API Key
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-foreground text-sm">Email Notifications</p>
                    <p className="text-muted-foreground text-xs">Receive email updates about your links</p>
                  </div>
                  <input type="checkbox" className="toggle" defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-foreground text-sm">Click Alerts</p>
                    <p className="text-muted-foreground text-xs">Get notified when links get clicks</p>
                  </div>
                  <input type="checkbox" className="toggle" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Security
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <p className="text-foreground text-sm">Two-Factor Authentication</p>
                  <p className="text-muted-foreground text-xs">Add an extra layer of security</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <p className="text-foreground text-sm">Session Timeout</p>
                  <p className="text-muted-foreground text-xs">Auto-logout after inactivity</p>
                </div>
                <select className="bg-secondary border-border rounded-md px-2 py-1 text-sm">
                  <option>30 minutes</option>
                  <option>1 hour</option>
                  <option>4 hours</option>
                  <option>Never</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}