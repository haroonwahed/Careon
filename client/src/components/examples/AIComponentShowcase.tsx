/**
 * AI Component Showcase
 * 
 * Visual demonstration of all AI decision intelligence components
 * Use this page to preview and test all AI components together
 */

import { 
  AanbevolenActie,
  Risicosignalen,
  Samenvatting,
  MatchExplanation,
  SystemInsight,
  AIInsightPanel
} from "../ai";

export function AIComponentShowcase() {
  return (
    <div className="min-h-screen bg-background p-8 space-y-12">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          AI Decision Intelligence Layer
        </h1>
        <p className="text-muted-foreground">
          Component showcase voor de Careon Zorgregie platform
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Section 1: Aanbevolen Actie */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            1. Aanbevolen Actie
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Primary decision card with recommended action
          </p>
          
          <div className="space-y-4">
            {/* Default variant */}
            <AanbevolenActie
              title="Start matching proces"
              explanation="Beoordeling is compleet en alle vereiste gegevens zijn aanwezig. Systeem heeft 3 potentiële matches geïdentificeerd in de regio."
              actionLabel="Start matching"
              confidence="high"
              onAction={() => console.log("Action clicked")}
            />

            {/* Urgent variant */}
            <AanbevolenActie
              title="Escaleer naar capaciteitsmanager"
              explanation="Geen geschikte aanbieders beschikbaar in de regio. Directe actie vereist om wachttijd te voorkomen."
              actionLabel="Escaleer case"
              confidence="high"
              variant="urgent"
              onAction={() => console.log("Urgent action clicked")}
            />

            {/* Medium confidence */}
            <AanbevolenActie
              title="Overweeg alternatief zorgtype"
              explanation="Huidige zorgvraag heeft beperkte matches. Overweeg aanpassing van zorgtype voor betere resultaten."
              actionLabel="Bekijk alternatieven"
              confidence="medium"
              onAction={() => console.log("Alternative action clicked")}
            />
          </div>
        </section>

        {/* Section 2: Risicosignalen */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            2. Risicosignalen
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Compact warning component for risk detection
          </p>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Multiple signals */}
            <Risicosignalen
              signals={[
                {
                  severity: "critical",
                  message: "Geen beschikbare capaciteit in regio Amsterdam"
                },
                {
                  severity: "warning",
                  message: "Urgente casus met reactietijd boven 6 uur"
                },
                {
                  severity: "info",
                  message: "Monitor wekelijks voor mogelijke escalatie"
                }
              ]}
            />

            {/* Compact version */}
            <Risicosignalen
              signals={[
                {
                  severity: "warning",
                  message: "Beoordeling loopt 3 dagen vertraging op"
                },
                {
                  severity: "info",
                  message: "Wachtlijst voor groepstherapie is 2-3 weken"
                }
              ]}
              compact
            />
          </div>
        </section>

        {/* Section 3: Samenvatting */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            3. Samenvatting
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Clean summary panel with bullet points
          </p>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Default */}
            <Samenvatting
              title="Casus samenvatting"
              items={[
                { text: "15 jaar, woonachtig in Amsterdam", type: "default" },
                { text: "Zorgvraag: Intensieve Ambulante Begeleiding", type: "info" },
                { text: "Hoge urgentie - spoedtraject vereist", type: "warning" },
                { text: "Beoordeling compleet en goedgekeurd", type: "success" }
              ]}
            />

            {/* Compact */}
            <Samenvatting
              title="Intake briefing"
              items={[
                { text: "Complexe gedragsproblematiek", type: "info" },
                { text: "Trauma-geïnformeerde aanpak nodig", type: "warning" },
                { text: "Start binnen 3 werkdagen", type: "success" }
              ]}
              compact
            />
          </div>
        </section>

        {/* Section 4: MatchExplanation */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            4. Match Explanation
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Explains WHY a provider match was selected
          </p>
          
          <div className="grid grid-cols-3 gap-6">
            {/* High confidence match */}
            <MatchExplanation
              score={94}
              strengths={[
                "Specialisatie match",
                "3 plekken beschikbaar",
                "Reactie binnen 4u"
              ]}
              confidence="high"
            />

            {/* Medium match with tradeoffs */}
            <MatchExplanation
              score={78}
              strengths={[
                "Goede match voor zorgvraag",
                "8 plekken vrij",
                "Hoge rating (4.6)"
              ]}
              tradeoffs={[
                "Reactietijd 12u",
                "Minder ervaring met complexe cases"
              ]}
              confidence="medium"
            />

            {/* Lower match */}
            <MatchExplanation
              score={62}
              strengths={[
                "Hoogste rating (4.8)",
                "Perfecte specialisatie"
              ]}
              tradeoffs={[
                "Geen capaciteit beschikbaar",
                "Wachttijd 2-3 weken"
              ]}
              confidence="low"
            />
          </div>
        </section>

        {/* Section 5: SystemInsight */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            5. System Insight
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Inline feedback strips for quick insights
          </p>
          
          <div className="space-y-3 max-w-2xl">
            <SystemInsight
              type="info"
              message="Beoordeling gepland voor 18 april met Dr. P. Bakker"
            />

            <SystemInsight
              type="success"
              message="3 potentiële matches gevonden - match score range 78-94%"
            />

            <SystemInsight
              type="warning"
              message="Urgente casus - reactietijd van aanbieder is boven gewenste 6 uur"
            />

            <SystemInsight
              type="blocked"
              message="Matching geblokkeerd door ontbrekende beoordeling"
            />

            <SystemInsight
              type="suggestion"
              message="Overweeg parallelle intake bij top 2 matches om wachttijd te minimaliseren"
            />
          </div>
        </section>

        {/* Section 6: Full Layout Example */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            6. Complete Layout Pattern
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            3-column grid with AI layer integration
          </p>
          
          <div className="space-y-6">
            {/* Top: Recommended Action */}
            <AanbevolenActie
              title="Start matching proces"
              explanation="Beoordeling is compleet. Systeem heeft 3 potentiële matches geïdentificeerd."
              actionLabel="Start matching"
              confidence="high"
              onAction={() => console.log("Start matching")}
            />

            {/* 3-Column Grid */}
            <div className="grid grid-cols-12 gap-6">
              
              {/* Left: Case Info (4 cols) */}
              <div className="col-span-4">
                <div className="premium-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">
                    Casus informatie
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Case ID</p>
                      <p className="font-medium">C-2026-0847</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cliënt</p>
                      <p className="font-medium">Tim de Groot</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Regio</p>
                      <p className="font-medium">Amsterdam</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center: Summary + Work Area (5 cols) */}
              <div className="col-span-5 space-y-4">
                <Samenvatting
                  title="Casus samenvatting"
                  items={[
                    { text: "15 jaar, woonachtig in Amsterdam", type: "default" },
                    { text: "Zorgvraag: Intensieve Ambulante Begeleiding", type: "info" },
                    { text: "Hoge urgentie - spoedtraject vereist", type: "warning" }
                  ]}
                />

                <SystemInsight
                  type="success"
                  message="Beoordeling compleet - klaar voor matching"
                />

                <div className="premium-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Werkgebied
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Main workflow content here...
                  </p>
                </div>
              </div>

              {/* Right: AI Insights Panel (3 cols) */}
              <div className="col-span-3">
                <AIInsightPanel title="Beslissingsondersteuning">
                  <Risicosignalen
                    signals={[
                      {
                        severity: "warning",
                        message: "Urgente casus met beperkte capaciteit"
                      }
                    ]}
                    compact
                  />

                  <div className="premium-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      Procesvoortgang
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Intake</span>
                        <span className="text-green-400 font-semibold">Compleet</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Beoordeling</span>
                        <span className="text-green-400 font-semibold">Compleet</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Matching</span>
                        <span className="text-primary font-semibold">Actief</span>
                      </div>
                    </div>
                  </div>
                </AIInsightPanel>
              </div>
            </div>
          </div>
        </section>

        {/* Design System Reference */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            Design System Reference
          </h2>
          
          <div className="grid grid-cols-5 gap-4">
            <div className="premium-card p-4 bg-purple-500/5 border-2 border-purple-500/30">
              <div className="w-12 h-12 rounded-lg bg-purple-500 mb-3" />
              <p className="text-sm font-semibold text-foreground">Purple</p>
              <p className="text-xs text-muted-foreground">Actions</p>
            </div>

            <div className="premium-card p-4 bg-red-500/5 border-2 border-red-500/30">
              <div className="w-12 h-12 rounded-lg bg-red-500 mb-3" />
              <p className="text-sm font-semibold text-foreground">Red</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>

            <div className="premium-card p-4 bg-amber-500/5 border-2 border-amber-500/30">
              <div className="w-12 h-12 rounded-lg bg-amber-500 mb-3" />
              <p className="text-sm font-semibold text-foreground">Amber</p>
              <p className="text-xs text-muted-foreground">Warning</p>
            </div>

            <div className="premium-card p-4 bg-blue-500/5 border-2 border-blue-500/30">
              <div className="w-12 h-12 rounded-lg bg-blue-500 mb-3" />
              <p className="text-sm font-semibold text-foreground">Blue</p>
              <p className="text-xs text-muted-foreground">Info</p>
            </div>

            <div className="premium-card p-4 bg-green-500/5 border-2 border-green-500/30">
              <div className="w-12 h-12 rounded-lg bg-green-500 mb-3" />
              <p className="text-sm font-semibold text-foreground">Green</p>
              <p className="text-xs text-muted-foreground">Success</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
