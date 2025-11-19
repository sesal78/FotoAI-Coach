
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Camera, 
  TrendingUp, 
  MapPin, 
  Calendar, 
  Award,
  Cloud,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
  Send
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Challenge {
  id: string;
  challengeText: string;
  category: string;
  difficulty: string;
  duration: string;
  tips: string;
  recommendedGear: string[];
  weatherConditions?: string;
  location?: string;
  status: string;
  issuedDate: string;
  submissions?: any[];
}

interface UserProgress {
  totalChallengesCompleted: number;
  totalChallengesIssued: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  favoriteSubjects: string[];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [recentChallenges, setRecentChallenges] = useState<Challenge[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Submission form state
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<number>(0);

  useEffect(() => {
    // Load dashboard data on mount (no auth required for single-user demo)
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);

      // For demo purposes, use a hardcoded user ID
      // In production, this would come from the session
      const userId = '1';

      // Load current challenge
      const challengesRes = await fetch(`/api/challenges?userId=${userId}&status=pending&limit=1`);
      const challengesData = await challengesRes.json();
      
      if (challengesData.challenges && challengesData.challenges.length > 0) {
        setCurrentChallenge(challengesData.challenges[0]);
      }

      // Load progress
      const progressRes = await fetch(`/api/progress?userId=${userId}`);
      const progressData = await progressRes.json();
      setProgress(progressData.progress);

      // Load recent challenges
      const recentRes = await fetch(`/api/challenges?userId=${userId}&status=all&limit=5`);
      const recentData = await recentRes.json();
      setRecentChallenges(recentData.challenges || []);

    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function generateNewChallenge() {
    try {
      setGenerating(true);
      toast.info('Generating your personalized challenge...');

      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '1', // Demo user ID
          challengeType: 'WEEKEND_DEEP_DIVE',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentChallenge(data.challenge);
        toast.success('New challenge generated!');
        await loadDashboardData();
      } else {
        toast.error(data.error || 'Failed to generate challenge');
      }
    } catch (error) {
      console.error('Challenge generation failed:', error);
      toast.error('Failed to generate challenge');
    } finally {
      setGenerating(false);
    }
  }

  async function submitChallenge() {
    if (!currentChallenge) return;

    try {
      setSubmitting(true);
      toast.info('Submitting your challenge...');

      const formData = new FormData();
      formData.append('challengeId', currentChallenge.id);
      formData.append('userId', '1'); // Demo user ID
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
        
        // Reset form
        setPhoto(null);
        setNotes('');
        setRating(0);
        setCurrentChallenge(null);
        
        // Reload dashboard
        await loadDashboardData();
      } else {
        toast.error(data.error || 'Failed to submit challenge');
      }
    } catch (error) {
      console.error('Submission failed:', error);
      toast.error('Failed to submit challenge');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your photography journey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome back, Seun! 📸</h1>
        <p className="text-muted-foreground">Your personal photography coaching dashboard</p>
      </div>

      {/* Progress Stats */}
      {progress && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{progress.totalChallengesCompleted}</div>
              <p className="text-xs text-muted-foreground">of {progress.totalChallengesIssued} challenges</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center gap-2">
                {progress.currentStreak} 🔥
              </div>
              <p className="text-xs text-muted-foreground">Longest: {progress.longestStreak} days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{progress.completionRate}%</div>
              <Progress value={progress.completionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top Styles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {progress.favoriteSubjects.slice(0, 3).map((subject) => (
                  <Badge key={subject} variant="secondary" className="text-xs">
                    {subject}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="challenge" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="challenge">Current Challenge</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
        </TabsList>

        {/* Current Challenge Tab */}
        <TabsContent value="challenge" className="space-y-6">
          {currentChallenge ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">Today's Challenge</CardTitle>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="default">{currentChallenge.category}</Badge>
                      <Badge variant="secondary">{currentChallenge.difficulty}</Badge>
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        {currentChallenge.duration}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Your Mission:</h3>
                  <p className="text-lg leading-relaxed">{currentChallenge.challengeText}</p>
                </div>

                {currentChallenge.tips && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Pro Tips:</strong> {currentChallenge.tips}
                    </AlertDescription>
                  </Alert>
                )}

                {currentChallenge.recommendedGear.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Recommended Gear:</h3>
                    <div className="flex flex-wrap gap-2">
                      {currentChallenge.recommendedGear.map((gear, index) => (
                        <Badge key={index} variant="outline">
                          <Camera className="w-3 h-3 mr-1" />
                          {gear}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {currentChallenge.weatherConditions && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Cloud className="w-4 h-4" />
                    <span>{currentChallenge.weatherConditions}</span>
                    {currentChallenge.location && (
                      <>
                        <MapPin className="w-4 h-4 ml-2" />
                        <span>{currentChallenge.location}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Submission Form */}
                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Submit Your Challenge</h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Upload Photo (Optional)</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                    />
                    {photo && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {photo.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Notes & Reflections</label>
                    <Textarea
                      placeholder="Share your experience, what you learned, challenges you faced..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Rate Your Experience</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={`text-2xl ${rating >= star ? 'text-yellow-500' : 'text-gray-300'}`}
                        >
                          ⭐
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={submitChallenge}
                    disabled={submitting}
                    className="w-full"
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
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Active Challenge</CardTitle>
                <CardDescription>
                  Generate a new photography challenge tailored to your schedule and interests.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={generateNewChallenge}
                  disabled={generating}
                  size="lg"
                  className="w-full"
                >
                  {generating ? 'Generating...' : 'Generate New Challenge'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Challenges</CardTitle>
              <CardDescription>Your photography journey so far</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentChallenges.length > 0 ? (
                recentChallenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{challenge.category}</Badge>
                        <Badge
                          variant={
                            challenge.status === 'completed'
                              ? 'default'
                              : challenge.status === 'skipped'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {challenge.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {challenge.status}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(challenge.issuedDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm">{challenge.challengeText}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No challenges yet. Generate your first one!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Itinerary Tab */}
        <TabsContent value="itinerary">
          <Card>
            <CardHeader>
              <CardTitle>Photography Itineraries</CardTitle>
              <CardDescription>
                Generate location-based photo tours (Coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Itinerary generation feature will be added in the next update!</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
