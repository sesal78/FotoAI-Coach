'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppwriteAuth } from '@/hooks/useAppwriteAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Camera,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Target,
  Check,
} from 'lucide-react';

const STEPS = ['Welcome', 'Skill & Interests', 'Location', 'Gear'] as const;

const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'Just getting started with photography' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Comfortable with basics, learning more' },
  { value: 'advanced', label: 'Advanced', desc: 'Strong technical skills, refining style' },
  { value: 'professional', label: 'Professional', desc: 'Working photographer, mastering craft' },
];

const INTEREST_OPTIONS = [
  'street', 'portrait', 'landscape', 'architecture', 'nature',
  'abstract', 'documentary', 'travel', 'macro', 'night',
  'food', 'fashion', 'sports', 'wildlife', 'urban',
];

const GEAR_PRESETS = [
  { category: 'camera', brand: 'Sony', model: 'A7 IV' },
  { category: 'camera', brand: 'Canon', model: 'R6 II' },
  { category: 'camera', brand: 'Nikon', model: 'Z6 III' },
  { category: 'camera', brand: 'Fujifilm', model: 'X-T5' },
  { category: 'camera', brand: 'iPhone', model: '15 Pro' },
  { category: 'camera', brand: 'Samsung', model: 'Galaxy S24 Ultra' },
  { category: 'camera', brand: 'Google', model: 'Pixel 8 Pro' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, status } = useAppwriteAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [skillLevel, setSkillLevel] = useState('intermediate');
  const [interests, setInterests] = useState<string[]>(['street', 'portrait', 'architecture']);
  const [homeLocation, setHomeLocation] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [selectedGear, setSelectedGear] = useState<typeof GEAR_PRESETS>([]);
  const [customGearBrand, setCustomGearBrand] = useState('');
  const [customGearModel, setCustomGearModel] = useState('');

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    if (typeof window !== 'undefined') window.location.href = '/signup';
    return null;
  }

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  }

  function toggleGearPreset(preset: (typeof GEAR_PRESETS)[number]) {
    setSelectedGear((prev) => {
      const exists = prev.some((g) => g.brand === preset.brand && g.model === preset.model);
      return exists
        ? prev.filter((g) => !(g.brand === preset.brand && g.model === preset.model))
        : [...prev, preset];
    });
  }

  function addCustomGear() {
    if (!customGearBrand.trim() || !customGearModel.trim()) return;
    setSelectedGear((prev) => [
      ...prev,
      { category: 'camera', brand: customGearBrand.trim(), model: customGearModel.trim() },
    ]);
    setCustomGearBrand('');
    setCustomGearModel('');
  }

  async function finishOnboarding() {
    if (!user?.id) return;
    setSaving(true);

    try {
      // Save preferences
      await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          skillLevel,
          photographyInterests: interests,
          homeLocation: homeLocation || null,
          currentLocation: currentLocation || null,
        }),
      });

      // Save gear items in parallel
      await Promise.all(
        selectedGear.map((gear) =>
          fetch('/api/settings/gear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, ...gear }),
          }),
        ),
      );

      toast.success('Profile set up! Let\'s start shooting.');
      router.replace('/dashboard');
    } catch (err) {
      console.error('Onboarding save failed:', err);
      toast.error('Failed to save — you can update later in Settings.');
      router.replace('/dashboard');
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    if (step === STEPS.length - 1) {
      finishOnboarding();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  function handleSkip() {
    router.replace('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 transition-colors duration-300 ${
                  i <= step ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 pt-24 pb-32">
        <div className="w-full max-w-2xl">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight display-font mb-4">
                Welcome to <span className="text-primary">Foto</span>,{' '}
                {user?.name?.split(' ')[0] || 'Photographer'}
              </h1>
              <p className="text-lg text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                Let&apos;s set up your profile so we can generate challenges perfectly suited to your
                skill level, interests, and gear.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left">
                {[
                  { icon: Target, label: 'Personalised challenges' },
                  { icon: MapPin, label: 'Location-aware tours' },
                  { icon: Camera, label: 'Gear-tailored tips' },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 p-3 border border-border bg-accent/30"
                  >
                    <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Skill & Interests */}
          {step === 1 && (
            <div>
              <h2 className="text-3xl font-bold tracking-tight display-font mb-2">
                Your photography level
              </h2>
              <p className="text-muted-foreground mb-8">
                This helps us calibrate challenge difficulty and coaching style.
              </p>

              <div className="space-y-3 mb-10">
                {SKILL_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setSkillLevel(level.value)}
                    className={`w-full text-left p-4 border-2 transition-all flex items-center justify-between ${
                      skillLevel === level.value
                        ? 'border-primary bg-accent'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{level.label}</div>
                      <div className="text-sm text-muted-foreground">{level.desc}</div>
                    </div>
                    {skillLevel === level.value && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <h3 className="text-xl font-semibold display-font mb-2">What do you like to shoot?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Pick at least 2 — we&apos;ll tailor your challenges to these.
              </p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 border text-sm capitalize transition-all ${
                      interests.includes(interest)
                        ? 'border-primary bg-primary text-white'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight display-font mb-2">
                Where do you shoot?
              </h2>
              <p className="text-muted-foreground mb-8">
                We&apos;ll use this for weather-aware challenges and location-based photo tours.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Home Location</label>
                  <Input
                    value={homeLocation}
                    onChange={(e) => setHomeLocation(e.target.value)}
                    placeholder="e.g., Melbourne, Australia"
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Used for weather data and local challenge suggestions
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Current Location <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input
                    value={currentLocation}
                    onChange={(e) => setCurrentLocation(e.target.value)}
                    placeholder="e.g., Melbourne CBD"
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Set this if you&apos;re travelling or shooting somewhere different
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Gear */}
          {step === 3 && (
            <div>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight display-font mb-2">
                What&apos;s in your bag?
              </h2>
              <p className="text-muted-foreground mb-8">
                Challenges will be tailored to your gear. You can always update this later.
              </p>

              {/* Quick-select presets */}
              <div className="space-y-3 mb-8">
                <label className="block text-sm font-medium text-muted-foreground">Quick Select</label>
                <div className="flex flex-wrap gap-2">
                  {GEAR_PRESETS.map((preset) => {
                    const isSelected = selectedGear.some(
                      (g) => g.brand === preset.brand && g.model === preset.model,
                    );
                    return (
                      <button
                        key={`${preset.brand}-${preset.model}`}
                        onClick={() => toggleGearPreset(preset)}
                        className={`px-4 py-2 border text-sm transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'border-primary bg-primary text-white'
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        {preset.brand} {preset.model}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom gear */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-muted-foreground">
                  Or add your own
                </label>
                <div className="flex gap-2">
                  <Input
                    value={customGearBrand}
                    onChange={(e) => setCustomGearBrand(e.target.value)}
                    placeholder="Brand"
                    className="h-11 flex-1"
                  />
                  <Input
                    value={customGearModel}
                    onChange={(e) => setCustomGearModel(e.target.value)}
                    placeholder="Model"
                    className="h-11 flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addCustomGear()}
                  />
                  <Button
                    onClick={addCustomGear}
                    variant="outline"
                    className="h-11"
                    disabled={!customGearBrand.trim() || !customGearModel.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Selected gear summary */}
              {selectedGear.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <label className="block text-sm font-medium text-muted-foreground mb-3">
                    Your Gear ({selectedGear.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedGear.map((g, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="py-1.5 px-3 text-sm cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() =>
                          setSelectedGear((prev) =>
                            prev.filter(
                              (p) => !(p.brand === g.brand && p.model === g.model),
                            ),
                          )
                        }
                      >
                        <Camera className="w-3 h-3 mr-1.5" />
                        {g.brand} {g.model}
                        <span className="ml-1.5 opacity-50">&times;</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={saving || (step === 1 && interests.length < 2)}
            className="gap-2 bg-foreground text-background hover:bg-primary font-semibold px-8"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                Saving...
              </span>
            ) : step === STEPS.length - 1 ? (
              <>
                Finish Setup
                <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
