'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  MapPin, 
  Clock, 
  Camera, 
  Search,
  Loader2,
  Navigation,
  Sun,
  Users,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

interface Location {
  name: string;
  address: string;
  distance?: string;
  category?: string;
  bestTimes: string[];
  whatToShoot: string[];
  access?: string;
  crowdLevel?: string;
  permits?: string;
  tips: string;
}

interface LocationResult {
  locations: Location[];
  summary: string;
}

export default function LocationsPage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LocationResult | null>(null);
  const [curatedSpots, setCuratedSpots] = useState<LocationResult | null>(null);

  // Load curated spots on mount
  useEffect(() => {
    loadCuratedSpots();
  }, []);

  async function loadCuratedSpots() {
    try {
      const res = await fetch('/api/locations');
      if (res.ok) {
        const data = await res.json();
        setCuratedSpots(data);
      }
    } catch (error) {
      console.error('Failed to load curated spots:', error);
    }
  }

  async function searchLocations() {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      toast.info('Scouting locations...');

      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: query.trim(),
          location: 'Melbourne, Australia'
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
        toast.success(`Found ${data.locations?.length || 0} locations!`);
      } else {
        toast.error('Failed to search locations');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search locations');
    } finally {
      setSearching(false);
    }
  }

  function LocationCard({ location }: { location: Location }) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{location.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {location.address}
              </CardDescription>
            </div>
            {location.category && (
              <Badge variant="secondary">{location.category}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {location.distance && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Navigation className="w-4 h-4" />
              {location.distance}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Sun className="w-4 h-4" />
              Best Times
            </div>
            <div className="flex flex-wrap gap-1">
              {location.bestTimes.map((time, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {time}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Camera className="w-4 h-4" />
              What to Shoot
            </div>
            <div className="flex flex-wrap gap-1">
              {location.whatToShoot.map((subject, i) => (
                <Badge key={i} variant="default" className="text-xs">
                  {subject}
                </Badge>
              ))}
            </div>
          </div>

          {location.crowdLevel && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" />
              <span className="text-muted-foreground">Crowds:</span>
              {location.crowdLevel}
            </div>
          )}

          {location.access && (
            <div className="flex items-start gap-2 text-sm">
              <Navigation className="w-4 h-4 mt-0.5" />
              <span className="text-muted-foreground">{location.access}</span>
            </div>
          )}

          {location.permits && location.permits !== 'None' && (
            <div className="flex items-start gap-2 text-sm text-amber-600">
              <Info className="w-4 h-4 mt-0.5" />
              <span>{location.permits}</span>
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground italic">
              💡 {location.tips}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">🗺️ Photography Location Scout</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Find the perfect spots for your next photography adventure in Melbourne and beyond.
            Search for specific types of locations or browse our curated recommendations.
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Locations
            </CardTitle>
            <CardDescription>
              Describe what you&apos;re looking for - type of shots, lighting conditions, accessibility needs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g., Find quiet riverside locations within 45 minutes of Melbourne that work for sunrise reflections and long-exposure water shots, prioritizing spots with minimal crowds"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button 
              onClick={searchLocations} 
              disabled={searching}
              className="w-full sm:w-auto"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scouting...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Scout Locations
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Search Results */}
        {results && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Search Results</h2>
              <Badge variant="outline">{results.locations?.length || 0} locations found</Badge>
            </div>
            {results.summary && (
              <p className="text-muted-foreground">{results.summary}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.locations?.map((location, i) => (
                <LocationCard key={i} location={location} />
              ))}
            </div>
          </div>
        )}

        {/* Curated Spots */}
        {curatedSpots && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">⭐ Curated Melbourne Spots</h2>
            <p className="text-muted-foreground">{curatedSpots.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {curatedSpots.locations?.map((location, i) => (
                <LocationCard key={i} location={location} />
              ))}
            </div>
          </div>
        )}

        {/* Example Queries */}
        <Card>
          <CardHeader>
            <CardTitle>Example Searches</CardTitle>
            <CardDescription>Try these queries to find specific types of locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                'Quiet riverside spots for sunrise reflections',
                'Urban alleyways with street art for portraits',
                'Rooftop locations for cityscape photography',
                'Historic architecture for golden hour shots',
                'Markets with interesting characters and produce',
                'Coastal spots for long exposure seascapes'
              ].map((example, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuery(example)}
                  className="text-xs"
                >
                  {example}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
