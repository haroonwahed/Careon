# CareOn Operational Constitution v2

Plain-text export of [`Careon_Operational_Constitution_v2.docx`](./Careon_Operational_Constitution_v2.docx) for diffs and search. **Authoritative formatting and sign-off:** the Word document. **Persisted workflow states, API `phase` keys, mutation endpoints, and decision-engine rules:** [`FOUNDATION_LOCK.md`](./FOUNDATION_LOCK.md).

---

**Status**

Authoritative operational doctrine for the CareOn platform.

**Supersedes:**
	•	Zorg_OS_Product_System_Core_v1_3
	•	Zorg_OS_Technical_Foundation_v1_3
	•	CareOn Design Constitution V1

1. Core Positioning
CareOn is not a generic SaaS platform.
CareOn is a regulated operational coordination layer for care allocation under scarcity.
The platform exists to:
	•	reduce placement friction
	•	reduce coordination delay
	•	improve decision quality
	•	improve visibility across the care chain
	•	preserve accountability
	•	coordinate humane progression through constrained systems
The system should feel like:
	•	operational infrastructure
	•	coordinated orchestration
	•	trusted governmental tooling
	•	calm control under pressure
Not:
	•	CRM software
	•	generic workflow tooling
	•	KPI dashboard software
	•	startup automation tooling
	•	marketplace gimmicks

2. Operational Philosophy
2.1 Regie First
CareOn is a regielaag across municipalities, providers, coordinators and placement actors.
Every screen must answer:
	•	What is the current operational reality?
	•	What requires attention?
	•	What decision is needed?
	•	What is the next best action?
The platform must reduce uncertainty.
The system should continuously support:
	•	triage
	•	routing
	•	escalation
	•	prioritization
	•	coordination
	•	progression

2.2 Controlled Scarcity
CareOn assumes scarcity is real.
The system is built around:
	•	limited placements
	•	limited provider capacity
	•	waiting lists
	•	financial constraints
	•	arrangement constraints
	•	regional constraints
	•	urgency trade-offs
The platform must never imply unlimited availability.
Operational truth is more important than optimistic UX.

2.3 Human Judgment Over Automation
Automation supports decisions.
Automation does not replace accountability.
The system may:
	•	summarize
	•	prioritize
	•	recommend
	•	score
	•	route
	•	identify conflicts
But humans remain responsible for:
	•	approvals
	•	placements
	•	escalations
	•	financial decisions
	•	arrangement decisions
	•	care suitability

3. Canonical Workflow
3.1 Canonical Flow
The canonical operational flow is:
Casus → Samenvatting → Matching → Gemeente Validatie → Aanbieder Beoordeling → Plaatsing → Intake
The workflow order must always remain visible.
No step skipping.
No hidden progression.
No ambiguous state transitions.

3.2 State Integrity
Workflow states are enforced by the backend.
The frontend never determines truth.
The backend is the operational source of truth.
Every state transition must:
	•	validate permissions
	•	validate workflow order
	•	validate required data
	•	create audit events
	•	preserve historical traceability
If state integrity cannot be guaranteed:
	•	progression must stop
	•	escalation must occur
	•	the system must remain truthful

3.3 Operational Phases
Each phase exists for a distinct operational purpose.
Casus
Initial registration and intake framing.
Samenvatting
Operational synthesis of the situation.
Matching
Identification of potentially suitable providers.
Gemeente Validatie
Municipality evaluates financial and policy feasibility.
Aanbieder Beoordeling
Provider evaluates operational suitability and capacity.
Plaatsing
Placement coordination and confirmation.
Intake
Transfer into operational care execution.

4. Arrangementen System
4.1 Definition
Arrangementen are municipality-defined care products.
An arrangement consists of:
	•	care type
	•	product code
	•	financial structure
	•	budget constraints
	•	policy constraints
	•	operational conditions
Arrangementen determine:
	•	what care may be provided
	•	under which financial conditions
	•	by which provider types
	•	under which duration or scope constraints

4.2 Arrangement Governance
Arrangementen are controlled by municipalities.
Providers cannot redefine arrangement structures.
The municipality remains responsible for:
	•	arrangement approval
	•	arrangement validation
	•	budget responsibility
	•	financial continuity
	•	policy compliance

4.3 Arrangement Visibility
Operational users must understand:
	•	active arrangement
	•	arrangement limitations
	•	budget implications
	•	approval status
	•	conflicts or mismatches
The UI must communicate this clearly.
Arrangement complexity should feel manageable.
Not bureaucratic.

4.4 Matching and Arrangement Compatibility
Matching recommendations must include:
	•	arrangement compatibility
	•	budget feasibility
	•	provider qualification
	•	region compatibility
	•	urgency trade-offs
	•	waiting list implications
