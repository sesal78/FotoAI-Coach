
'use client';

import { useState } from 'react';
import { useAppwriteAuth } from '@/hooks/useAppwriteAuth';
import {
  usePendingChallenge,
  useUserProgress,
  useRecentChallenges,
  useItineraries,
  useInvalidateDashboard,
} from '@/hooks/use-dashboard-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Camera,
  MapPin,
  Cloud,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Mail
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user: session, status: sessionStatus } = useAppwriteAuth();

  // React Query hooks — auto-fetch when userId is available
  const { data: currentChallenge, isLoading: challengeLoading } = usePendingChallenge(session?.id);
  const { data: progress } = useUserProgress(session?.id);
  const { data: recentChallenges = [] } = useRecentChallenges(session?.id);
  const { data: itineraries = [], isLoading: itinerariesLoading } = useItineraries(session?.id);
  const invalidateDashboard = useInvalidateDashboard();

  // UI / form state (not server data)
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);

  // Submission form state
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [selectedChallengeType, setSelectedChallengeType] = useState<string>('WEEKEND_DEEP_DIVE');

  // Itinerary state
  const [generatingItinerary, setGeneratingItinerary] = useState(false);
  const [itineraryLocation, setItineraryLocation] = useState('Melbourne CBD');
  const [itineraryDuration, setItineraryDuration] = useState('2-3 hours');

  // Challenge type options
  const challengeTypes = [
    { value: 'WEEKEND_DEEP_DIVE', label: '🌅 Weekend Deep Dive', description: '2-4 hours of comprehensive exploration' },
    { value: 'LUNCH_BREAK', label: '🥪 Lunch Break', description: '30-45 min quick creative burst' },
    { value: 'AFTER_WORK', label: '🌆 After Work', description: '1-2 hours golden hour session' },
    { value: 'WFH_MICRO', label: '🏠 WFH Micro', description: '15-20 min creative break at home' },
  ];

  async function generateNewChallenge() {
    try {
      setGenerating(true);
      toast.info('Generating your personalized challenge...');

      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.id,
          challengeType: selectedChallengeType,
          forceGenerate: true,
        }),
        cache: 'no-store',
      });

      const data = await response.json();
      console.log('🎯 Generated challenge:', data);

      if (response.ok) {
        const challenge = data.challenge;

        // Immediate localStorage cache (before React Query refetches)
        localStorage.setItem('currentChallenge', JSON.stringify(challenge));
        console.log('✅ New challenge generated and cached');

        toast.success('New challenge generated!');

        // Invalidate all dashboard queries so React Query refetches
        invalidateDashboard();
      } else {
        console.error('Challenge generation failed:', data);
        toast.error(data.error || 'Failed to generate challenge');
      }
    } catch (error) {
      console.error('Challenge generation failed:', error);
      toast.error('Failed to generate challenge. Check console for details.');
    } finally {
      setGenerating(false);
    }
  }

  async function emailChallenge() {
    if (!currentChallenge) return;

    try {
      setEmailing(true);
      toast.info('Sending challenge to your email...');

      const response = await fetch('/api/challenges/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeText: currentChallenge.challengeText,
          category: currentChallenge.category,
          difficulty: currentChallenge.difficulty,
          duration: currentChallenge.duration,
          tips: currentChallenge.tips,
          recommendedGear: currentChallenge.recommendedGear,
          location: currentChallenge.location,
          weatherConditions: currentChallenge.weatherConditions,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Challenge sent to your email! 📧');
      } else {
        toast.error(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Email failed:', error);
      toast.error('Failed to send email');
    } finally {
      setEmailing(false);
    }
  }

  async function submitChallenge() {
    if (!currentChallenge) return;

    try {
      setSubmitting(true);
      toast.info('Submitting your challenge...');

      const formData = new FormData();
      formData.append('challengeId', currentChallenge.id);
      formData.append('userId', session?.id || '');
      formData.append('notes', notes);
      formData.append('rating', rating.toString());
      
      if (photo) {
        formData.append('photo', photo);
      }

      const response = await fetch('/api/submissions', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Challenge submitted! 🎉');
        toast.success(data.submission.feedback || 'Great work!');

        // Clear localStorage cache
        localStorage.removeItem('currentChallenge');
        console.log('✅ Challenge completed and cache cleared');

        // Reset form
        setPhoto(null);
        setNotes('');
        setRating(0);

        // Invalidate all dashboard queries so React Query refetches
        invalidateDashboard();
      } else {
        toast.error(data.error || 'Failed to submit challenge');
      }
    } catch (error) {
      console.error('Submission failed:', error);
      toast.error('Failed to submit challenge. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  async function skipChallenge() {
    if (!currentChallenge) return;

    try {
      setSubmitting(true);
      toast.info('Skipping challenge...');

      const response = await fetch(`/api/challenges/${currentChallenge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'skipped'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Challenge skipped. Ready for a new one!');

        // Clear localStorage cache
        localStorage.removeItem('currentChallenge');
        console.log('✅ Challenge skipped and cache cleared');

        // Reset form
        setPhoto(null);
        setNotes('');
        setRating(0);

        // Invalidate all dashboard queries so React Query refetches
        invalidateDashboard();
      } else {
        toast.error(data.error || 'Failed to skip challenge');
      }
    } catch (error) {
      console.error('Skip failed:', error);
      toast.error('Failed to skip challenge. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  async function generateItineraryHandler() {
    try {
      setGeneratingItinerary(true);
      toast.info('Generating your photo tour itinerary...');

      const response = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.id,
          location: itineraryLocation,
          duration: itineraryDuration,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Itinerary generated!');
        invalidateDashboard();
      } else {
        toast.error(data.error || 'Failed to generate itinerary');
      }
    } catch (error) {
      console.error('Itinerary generation failed:', error);
      toast.error('Failed to generate itinerary');
    } finally {
      setGeneratingItinerary(false);
    }
  }

  if (sessionStatus === 'loading' || (sessionStatus === 'authenticated' && challengeLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading your journey...</p>
        </div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-10 lg:mb-14">
          <span className="overline mb-3 block">Dashboard</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 display-font">
            Welcome back, <span className="text-primary">{session?.name?.split(' ')[0] || 'Photographer'}</span>
          </h1>
          <p className="text-muted-foreground text-lg">Your personal photography coaching dashboard</p>
        </div>

        {/* Progress Stats */}
        {progress && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10 lg:mb-14">
            <div className="editorial-card p-5 lg:p-6">
              <span className="overline mb-2 block">Completed</span>
              <div className="display-number text-3xl lg:text-4xl">{progress.totalChallengesCompleted}</div>
              <p className="text-sm text-muted-foreground mt-1">of {progress.totalChallengesIssued} challenges</p>
            </div>

            <div className="editorial-card p-5 lg:p-6">
              <span className="overline mb-2 block">Current Streak</span>
              <div className="display-number text-3xl lg:text-4xl flex items-baseline gap-2">
                {progress.currentStreak}
                <span className="text-2xl">🔥</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Longest: {progress.longestStreak} days</p>
            </div>

            <div className="editorial-card p-5 lg:p-6">
              <span className="overline mb-2 block">Completion Rate</span>
              <div className="display-number text-3xl lg:text-4xl">{progress.completionRate}%</div>
              <Progress value={progress.completionRate} className="mt-3 h-1.5" />
            </div>

            <div className="editorial-card p-5 lg:p-6">
              <span className="overline mb-2 block">Top Styles</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {progress.favoriteSubjects.slice(0, 3).map((subject) => (
                  <Badge key={subject} variant="secondary" className="text-xs font-medium">
                    {subject}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="challenge" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-muted p-1 h-auto">
            <TabsTrigger value="challenge" className="py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Current Challenge
            </TabsTrigger>
            <TabsTrigger value="history" className="py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              History
            </TabsTrigger>
            <TabsTrigger value="itinerary" className="py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Itinerary
            </TabsTrigger>
          </TabsList>

          {/* Current Challenge Tab */}
          <TabsContent value="challenge" className="space-y-6">
            {currentChallenge ? (
              <div className="editorial-card">
                <div className="p-6 lg:p-8 border-b border-border">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <span className="overline mb-2 block">Today&apos;s Challenge</span>
                      <h2 className="text-2xl lg:text-3xl font-bold tracking-tight display-font mb-4">Your Mission</h2>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-primary text-white">{currentChallenge.category}</Badge>
                        <Badge variant="secondary">{currentChallenge.difficulty}</Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {currentChallenge.duration}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 lg:p-8 space-y-6">
                  <div>
                    <p className="text-lg lg:text-xl leading-relaxed text-foreground">{currentChallenge.challengeText}</p>
                  </div>

                  {currentChallenge.tips && (
                    <div className="bg-accent/50 border border-accent p-4 flex gap-3">
                      <AlertCircle className="h-5 w-5 text-accent-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-accent-foreground">Pro Tips:</span>
                        <p className="text-foreground mt-1">{currentChallenge.tips}</p>
                      </div>
                    </div>
                  )}

                  {currentChallenge.recommendedGear.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Recommended Gear</h3>
                      <div className="flex flex-wrap gap-2">
                        {currentChallenge.recommendedGear.map((gear, index) => (
                          <Badge key={index} variant="outline" className="py-1.5 px-3">
                            <Camera className="w-3 h-3 mr-1.5" />
                            {gear}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentChallenge.weatherConditions && (
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4" />
                        <span>{currentChallenge.weatherConditions}</span>
                      </div>
                      {currentChallenge.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{currentChallenge.location}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submission Form */}
                  <div className="border-t border-border pt-8 mt-8 space-y-6">
                    <h3 className="text-xl font-semibold display-font">Submit Your Challenge</h3>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2 text-muted-foreground">Upload Photo (Optional)</label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                        className="h-12"
                      />
                      {photo && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Selected: {photo.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-muted-foreground">Notes & Reflections</label>
                      <Textarea
                        placeholder="Share your experience, what you learned, challenges you faced..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-3 text-muted-foreground">Rate Your Experience</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRating(star)}
                            className={`text-3xl transition-transform hover:scale-110 ${rating >= star ? 'text-primary' : 'text-border'}`}
                          >
                            ⭐
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button
                        onClick={submitChallenge}
                        disabled={submitting}
                        className="flex-1 h-12 bg-foreground text-background hover:bg-primary font-semibold tracking-wide"
                        size="lg"
                      >
                        {submitting ? (
                          <>Submitting...</>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Submit Challenge
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={emailChallenge}
                        disabled={emailing}
                        variant="secondary"
                        className="flex-1 h-12 font-semibold tracking-wide"
                        size="lg"
                      >
                        {emailing ? (
                          <>Sending...</>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Email
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={skipChallenge}
                        disabled={submitting}
                        variant="outline"
                        className="flex-1 h-12 font-semibold tracking-wide"
                        size="lg"
                      >
                        {submitting ? <>Processing...</> : <>Skip</>}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="editorial-card p-6 lg:p-8">
                <span className="overline mb-2 block">Get Started</span>
                <h2 className="text-2xl lg:text-3xl font-bold tracking-tight display-font mb-2">No Active Challenge</h2>
                <p className="text-muted-foreground mb-8">
                  Generate a new photography challenge tailored to your schedule and interests.
                </p>
                
                {/* Challenge Type Selector */}
                <div className="space-y-4 mb-8">
                  <label className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Choose Challenge Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {challengeTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setSelectedChallengeType(type.value)}
                        className={`p-5 border-2 text-left transition-all ${
                          selectedChallengeType === type.value
                            ? 'border-primary bg-accent'
                            : 'border-border hover:border-primary/50 bg-transparent'
                        }`}
                      >
                        <div className="font-semibold text-foreground">{type.label}</div>
                        <div className="text-sm text-muted-foreground mt-1">{type.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <Button
                  onClick={generateNewChallenge}
                  disabled={generating}
                  size="lg"
                  className="w-full h-14 bg-foreground text-background hover:bg-primary font-semibold tracking-wide text-base"
                >
                  {generating ? 'Generating...' : `Generate ${challengeTypes.find(t => t.value === selectedChallengeType)?.label.split(' ').slice(1).join(' ')} Challenge`}
                </Button>
              </div>
            )}
            
            {/* Challenge Type Selector - Always Visible */}
            {currentChallenge && (
              <div className="editorial-card p-6 lg:p-8 mt-6">
                <span className="overline mb-2 block">Generate New</span>
                <h2 className="text-2xl font-bold tracking-tight display-font mb-4">Challenge Types</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {challengeTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedChallengeType(type.value)}
                      className={`p-4 border-2 text-left transition-all ${
                        selectedChallengeType === type.value
                          ? 'border-primary bg-accent'
                          : 'border-border hover:border-primary/50 bg-transparent'
                      }`}
                    >
                      <div className="font-semibold text-foreground">{type.label}</div>
                      <div className="text-sm text-muted-foreground mt-1">{type.description}</div>
                    </button>
                  ))}
                </div>
                
                <Button
                  onClick={generateNewChallenge}
                  disabled={generating}
                  size="lg"
                  className="w-full h-12 bg-foreground text-background hover:bg-primary font-semibold tracking-wide"
                >
                  {generating ? 'Generating...' : `Generate ${challengeTypes.find(t => t.value === selectedChallengeType)?.label.split(' ').slice(1).join(' ')} Challenge`}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <div className="editorial-card p-6 lg:p-8">
              <span className="overline mb-2 block">Your Journey</span>
              <h2 className="text-2xl font-bold tracking-tight display-font mb-6">Recent Challenges</h2>
              
              <div className="space-y-4">
                {recentChallenges.length > 0 ? (
                  recentChallenges.map((challenge) => (
                    <div
                      key={challenge.id}
                      className="border border-border p-5 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{challenge.category}</Badge>
                          <Badge
                            variant={
                              challenge.status === 'completed'
                                ? 'default'
                                : challenge.status === 'skipped'
                                ? 'secondary'
                                : 'outline'
                            }
                            className={challenge.status === 'completed' ? 'bg-primary' : ''}
                          >
                            {challenge.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {challenge.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground font-mono">
                          {new Date(challenge.issuedDate).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-foreground leading-relaxed">{challenge.challengeText}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No challenges yet. Generate your first one!</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Itinerary Tab */}
          <TabsContent value="itinerary" className="space-y-6">
            {/* Generate New Itinerary */}
            <div className="editorial-card p-6 lg:p-8">
              <span className="overline mb-2 block">Photo Tours</span>
              <h2 className="text-2xl font-bold tracking-tight display-font mb-2">Generate Itinerary</h2>
              <p className="text-muted-foreground mb-6">
                Create a personalized photography walking tour for any location.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">Location</label>
                  <Input
                    value={itineraryLocation}
                    onChange={(e) => setItineraryLocation(e.target.value)}
                    placeholder="e.g., Melbourne CBD, Fitzroy, St Kilda"
                    className="h-12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">Duration</label>
                  <select
                    value={itineraryDuration}
                    onChange={(e) => setItineraryDuration(e.target.value)}
                    className="w-full h-12 px-3 border border-border bg-background text-foreground rounded-md"
                  >
                    <option value="1-2 hours">1-2 hours</option>
                    <option value="2-3 hours">2-3 hours</option>
                    <option value="3-4 hours">3-4 hours</option>
                    <option value="Half day">Half day (4-6 hours)</option>
                    <option value="Full day">Full day</option>
                  </select>
                </div>
              </div>
              
              <Button
                onClick={generateItineraryHandler}
                disabled={generatingItinerary || !itineraryLocation}
                size="lg"
                className="w-full h-12 bg-foreground text-background hover:bg-primary font-semibold tracking-wide"
              >
                {generatingItinerary ? 'Generating...' : '📍 Generate Photo Tour'}
              </Button>
            </div>

            {/* Itinerary List */}
            <div className="editorial-card p-6 lg:p-8">
              <span className="overline mb-2 block">Your Tours</span>
              <h2 className="text-2xl font-bold tracking-tight display-font mb-6">Saved Itineraries</h2>
              
              {itineraries.length > 0 ? (
                <div className="space-y-4">
                  {itineraries.map((itinerary) => {
                    let spots = [];
                    try {
                      spots = typeof itinerary.spots === 'string' ? JSON.parse(itinerary.spots) : itinerary.spots;
                    } catch { spots = []; }
                    
                    return (
                      <div key={itinerary.id} className="border border-border p-5 hover:border-primary/50 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{itinerary.title}</h3>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {itinerary.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {itinerary.duration}
                              </span>
                              {itinerary.weatherConditions && (
                                <span className="flex items-center gap-1">
                                  <Cloud className="w-3 h-3" />
                                  {itinerary.weatherConditions}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">{spots.length || 0} spots</Badge>
                        </div>
                        
                        <p className="text-muted-foreground text-sm mb-4">{itinerary.description}</p>
                        
                        {spots.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Photo Spots</h4>
                            <div className="grid gap-2">
                              {spots.slice(0, 4).map((spot: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 bg-accent/30 p-3 text-sm">
                                  <span className="font-bold text-primary">{idx + 1}</span>
                                  <div>
                                    <span className="font-medium">{spot.name || spot.location}</span>
                                    {spot.description && (
                                      <p className="text-muted-foreground text-xs mt-1">{spot.description}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {spots.length > 4 && (
                                <p className="text-sm text-muted-foreground">+{spots.length - 4} more spots</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {itinerary.gearRecommendations?.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Recommended Gear</h4>
                            <div className="flex flex-wrap gap-2">
                              {itinerary.gearRecommendations.map((gear: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  <Camera className="w-3 h-3 mr-1" />
                                  {gear}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground mt-4">
                          Generated {new Date(itinerary.generatedDate).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-border">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No itineraries yet. Generate your first photo tour above!</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
