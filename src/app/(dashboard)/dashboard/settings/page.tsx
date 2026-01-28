'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Shield,
  ShoppingBag,
  Printer,
  Bell,
  Loader2,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, profile, role, isAdmin } = useAuth();
  const supabase = createClient();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);

  // Shopify settings (placeholder)
  const [shopifyDomain, setShopifyDomain] = useState('');
  const [shopifyConnected, setShopifyConnected] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: fullName })
        .eq('id', user?.id);

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-[#999184]/20 text-[#7a756a]';
      case 'manager':
        return 'bg-[#999184]/20 text-[#7a756a]';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and integrations</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="team">
              <Shield className="h-4 w-4 mr-2" />
              Team
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">
                  Email cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <div>
                  <Badge className={getRoleBadgeColor(role)}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  Contact an administrator to change your role
                </p>
              </div>
              <Separator />
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          {/* Shopify Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <CardTitle>Shopify</CardTitle>
                    <CardDescription>
                      Auto-import orders from your Shopify store
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={shopifyConnected ? 'default' : 'secondary'}>
                  {shopifyConnected ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </>
                  ) : (
                    'Not Connected'
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!shopifyConnected ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="shopifyDomain">Store Domain</Label>
                    <Input
                      id="shopifyDomain"
                      placeholder="your-store.myshopify.com"
                      value={shopifyDomain}
                      onChange={(e) => setShopifyDomain(e.target.value)}
                    />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
                    <p className="font-medium mb-2">Setup Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to your Shopify Admin &gt; Settings &gt; Apps and sales channels</li>
                      <li>Click "Develop apps" and create a new app</li>
                      <li>Configure webhook subscriptions for order events</li>
                      <li>Copy the API access token and webhook secret</li>
                      <li>Add them to your environment variables</li>
                    </ol>
                  </div>
                  <Button disabled>
                    Connect Shopify
                  </Button>
                  <p className="text-xs text-gray-500">
                    Configure environment variables first (SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_WEBHOOK_SECRET)
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-green-800">Connected to {shopifyDomain}</p>
                      <p className="text-sm text-green-600">Webhook active - orders will sync automatically</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Disconnect
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Bambu Labs Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Printer className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <CardTitle>Bambu Labs Cloud</CardTitle>
                    <CardDescription>
                      Auto-track print status and completion
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                <p>
                  Bambu Labs Cloud integration will allow automatic tracking of:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Real-time printer status updates</li>
                  <li>Automatic print completion logging</li>
                  <li>Failed print detection and alerts</li>
                  <li>Material consumption tracking</li>
                </ul>
                <p className="mt-3">
                  This feature is in development. Check back for updates.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Management</CardTitle>
                <CardDescription>
                  Manage team members and their roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <p className="font-medium mb-2">Role Permissions:</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge className="bg-[#999184]/20 text-[#7a756a] mt-0.5">Admin</Badge>
                      <p>Full access. Can manage users, delete data, and configure integrations.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-[#999184]/20 text-[#7a756a] mt-0.5">Manager</Badge>
                      <p>Can create orders, log prints, update inventory, and manage printers.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-gray-100 text-gray-700 mt-0.5">Viewer</Badge>
                      <p>Read-only access to view dashboard, orders, and inventory.</p>
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <p className="text-sm text-gray-500">
                  To change a user&apos;s role, update their record directly in Supabase &gt; user_profiles table.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