Matching is advisory.
Not authoritative.
Every recommendation must explain:
	•	why this provider fits
	•	what conflicts exist
	•	what trade-offs exist
	•	what risks remain

5. Role Model
5.1 Municipality
Municipalities are:
	•	financial authorities
	•	policy authorities
	•	regie actors
	•	coordination authorities
Municipalities:
	•	validate arrangement feasibility
	•	oversee progression
	•	evaluate escalations
	•	monitor waiting pressure
	•	approve financial transitions
	•	maintain oversight
Municipalities are not placement marketplaces.

5.2 Zorgaanbieder
Providers are operational care executors.
Providers:
	•	evaluate placements
	•	manage available capacity
	•	manage waiting lists
	•	assess suitability
	•	coordinate intake
	•	progress placements
Providers may offer:
	•	placement availability
	•	waiting list positions
	•	intake planning
	•	placement conditions
Providers do not control:
	•	municipality policy
	•	arrangement governance
	•	financial authority

5.3 Clientaanbieders
Both municipalities and providers may introduce cases into the system.
Both can function as clientaanbieders.
The distinction:
	•	municipalities coordinate demand
	•	providers coordinate operational care execution
Only providers manage placement capacity.

6. Visibility and Security
6.1 Controlled Visibility
Providers only see:
	•	linked cases
	•	relevant requests
	•	actionable information
	•	authorized operational data
Visibility is explicit.
Never assumed.

6.2 PlacementRequest Principle
Provider visibility activates only after a formal operational link exists.
This typically occurs through:
	•	placement requests
	•	matching progression
	•	municipality coordination
	•	explicit provider involvement
The system must reinforce:
	•	controlled visibility
	•	trust
	•	contextual access
	•	operational legitimacy

6.3 API Security
The API is authoritative.
The UI is not security.
Every endpoint must enforce:
	•	role validation
	•	tenant isolation
	•	workflow authorization
	•	object-level permissions
	•	state integrity

7. Audit and Accountability
7.1 Audit Requirements
Every operational action must be traceable.
Audit events include:
	•	state transitions
	•	approvals
	•	rejections
	•	escalations
	•	placement actions
	•	arrangement decisions
	•	intake progression
	•	visibility changes

7.2 Timeline Philosophy
Timelines exist to:
	•	explain progression
	•	support accountability
	•	reduce ambiguity
	•	preserve operational trust
Timelines should feel:
	•	calm
	•	chronological
	•	operational
	•	trustworthy
Not:
	•	noisy
	•	overly technical
	•	overwhelming

8. Regiekamer Philosophy
8.1 Purpose
The Regiekamer is the operational coordination center.
It exists for:
	•	triage
	•	prioritization
	•	escalation handling
	•	operational oversight
	•	next-best-action coordination
The Regiekamer is not a KPI dashboard.

8.2 Workload Semantics
Operational workload should feel:
	•	prioritized
	•	coordinated
	•	manageable
	•	structured
Avoid:
	•	dashboard chaos
	•	widget overload
	•	analytics clutter
	•	visual pressure

8.3 Operational Attention
The system should continuously surface:
	•	blocked cases
	•	waiting approvals
	•	matching delays
	•	placement pressure
	•	intake risks
	•	arrangement conflicts
Attention surfaces must remain calm.
Not alarming.

9. UX Constitution
9.1 Design Personality
The product should feel:
	•	calm
	•	premium
	•	trustworthy
	•	operational
	•	restrained
	•	deliberate
	•	modern
Avoid:
	•	loud SaaS aesthetics
	•	excessive gradients
	•	neon interfaces
	•	playful startup patterns
	•	cluttered enterprise density

9.2 One Dominant Next Best Action
Every operational surface must communicate:
	•	what matters now
	•	what happens next
	•	which action is primary
Rules:
	•	one dominant CTA
	•	no fake actions
	•	no decorative workflow buttons
	•	no competing primary actions
GOOD:
	•	Start matching
	•	Vraag informatie op
	•	Plan intake
	•	Los blokkade op
	•	Rond plaatsing af
BAD:
	•	Analyseer workflow
	•	Prioriteer werkvoorraad
	•	Bekijk aandacht
	•	Genereer samenvatting

9.3 System Tasks vs Human Tasks
If the system performs an operation automatically:
	•	show status
	•	show progression
	•	do not expose as fake manual labor
GOOD:
	•	Samenvatting wordt verwerkt
	•	Matching gereed
	•	Arrangement gevalideerd
BAD:
	•	Genereer samenvatting
	•	Start AI matching
	•	Analyseer dossier

