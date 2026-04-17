/**
 * ZorgaanbiedersPage - Map-Enhanced Provider Network Overview
 * 
 * Split-screen layout with:
 * - Left (60%): Provider list with filters and stats
 * - Right (40%): Interactive map showing provider locations
 * 
 * Features:
 * - Geographical overview of provider network
 * - Capacity and specialization filtering
 * - Map ↔ list interaction
 * - Provider profile navigation
 */

import { useState, useMemo } from "react";
import { 
  Search,
  SlidersHorizontal,
  Building2,
  MapPin,
  Star,
  Users,
  Clock,
  Maximize2,
  Navigation,
  Filter,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "../ui/button";
import { mockProviders } from "../../lib/casesData";

// AI Components
import { SystemInsight } from "../ai";

export function ZorgaanbiedersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const [mapView, setMapView] = useState<"split" | "full">("split");
  
  // Filters
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCapacity, setSelectedCapacity] = useState<string>("all");

  // Filter providers
  const filteredProviders = useMemo(() => {
    return mockProviders.filter(p => {
      const matchesSearch = searchQuery === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.specializations && p.specializations.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const matchesRegion = selectedRegion === "all" || p.region === selectedRegion;
      const matchesType = selectedType === "all" || p.type === selectedType;
      const matchesCapacity = selectedCapacity === "all" ||
        (selectedCapacity === "available" && p.availableSpots > 2) ||
        (selectedCapacity === "limited" && p.availableSpots > 0 && p.availableSpots <= 2) ||
        (selectedCapacity === "full" && p.availableSpots === 0);
      
      return matchesSearch && matchesRegion && matchesType && matchesCapacity;
    });
  }, [searchQuery, selectedRegion, selectedType, selectedCapacity]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: mockProviders.length,
      availableCapacity: mockProviders.reduce((acc, p) => acc + p.availableSpots, 0),
      avgRating: (mockProviders.reduce((acc, p) => acc + p.rating, 0) / mockProviders.length).toFixed(1),
      avgResponseTime: Math.round(mockProviders.reduce((acc, p) => acc + p.responseTime, 0) / mockProviders.length)
    };
  }, []);

  const getCapacityColor = (spots: number) => {
    if (spots > 2) return "text-green-500 bg-green-500/10 border-green-500/30";
    if (spots > 0) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-red-500 bg-red-500/10 border-red-500/30";
  };

  const getCapacityLabel = (spots: number) => {
    if (spots > 2) return `${spots} plekken`;
    if (spots > 0) return `${spots} plek${spots > 1 ? 'ken' : ''}`;
    return "Geen capaciteit";
  };

  const getCapacityIcon = (spots: number) => {
    if (spots > 2) return CheckCircle2;
    if (spots > 0) return Clock;
    return AlertCircle;
  };

  return (
    <div className="h-full flex flex-col">
      {/* HEADER */}
      <div className="p-6 border-b border-border bg-card">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Zorgaanbieders
          </h1>
          <p className="text-sm text-muted-foreground">
            {mockProviders.length} zorgaanbieders in het netwerk
          </p>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="premium-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Totaal aanbieders</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Beschikbare capaciteit</p>
            <p className="text-2xl font-bold text-green-500">{stats.availableCapacity}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Gem. beoordeling</p>
            <div className="flex items-center gap-1.5">
              <p className="text-2xl font-bold text-foreground">{stats.avgRating}</p>
              <Star className="text-amber-500 fill-amber-500" size={16} />
            </div>
          </div>
          <div className="premium-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Gem. reactietijd</p>
            <p className="text-2xl font-bold text-foreground">{stats.avgResponseTime}u</p>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Zoek op naam, specialisatie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={18} className="mr-2" />
            Filters
          </Button>
          <Button
            variant="outline"
            onClick={() => setMapView(mapView === "split" ? "full" : "split")}
          >
            <Maximize2 size={18} />
          </Button>
        </div>

        {/* FILTERS PANEL */}
        {showFilters && (
          <div className="mt-4 premium-card p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Regio</label>
                <select 
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                >
                  <option value="all">Alle regio's</option>
                  <option value="Amsterdam">Amsterdam</option>
                  <option value="Utrecht">Utrecht</option>
                  <option value="Rotterdam">Rotterdam</option>
                  <option value="Den Haag">Den Haag</option>
                  <option value="Eindhoven">Eindhoven</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Type</label>
                <select 
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="all">Alle types</option>
                  <option value="Residentiële zorg">Residentieel</option>
                  <option value="Ambulante begeleiding">Ambulant</option>
                  <option value="Dagbehandeling">Dagbehandeling</option>
                  <option value="Thuisbegeleiding">Thuisbegeleiding</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Capaciteit</label>
                <select 
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  value={selectedCapacity}
                  onChange={(e) => setSelectedCapacity(e.target.value)}
                >
                  <option value="all">Alle</option>
                  <option value="available">Beschikbaar (3+)</option>
                  <option value="limited">Beperkt (1-2)</option>
                  <option value="full">Vol</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SPLIT VIEW */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Provider List (60%) */}
        <div className={`${mapView === "split" ? "w-[60%]" : "w-full"} overflow-y-auto p-6 space-y-4`}>
          
          {/* AI Insight */}
          {filteredProviders.some(p => p.availableSpots === 0) && (
            <SystemInsight
              message="5 aanbieders hebben geen directe capaciteit. Overweeg uitbreiding zoekradius of contacteer aanbieders voor wachtlijst."
              type="info"
            />
          )}

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            {filteredProviders.length} {filteredProviders.length === 1 ? 'aanbieder' : 'aanbieders'} gevonden
          </p>

          {/* Provider Cards */}
          {filteredProviders.map((provider) => {
            const isSelected = selectedProvider === provider.id;
            const isHovered = hoveredProvider === provider.id;

            return (
              <div
                key={provider.id}
                className={`premium-card p-6 cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-primary shadow-lg' : ''
                } ${
                  isHovered ? 'bg-card/80 shadow-md' : ''
                }`}
                onClick={() => setSelectedProvider(provider.id)}
                onMouseEnter={() => setHoveredProvider(provider.id)}
                onMouseLeave={() => setHoveredProvider(null)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="text-primary" size={24} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-foreground mb-1">{provider.name}</h3>
                        <p className="text-sm text-muted-foreground">{provider.type}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-md border font-semibold text-xs flex items-center gap-1.5 ${getCapacityColor(provider.availableSpots)}`}>
                    {(() => {
                      const CapacityIcon = getCapacityIcon(provider.availableSpots);
                      return <CapacityIcon size={14} />;
                    })()}
                    {getCapacityLabel(provider.availableSpots)}
                  </div>
                </div>

                {/* Specialties */}
                {provider.specializations && provider.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {provider.specializations.slice(0, 3).map((specialty, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs font-medium"
                      >
                        {specialty}
                      </span>
                    ))}
                    {provider.specializations.length > 3 && (
                      <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                        +{provider.specializations.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <MapPin className="text-muted-foreground" size={16} />
                    <div>
                      <p className="text-xs text-muted-foreground">Regio</p>
                      <p className="text-sm font-medium text-foreground">{provider.region}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="text-muted-foreground" size={16} />
                    <div>
                      <p className="text-xs text-muted-foreground">Reactietijd</p>
                      <p className="text-sm font-medium text-foreground">{provider.responseTime}u</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="text-amber-500 fill-amber-500" size={16} />
                    <div>
                      <p className="text-xs text-muted-foreground">Beoordeling</p>
                      <p className="text-sm font-medium text-foreground">{provider.rating}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {filteredProviders.length === 0 && (
            <div className="premium-card p-12 text-center">
              <Building2 className="mx-auto mb-4 text-muted-foreground" size={48} />
              <p className="text-lg font-semibold text-foreground mb-2">Geen aanbieders gevonden</p>
              <p className="text-sm text-muted-foreground">
                Probeer een andere zoekopdracht of pas de filters aan
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Map View (40%) */}
        {mapView === "split" && (
          <div className="w-[40%] border-l border-border bg-muted/30 relative overflow-hidden">
            {/* Map Container */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Placeholder Map */}
              <div className="text-center">
                <MapPin className="mx-auto mb-4 text-muted-foreground" size={64} />
                <p className="text-lg font-semibold text-foreground mb-2">Kaartweergave</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Geografische weergave van {filteredProviders.length} aanbieders
                </p>
                
                {/* Mock Map Pins */}
                <div className="mt-6 flex justify-center gap-4">
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-full bg-green-500 mx-auto mb-1 flex items-center justify-center">
                      <MapPin className="text-white" size={16} />
                    </div>
                    <p className="text-xs text-muted-foreground">Beschikbaar</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-full bg-amber-500 mx-auto mb-1 flex items-center justify-center">
                      <MapPin className="text-white" size={16} />
                    </div>
                    <p className="text-xs text-muted-foreground">Beperkt</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-full bg-red-500 mx-auto mb-1 flex items-center justify-center">
                      <MapPin className="text-white" size={16} />
                    </div>
                    <p className="text-xs text-muted-foreground">Vol</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-card shadow-md"
              >
                <Navigation size={16} />
              </Button>
            </div>

            {/* Selected Provider Info */}
            {selectedProvider && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="premium-card p-4 shadow-lg">
                  {(() => {
                    const provider = filteredProviders.find(p => p.id === selectedProvider);
                    if (!provider) return null;
                    
                    return (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-foreground">{provider.name}</h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProvider(null);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{provider.type}</p>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getCapacityColor(provider.availableSpots)}`}>
                            {getCapacityLabel(provider.availableSpots)}
                          </span>
                          <Button size="sm" variant="default">
                            Bekijk profiel
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}