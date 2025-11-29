'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User,
  Building2,
  Bell,
  Palette,
  Database,
  Shield,
  Download,
  Plane,
  MessageSquare,
  FileText,
  Zap,
  Users,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Globe,
  Clock,
  Save,
  ChevronRight,
  Key,
  Lock,
  Mail,
  Smartphone,
} from 'lucide-react';
import { useTheme } from 'next-themes';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.4,
      ease: [0.25, 0.4, 0.25, 1],
    },
  }),
};

// Settings categories based on business analyst recommendations
const settingsCategories = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'display', label: 'Display', icon: Palette },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'import-export', label: 'Import/Export', icon: Download },
  { id: 'transport', label: 'Transport', icon: Plane },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('account');

  // Form states (simplified for demo)
  const [settings, setSettings] = useState({
    // Account
    displayName: 'Demo User',
    email: 'demo@example.com',
    timezone: 'Asia/Tokyo',
    language: 'en',

    // Notifications
    emailNotifications: true,
    arrivalAlerts: true,
    transportAlerts: true,
    flightUpdates: true,
    dailyDigest: false,
    pushNotifications: false,

    // Display
    compactMode: false,
    showAvatars: true,
    animationsEnabled: true,
    dateFormat: 'MMM dd, yyyy',
    timeFormat: '24h',

    // Data
    autoRefresh: true,
    refreshInterval: '30',
    cacheEnabled: true,

    // Transport
    defaultVehicleCapacity: '8',
    autoAssignEnabled: false,
    bufferTime: '15',
  });

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  const updateSetting = (key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage your preferences and configuration
            </p>
          </div>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Navigation - Scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <TabsList className="inline-flex h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {settingsCategories.map((cat) => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700"
                >
                  <cat.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{cat.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Account Settings */}
          <TabsContent value="account" className="mt-4 space-y-4">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        value={settings.displayName}
                        onChange={(e) => updateSetting('displayName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={settings.email}
                        onChange={(e) => updateSetting('email', e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={settings.timezone} onValueChange={(v) => updateSetting('timezone', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                          <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                          <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">America/Los Angeles (PST)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select value={settings.language} onValueChange={(v) => updateSetting('language', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Organization Settings */}
          <TabsContent value="organization" className="mt-4 space-y-4">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Organization Details
                  </CardTitle>
                  <CardDescription>
                    Configure your organization and event settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Event Name</Label>
                      <Input defaultValue="Annual Leadership Summit 2025" />
                    </div>
                    <div className="space-y-2">
                      <Label>Event Date</Label>
                      <Input type="date" defaultValue="2025-01-15" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Event Location</Label>
                    <Input defaultValue="Tokyo, Japan" />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <Input defaultValue="Axis Corporation" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="mt-4 space-y-4">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Choose what notifications you want to receive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive updates via email</p>
                    </div>
                    <Switch
                      checked={settings.emailNotifications}
                      onCheckedChange={(v) => updateSetting('emailNotifications', v)}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Arrival Alerts</Label>
                      <p className="text-sm text-muted-foreground">Get notified when guests arrive</p>
                    </div>
                    <Switch
                      checked={settings.arrivalAlerts}
                      onCheckedChange={(v) => updateSetting('arrivalAlerts', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Transport Updates</Label>
                      <p className="text-sm text-muted-foreground">Schedule and assignment changes</p>
                    </div>
                    <Switch
                      checked={settings.transportAlerts}
                      onCheckedChange={(v) => updateSetting('transportAlerts', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Flight Updates</Label>
                      <p className="text-sm text-muted-foreground">Flight delays and changes</p>
                    </div>
                    <Switch
                      checked={settings.flightUpdates}
                      onCheckedChange={(v) => updateSetting('flightUpdates', v)}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Daily Digest</Label>
                      <p className="text-sm text-muted-foreground">Summary email every morning</p>
                    </div>
                    <Switch
                      checked={settings.dailyDigest}
                      onCheckedChange={(v) => updateSetting('dailyDigest', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-base">Push Notifications</Label>
                        <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Browser push notifications</p>
                    </div>
                    <Switch
                      checked={settings.pushNotifications}
                      onCheckedChange={(v) => updateSetting('pushNotifications', v)}
                      disabled
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Display Settings */}
          <TabsContent value="display" className="mt-4 space-y-4">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    Display & Appearance
                  </CardTitle>
                  <CardDescription>
                    Customize how the application looks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-base">Theme</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <Button
                        variant={theme === 'light' ? 'default' : 'outline'}
                        className="flex-col h-auto py-4 gap-2"
                        onClick={() => setTheme('light')}
                      >
                        <Sun className="h-5 w-5" />
                        <span className="text-xs">Light</span>
                      </Button>
                      <Button
                        variant={theme === 'dark' ? 'default' : 'outline'}
                        className="flex-col h-auto py-4 gap-2"
                        onClick={() => setTheme('dark')}
                      >
                        <Moon className="h-5 w-5" />
                        <span className="text-xs">Dark</span>
                      </Button>
                      <Button
                        variant={theme === 'system' ? 'default' : 'outline'}
                        className="flex-col h-auto py-4 gap-2"
                        onClick={() => setTheme('system')}
                      >
                        <SettingsIcon className="h-5 w-5" />
                        <span className="text-xs">System</span>
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Compact Mode</Label>
                      <p className="text-sm text-muted-foreground">Use smaller spacing and fonts</p>
                    </div>
                    <Switch
                      checked={settings.compactMode}
                      onCheckedChange={(v) => updateSetting('compactMode', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Show Avatars</Label>
                      <p className="text-sm text-muted-foreground">Display profile pictures in lists</p>
                    </div>
                    <Switch
                      checked={settings.showAvatars}
                      onCheckedChange={(v) => updateSetting('showAvatars', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Animations</Label>
                      <p className="text-sm text-muted-foreground">Enable smooth transitions</p>
                    </div>
                    <Switch
                      checked={settings.animationsEnabled}
                      onCheckedChange={(v) => updateSetting('animationsEnabled', v)}
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date Format</Label>
                      <Select value={settings.dateFormat} onValueChange={(v) => updateSetting('dateFormat', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MMM dd, yyyy">Dec 27, 2025</SelectItem>
                          <SelectItem value="dd/MM/yyyy">27/12/2025</SelectItem>
                          <SelectItem value="MM/dd/yyyy">12/27/2025</SelectItem>
                          <SelectItem value="yyyy-MM-dd">2025-12-27</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Time Format</Label>
                      <Select value={settings.timeFormat} onValueChange={(v) => updateSetting('timeFormat', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24h">24-hour (14:30)</SelectItem>
                          <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Data Settings */}
          <TabsContent value="data" className="mt-4 space-y-4">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Data Management
                  </CardTitle>
                  <CardDescription>
                    Control how data is refreshed and cached
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Auto Refresh</Label>
                      <p className="text-sm text-muted-foreground">Automatically update data</p>
                    </div>
                    <Switch
                      checked={settings.autoRefresh}
                      onCheckedChange={(v) => updateSetting('autoRefresh', v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Refresh Interval</Label>
                    <Select
                      value={settings.refreshInterval}
                      onValueChange={(v) => updateSetting('refreshInterval', v)}
                      disabled={!settings.autoRefresh}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 seconds</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">1 minute</SelectItem>
                        <SelectItem value="300">5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Enable Caching</Label>
                      <p className="text-sm text-muted-foreground">Cache data for faster loading</p>
                    </div>
                    <Switch
                      checked={settings.cacheEnabled}
                      onCheckedChange={(v) => updateSetting('cacheEnabled', v)}
                    />
                  </div>

                  <div className="pt-4">
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Clear Cache
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="mt-4 space-y-4">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Security & Privacy
                  </CardTitle>
                  <CardDescription>
                    Manage your account security settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span>Change Password</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>

                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <div className="text-left">
                        <span>Two-Factor Authentication</span>
                        <Badge variant="secondary" className="ml-2 text-xs">Recommended</Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>

                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span>Active Sessions</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>

                  <Separator />

                  <div className="pt-2">
                    <Button variant="destructive" className="w-full">
                      Sign Out of All Devices
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Import/Export Settings */}
          <TabsContent value="import-export" className="mt-4 space-y-4">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Import & Export
                  </CardTitle>
                  <CardDescription>
                    Manage data import and export options
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                      <Download className="h-5 w-5" />
                      <span>Export Guests (CSV)</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                      <Download className="h-5 w-5" />
                      <span>Export Schedules (CSV)</span>
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Default Export Format</Label>
                    <Select defaultValue="csv">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                      <Label className="text-base">Include Headers</Label>
                      <p className="text-sm text-muted-foreground">Add column names to exports</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Transport Settings */}
          <TabsContent value="transport" className="mt-4 space-y-4">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-primary" />
                    Transport Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure transport and scheduling defaults
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Default Vehicle Capacity</Label>
                    <Select
                      value={settings.defaultVehicleCapacity}
                      onValueChange={(v) => updateSetting('defaultVehicleCapacity', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 passengers</SelectItem>
                        <SelectItem value="6">6 passengers</SelectItem>
                        <SelectItem value="8">8 passengers</SelectItem>
                        <SelectItem value="12">12 passengers</SelectItem>
                        <SelectItem value="16">16 passengers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Buffer Time (minutes)</Label>
                    <Select
                      value={settings.bufferTime}
                      onValueChange={(v) => updateSetting('bufferTime', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No buffer</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Time added between scheduled pickups</p>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-base">Auto-Assign Guests</Label>
                        <Badge variant="secondary" className="text-xs">Beta</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Automatically assign guests to schedules</p>
                    </div>
                    <Switch
                      checked={settings.autoAssignEnabled}
                      onCheckedChange={(v) => updateSetting('autoAssignEnabled', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Flight Grouping</Label>
                      <p className="text-sm text-muted-foreground">Group guests by flight for scheduling</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