9.4 Controlled Complexity
The product should communicate:
	•	sophisticated orchestration
	•	operational control
	•	layered coordination
Without becoming:
	•	visually overwhelming
	•	bureaucratic
	•	dense enterprise software
Complexity should feel manageable.

9.5 Progressive Disclosure
Operational interfaces should reveal complexity progressively.
Users should first understand:
	•	current state
	•	current risk
	•	next action
Secondary detail should expand only when needed.

9.6 Empty States
Empty states must:
	•	explain the situation
	•	reduce uncertainty
	•	clarify next steps
	•	preserve operational calm
Avoid:
	•	generic placeholders
	•	empty dashboard language
	•	decorative filler

9.7 Escalation Semantics
Escalations should feel:
	•	important
	•	contained
	•	actionable
	•	operational
Not:
	•	dramatic
	•	alarming
	•	chaotic

10. Visual Language
10.1 Color System
Primary Background:
	•	deep navy
	•	near-black
	•	controlled tonal depth
Accent:
	•	restrained purple
	•	subtle glow
	•	operational emphasis
Semantic Colors:
	•	muted green for completion
	•	muted amber for waiting states
	•	muted red for blockers
	•	slate neutrals for operational surfaces
Avoid:
	•	bright traffic-light colors
	•	oversaturated UI
	•	excessive glow

10.2 Surface Hierarchy
The interface should communicate depth through:
	•	subtle contrast
	•	elevation restraint
	•	layered operational focus
Avoid:
	•	excessive borders
	•	hard separators
	•	card overload

10.3 Typography
Typography should feel:
	•	editorial
	•	spacious
	•	readable
	•	confident
	•	operational
Avoid:
	•	tiny enterprise labels
	•	oversized hero shouting
	•	compressed layouts

10.4 Motion
Motion should communicate:
	•	progression
	•	orchestration
	•	routing
	•	responsiveness
Preferred motion:
	•	soft fades
	•	subtle elevation
	•	restrained transitions
Avoid:
	•	bouncing
	•	flashy transitions
	•	playful motion

11. Product Behavior Rules
11.1 Workflow Integrity
The user should instantly understand:
	•	current phase
	•	current ownership
	•	next operational step
	•	blockers
	•	waiting dependencies
The workflow must never feel magical.

11.2 Pilot Credibility
The system must remain operationally truthful.
Never fake:
	•	automation
	•	live operational claims
	•	provider activity
	•	municipality behavior
	•	AI intelligence
	•	placement certainty
Operational trust is more important than perceived sophistication.

11.3 Role Separation
The system should continuously reinforce:
	•	role boundaries
	•	authority boundaries
	•	operational ownership
	•	visibility boundaries
Users should understand:
	•	who owns the current decision
	•	who acts next
	•	who is waiting

12. Technical Constitution
12.1 Backend Authority
The backend is the source of truth.
Frontend state is advisory.
The API determines:
	•	workflow validity
	•	permissions
	•	visibility
	•	progression
	•	audit integrity

12.2 State Machine Enforcement
Workflow states are enforced centrally.
No client-side bypassing.
No direct progression skipping.
Every transition validates:
	•	current state
	•	role authorization
	•	required conditions
	•	arrangement constraints
	•	operational consistency

12.3 Reliability
The platform should prioritize:
	•	stability
	•	auditability
	•	recoverability
	•	deterministic behavior
	•	operational consistency
Over:
	•	flashy interactivity
	•	frontend complexity
	•	novelty

12.4 Error Philosophy
Errors should:
	•	explain reality clearly
	•	preserve calmness
	•	identify the operational issue
	•	communicate next action
Avoid:
	•	cryptic errors
	•	technical panic messaging
	•	blame-oriented language

13. Non-Negotiables
Never:
	•	break workflow order
	•	expose unauthorized visibility
	•	fake operational intelligence
	•	overload operational surfaces
	•	create dashboard chaos
	•	mix product philosophies
	•	introduce decorative complexity
	•	create multiple competing CTAs
	•	hide operational ownership
	•	treat care coordination like generic SaaS
Always:
	•	preserve trust
	•	preserve clarity
	•	preserve workflow integrity
	•	preserve calmness
	•	preserve accountability
	•	preserve progression
	•	preserve operational truth
	•	preserve role boundaries

14. Final Principle
CareOn should feel like:
A calm operational control layer for critical care coordination under constrained conditions.
Every design decision, workflow, interaction, API rule, and operational surface must support:
	•	trust
	•	coordination
	•	clarity
	•	accountability
	•	progression
	•	humane operational flow
If a feature increases noise without increasing clarity:
Remove it.
