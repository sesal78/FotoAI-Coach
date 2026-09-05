'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  createFotoaiGear,
  deleteFotoaiGear,
  getFotoaiPreferences,
  listFotoaiGear,
  saveFotoaiPreferences,
  type FotoaiGear,
  type FotoaiGearCategory,
  type FotoaiPreferences,
  type FotoaiSkillLevel,
} from '@/lib/fotoai/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Save, Camera, MapPin, User } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, status } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<FotoaiPreferences>({
    skillLevel: 'intermediate',
    photographyInterests: [],
    homeLocation: null,
    currentLocation: null,
  });
  const [gear, setGear] = useState<FotoaiGear[]>([]);
  const [newGearBrand, setNewGearBrand] = useState('');
  const [newGearModel, setNewGearModel] = useState('');
  const [newGearCategory, setNewGearCategory] = useState<FotoaiGearCategory>('camera');

  const skillLevels: FotoaiSkillLevel[] = ['beginner', 'intermediate', 'advanced', 'professional'];
  const interestOptions = [
    'street', 'portrait', 'landscape', 'architecture', 'nature',
    'abstract', 'documentary', 'travel', 'macro', 'night',
  ];

  useEffect(() => {
    if (status === 'authenticated') {
      loadSettings();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  async function loadSettings() {
    try {
      const [loadedPreferences, loadedGear] = await Promise.all([
        getFotoaiPreferences(),
        listFotoaiGear(),
      ]);
      setPrefs(loadedPreferences);
      setGear(loadedGear);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences() {
    setSaving(true);
    try {
      setPrefs(await saveFotoaiPreferences({
        ...prefs,
        homeLocation: prefs.homeLocation?.trim() || null,
        currentLocation: prefs.currentLocation?.trim() || null,
      }));
      toast.success('Preferences saved!');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  async function addGear() {
    if (!newGearBrand.trim() || !newGearModel.trim()) {
      toast.error('Brand and model are required');
      return;
    }
    try {
      const item = await createFotoaiGear({
        category: newGearCategory,
        brand: newGearBrand.trim(),
        model: newGearModel.trim(),
      });
      setGear((prev) => [...prev, item]);
      setNewGearBrand('');
      setNewGearModel('');
      toast.success('Gear added!');
    } catch {
      toast.error('Failed to add gear');
    }
  }

  async function removeGear(gearId: string) {
    try {
      await deleteFotoaiGear(gearId);
      setGear((prev) => prev.filter((g) => g.id !== gearId));
      toast.success('Gear removed');
    } catch {
      toast.error('Failed to remove gear');
    }
  }

  function toggleInterest(interest: string) {
    setPrefs((prev) => ({
      ...prev,
      photographyInterests: prev.photographyInterests.includes(interest)
        ? prev.photographyInterests.filter((i) => i !== interest)
        : [...prev.photographyInterests, interest],
    }));
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight display-font">Settings</h1>
          <p className="text-muted-foreground mt-2">Configure your profile, gear, and preferences.</p>
        </div>

        {/* Profile Info */}
        <section className="editorial-card p-6 lg:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold display-font">Profile</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Name</label>
              <p className="text-foreground font-medium">{user?.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
              <p className="text-foreground font-medium">{user?.email}</p>
            </div>
          </div>
        </section>

        {/* Skill & Interests */}
        <section className="editorial-card p-6 lg:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold display-font">Photography Preferences</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-3">Skill Level</label>
              <div className="flex flex-wrap gap-2">
                {skillLevels.map((level) => (
                  <button
                    key={level}
                    onClick={() => setPrefs((p) => ({ ...p, skillLevel: level }))}
                    className={`px-4 py-2 border-2 text-sm font-medium capitalize transition-all ${
                      prefs.skillLevel === level
                        ? 'border-primary bg-accent text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-3">Photography Interests</label>
              <div className="flex flex-wrap gap-2">
                {interestOptions.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1.5 border text-sm capitalize transition-all ${
                      prefs.photographyInterests.includes(interest)
                        ? 'border-primary bg-primary text-white'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="editorial-card p-6 lg:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold display-font">Location</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Home Location</label>
              <Input
                value={prefs.homeLocation ?? ''}
                onChange={(e) => setPrefs((p) => ({ ...p, homeLocation: e.target.value }))}
                placeholder="e.g., Melbourne, Australia"
                className="h-11"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Current Location</label>
              <Input
                value={prefs.currentLocation ?? ''}
                onChange={(e) => setPrefs((p) => ({ ...p, currentLocation: e.target.value }))}
                placeholder="e.g., Melbourne CBD"
                className="h-11"
              />
            </div>
          </div>
        </section>

        {/* Save Preferences */}
        <div className="mb-10">
          <Button
            onClick={savePreferences}
            disabled={saving}
            size="lg"
            className="w-full h-12 bg-foreground text-background hover:bg-primary font-semibold tracking-wide"
          >
            {saving ? 'Saving...' : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Preferences
              </>
            )}
          </Button>
        </div>

        {/* Gear */}
        <section className="editorial-card p-6 lg:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold display-font">Your Gear</h2>
          </div>

          {gear.length > 0 && (
            <div className="space-y-2 mb-6">
              {gear.map((item) => (
                <div key={item.id} className="flex items-center justify-between border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs capitalize">{item.category}</Badge>
                    <span className="font-medium text-sm">{item.brand} {item.model}</span>
                  </div>
                  <button
                    onClick={() => removeGear(item.id)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Add Gear</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={newGearCategory}
                onChange={(e) => setNewGearCategory(e.target.value as FotoaiGearCategory)}
                className="h-11 px-3 border border-border bg-background text-foreground rounded-md text-sm"
              >
                <option value="camera">Camera</option>
                <option value="lens">Lens</option>
                <option value="tripod">Tripod</option>
                <option value="light">Light</option>
                <option value="other">Other</option>
              </select>
              <Input
                value={newGearBrand}
                onChange={(e) => setNewGearBrand(e.target.value)}
                placeholder="Brand"
                className="h-11"
              />
              <Input
                value={newGearModel}
                onChange={(e) => setNewGearModel(e.target.value)}
                placeholder="Model"
                className="h-11"
              />
              <Button onClick={addGear} className="h-11 bg-foreground text-background hover:bg-primary">
                Add
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
