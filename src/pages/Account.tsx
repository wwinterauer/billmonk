import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Building2,
  Lock,
  Crown,
  Save,
  Loader2,
  Camera,
  Mail,
  Eye,
  EyeOff,
  Check,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { SubscriptionSettings } from '@/components/settings/SubscriptionSettings';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  newsletter_opt_in: boolean;
  // Address & Company
  account_type: string;
  company_name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  uid_number: string;
}

const DEFAULT_PROFILE: ProfileData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  avatar_url: '',
  newsletter_opt_in: false,
  account_type: 'private',
  company_name: '',
  street: '',
  zip: '',
  city: '',
  country: 'AT',
  uid_number: '',
};

const COUNTRIES = [
  { value: 'AT', label: 'Österreich' },
  { value: 'DE', label: 'Deutschland' },
  { value: 'CH', label: 'Schweiz' },
  { value: 'LI', label: 'Liechtenstein' },
  { value: 'IT', label: 'Italien' },
  { value: 'HU', label: 'Ungarn' },
  { value: 'CZ', label: 'Tschechien' },
  { value: 'SK', label: 'Slowakei' },
  { value: 'SI', label: 'Slowenien' },
];

const Account = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['profile', 'address', 'security', 'subscription', 'support'];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'profile';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const PASSWORD_RULES = [
    { key: 'length', label: 'Mindestens 8 Zeichen', test: (p: string) => p.length >= 8 },
    { key: 'upper', label: 'Ein Großbuchstabe', test: (p: string) => /[A-Z]/.test(p) },
    { key: 'number', label: 'Eine Zahl', test: (p: string) => /[0-9]/.test(p) },
  ];

  const allPasswordRulesPass = PASSWORD_RULES.every(r => r.test(newPassword));
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone, avatar_url, newsletter_opt_in, account_type, company_name, street, zip, city, country, uid_number')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          phone: (data as any).phone || '',
          avatar_url: (data as any).avatar_url || '',
          newsletter_opt_in: data.newsletter_opt_in || false,
          account_type: data.account_type || 'private',
          company_name: data.company_name || '',
          street: data.street || '',
          zip: data.zip || '',
          city: data.city || '',
          country: data.country || 'AT',
          uid_number: data.uid_number || '',
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          newsletter_opt_in: profile.newsletter_opt_in,
        } as any)
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Profil gespeichert', description: 'Deine persönlichen Daten wurden aktualisiert.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Profil konnte nicht gespeichert werden.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          account_type: profile.account_type,
          company_name: profile.company_name,
          street: profile.street,
          zip: profile.zip,
          city: profile.city,
          country: profile.country,
          uid_number: profile.uid_number,
        })
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Adresse gespeichert', description: 'Deine Firmen- und Adressdaten wurden aktualisiert.' });
    } catch {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Adresse konnte nicht gespeichert werden.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!allPasswordRulesPass) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Passwort erfüllt nicht alle Anforderungen.' });
      return;
    }
    if (!passwordsMatch) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Passwörter stimmen nicht überein.' });
      return;
    }
    if (!currentPassword) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Bitte gib dein aktuelles Passwort ein.' });
      return;
    }

    setPasswordSaving(true);
    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (signInError) {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Aktuelles Passwort ist falsch.' });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Passwort geändert', description: 'Dein Passwort wurde erfolgreich aktualisiert.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: err?.message || 'Passwort konnte nicht geändert werden.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setAvatarUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;
      
      await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl } as any)
        .eq('id', user.id);

      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      toast({ title: 'Profilbild aktualisiert' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload fehlgeschlagen', description: err?.message || 'Bild konnte nicht hochgeladen werden.' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  const userInitials = profile.first_name && profile.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : profile.email?.slice(0, 2).toUpperCase() || '??';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Mein Konto</h1>
          <p className="text-muted-foreground">Verwalte dein Profil, deine Adresse und dein Abonnement</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex flex-wrap w-full h-auto gap-1 p-1">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
            <TabsTrigger value="address" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Adresse & Firma</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Sicherheit</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">Abo</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Support</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Persönliche Daten</CardTitle>
                  <CardDescription>Deine Kontaktdaten und Profilbild</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Profilbild"
                          className="h-20 w-20 rounded-full object-cover border-2 border-border"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                          {userInitials}
                        </div>
                      )}
                      <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                        {avatarUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                        ) : (
                          <Camera className="h-4 w-4 text-primary-foreground" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                          disabled={avatarUploading}
                        />
                      </label>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Profilbild</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG oder WebP. Max. 2 MB.</p>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">Vorname</Label>
                      <Input
                        id="first_name"
                        value={profile.first_name}
                        onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Nachname</Label>
                      <Input
                        id="last_name"
                        value={profile.last_name}
                        onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Email (readonly) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail-Adresse</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        value={profile.email}
                        readOnly
                        disabled
                        className="pl-10 bg-muted/50"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Die E-Mail-Adresse kann nicht geändert werden.</p>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+43 660 1234567"
                      value={profile.phone}
                      onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>

                  {/* Newsletter */}
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="newsletter" className="text-sm font-medium">Newsletter</Label>
                      <p className="text-xs text-muted-foreground">
                        XpenzAI Newsletter erhalten (Tipps, Updates, Angebote)
                      </p>
                    </div>
                    <Switch
                      id="newsletter"
                      checked={profile.newsletter_opt_in}
                      onCheckedChange={checked => setProfile(p => ({ ...p, newsletter_opt_in: checked }))}
                    />
                  </div>

                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Profil speichern
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Address & Company Tab */}
          <TabsContent value="address">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Adresse & Firma</CardTitle>
                  <CardDescription>Deine Geschäfts- und Rechnungsadresse</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Account type */}
                  <div className="space-y-2">
                    <Label>Kontotyp</Label>
                    <Select
                      value={profile.account_type}
                      onValueChange={v => setProfile(p => ({ ...p, account_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Privatperson</SelectItem>
                        <SelectItem value="company">Unternehmen</SelectItem>
                        <SelectItem value="association">Verein</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Company Name */}
                  {(profile.account_type === 'company' || profile.account_type === 'association') && (
                    <div className="space-y-2">
                      <Label htmlFor="company_name">
                        {profile.account_type === 'association' ? 'Vereinsname' : 'Firmenname'}
                      </Label>
                      <Input
                        id="company_name"
                        value={profile.company_name}
                        onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* UID */}
                  {profile.account_type === 'company' && (
                    <div className="space-y-2">
                      <Label htmlFor="uid_number">UID-Nummer</Label>
                      <Input
                        id="uid_number"
                        placeholder="ATU12345678"
                        value={profile.uid_number}
                        onChange={e => setProfile(p => ({ ...p, uid_number: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="street">Straße & Hausnummer</Label>
                    <Input
                      id="street"
                      value={profile.street}
                      onChange={e => setProfile(p => ({ ...p, street: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="zip">PLZ</Label>
                      <Input
                        id="zip"
                        value={profile.zip}
                        onChange={e => setProfile(p => ({ ...p, zip: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="city">Ort</Label>
                      <Input
                        id="city"
                        value={profile.city}
                        onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Land</Label>
                    <Select
                      value={profile.country}
                      onValueChange={v => setProfile(p => ({ ...p, country: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleSaveAddress} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Adresse speichern
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Passwort ändern</CardTitle>
                  <CardDescription>Aktualisiere dein Passwort für mehr Sicherheit</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current password */}
                  <div className="space-y-2">
                    <Label htmlFor="current_password">Aktuelles Passwort</Label>
                    <div className="relative">
                      <Input
                        id="current_password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Dein aktuelles Passwort"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div className="space-y-2">
                    <Label htmlFor="new_password">Neues Passwort</Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Neues Passwort"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password rules */}
                  <div className="space-y-1.5">
                    {PASSWORD_RULES.map(rule => {
                      const pass = rule.test(newPassword);
                      return (
                        <div key={rule.key} className="flex items-center gap-2 text-sm">
                          {newPassword.length > 0 ? (
                            pass ? (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            )
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
                          )}
                          <span className={newPassword.length > 0 ? (pass ? 'text-foreground' : 'text-destructive') : 'text-muted-foreground'}>
                            {rule.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Passwort bestätigen</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                    />
                    {confirmPassword.length > 0 && !passwordsMatch && (
                      <p className="text-xs text-destructive">Passwörter stimmen nicht überein</p>
                    )}
                  </div>

                  <Button
                    onClick={handleChangePassword}
                    disabled={passwordSaving || !currentPassword || !allPasswordRulesPass || !passwordsMatch}
                  >
                    {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                    Passwort ändern
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <SubscriptionSettings />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Account;
