# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: care-visual-regression.spec.ts >> Care list visual regression (SPA) >> Nieuwe casus: intake bootstrap, privacy copy, and submit redirect
- Location: tests/e2e/care-visual-regression.spec.ts:217:3

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.fill: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByPlaceholder('CLI-88314')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - complementary [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - img [ref=e9]
        - generic [ref=e11]:
          - heading "CareOn" [level=1] [ref=e12]
          - paragraph [ref=e13]: Zorg OS
      - button "Collapse sidebar" [ref=e14]:
        - img [ref=e15]
    - navigation "Hoofdnavigatie" [ref=e17]:
      - generic [ref=e18]:
        - generic [ref=e19]: REGIE
        - generic [ref=e20]:
          - button "Regiekamer" [ref=e21]:
            - img [ref=e22]
            - generic [ref=e28]: Regiekamer
          - button "Casussen 4" [ref=e29]:
            - img [ref=e30]
            - generic [ref=e34]: Casussen
            - generic [ref=e35]: "4"
          - button "Acties 1" [ref=e36]:
            - img [ref=e37]
            - generic [ref=e41]: Acties
            - generic [ref=e42]: "1"
      - generic [ref=e43]:
        - generic [ref=e44]: KETEN
        - generic [ref=e45]:
          - button "Matching 1" [ref=e46]:
            - img [ref=e47]
            - generic [ref=e52]: Matching
            - generic [ref=e53]: "1"
          - button "Aanbieder beoordeling 1" [ref=e54]:
            - img [ref=e55]
            - generic [ref=e60]: Aanbieder beoordeling
            - generic [ref=e61]: "1"
          - button "Plaatsingen 1" [ref=e62]:
            - img [ref=e63]
            - generic [ref=e67]: Plaatsingen
            - generic [ref=e68]: "1"
      - generic [ref=e69]:
        - generic [ref=e70]: NETWERK
        - generic [ref=e71]:
          - button "Zorgaanbieders" [ref=e72]:
            - img [ref=e73]
            - generic [ref=e78]: Zorgaanbieders
          - button "Gemeenten" [ref=e79]:
            - img [ref=e80]
            - generic [ref=e84]: Gemeenten
          - button "Regio's" [ref=e85]:
            - img [ref=e86]
            - generic [ref=e89]: Regio's
      - generic [ref=e90]:
        - generic [ref=e91]: BEHEER
        - generic [ref=e92]:
          - button "Documenten" [ref=e93]:
            - img [ref=e94]
            - generic [ref=e97]: Documenten
          - button "Audittrail" [ref=e98]:
            - img [ref=e99]
            - generic [ref=e104]: Audittrail
          - button "Instellingen" [ref=e105]:
            - img [ref=e106]
            - generic [ref=e110]: Instellingen
    - generic [ref=e111]:
      - generic [ref=e112]: STURING
      - button "Signalen 1" [ref=e113]:
        - img [ref=e114]
        - generic [ref=e117]: Signalen
        - generic [ref=e118]: "1"
    - generic [ref=e120] [cursor=pointer]:
      - generic [ref=e122]: JD
      - generic [ref=e123]:
        - paragraph [ref=e124]: Jane Doe
        - paragraph [ref=e125]: Regisseur
  - generic [ref=e126]:
    - banner [ref=e127]:
      - button "Gemeente Utrecht" [ref=e130]:
        - img [ref=e132]
        - generic [ref=e135]:
          - generic [ref=e136]:
            - generic [ref=e137]: Gemeente
            - img [ref=e138]
          - paragraph [ref=e140]: Utrecht
      - generic [ref=e142]:
        - img
        - searchbox "Zoek casussen, cliënten, aanbieders…" [ref=e143]
        - generic: ⌘K
      - generic [ref=e144]:
        - button "Switch to dark mode" [ref=e145]:
          - img [ref=e146]
        - button "Notifications" [ref=e149]:
          - img [ref=e150]
        - button "EG E2E Gemeente Regisseur" [ref=e155]:
          - generic [ref=e157]: EG
          - generic [ref=e158]:
            - paragraph [ref=e159]: E2E Gemeente
            - paragraph [ref=e160]: Regisseur
          - img [ref=e161]
    - main [ref=e163]:
      - generic [ref=e166]:
        - generic [ref=e167]:
          - generic [ref=e168]:
            - generic [ref=e169]:
              - text: Intake
              - img [ref=e170]
              - text: Nieuwe casus
            - generic [ref=e172]:
              - heading "Nieuwe casus" [level=1] [ref=e173]
              - button "Toelichting" [expanded] [ref=e174]:
                - img [ref=e175]
                - text: Toelichting
                - img [ref=e178]
          - button "Terug" [ref=e181]:
            - img
            - text: Terug
        - generic [ref=e182]:
          - paragraph [ref=e183]: Vul alleen kerngegevens in; details blijven in het bronsysteem.
          - paragraph [ref=e184]: Velden met * zijn verplicht.
        - generic [ref=e185]:
          - generic [ref=e186]:
            - generic [ref=e187]:
              - generic [ref=e188]: Stap 1 van 3
              - generic [ref=e189]: 33%
            - generic [ref=e190]:
              - 'button "Stap 1: Basis" [ref=e191]':
                - generic [ref=e192]: Stap 1
                - generic [ref=e193]: Basis
              - 'button "Stap 2: Zorgvraag" [disabled] [ref=e194]':
                - generic [ref=e195]: Stap 2
                - generic [ref=e196]: Zorgvraag
              - 'button "Stap 3: Randvoorwaarden" [disabled] [ref=e197]':
                - generic [ref=e198]: Stap 3
                - generic [ref=e199]: Randvoorwaarden
            - progressbar "Voortgang nieuwe casus" [ref=e200]
          - generic [ref=e202]:
            - generic [ref=e203]:
              - generic [ref=e204]: "1"
              - generic [ref=e205]:
                - generic [ref=e206]:
                  - heading "Bronregistratie koppelen" [level=2] [ref=e207]
                  - button "Info" [expanded] [active] [ref=e208]:
                    - img [ref=e209]
                    - text: Info
                    - img [ref=e212]
                - paragraph [ref=e214]: Start een regiecasus gekoppeld aan een bronregistratie. CareOn bewaart alleen minimale referentiegegevens voor ketencoördinatie.
            - generic [ref=e215]:
              - generic [ref=e216]: Bronregistratie *
              - combobox "Bronregistratie *" [ref=e217]:
                - option "Selecteer bronregistratie" [selected]
                - option "Gemeente Den Haag"
                - option "Jeugdplatform"
                - option "Veilig Thuis"
                - option "Zorgmail Intake"
                - option "Handmatige Regiecasus"
            - generic [ref=e218]:
              - generic [ref=e219]:
                - generic [ref=e220]: Zoek bronreferentie *
                - textbox "Zoek bronreferentie *" [ref=e221]:
                  - /placeholder: Bijv. ZS-2026-8821
                - paragraph [ref=e222]: Alleen minimale referentie voor ketenregie.
              - generic [ref=e223]:
                - generic [ref=e224]: CareOn casusreferentie
                - textbox [ref=e225]: CO-2026-2678
                - paragraph [ref=e226]: Automatisch gegenereerd.
            - generic [ref=e227]:
              - generic [ref=e228]:
                - generic [ref=e229]: Startdatum casus *
                - button "Startdatum casus *" [ref=e230]:
                  - generic [ref=e231]: 08-05-2026
                  - img [ref=e232]
              - generic [ref=e234]:
                - generic [ref=e235]:
                  - generic [ref=e236]: Deadline matching *
                  - button "Deadline matching *" [ref=e237]:
                    - generic [ref=e238]: 15-05-2026
                    - img [ref=e239]
                - generic [ref=e241]:
                  - button "3 dagen" [ref=e242]
                  - button "7 dagen" [ref=e243]
                  - button "14 dagen" [ref=e244]
            - generic [ref=e245]:
              - paragraph [ref=e246]: Visibility notice
              - paragraph [ref=e247]: Persoonsgegevens blijven in het bronsysteem tot formele koppeling of intake.
        - generic [ref=e249]:
          - button "Terug" [ref=e250]:
            - img
            - text: Terug
          - button "Volgende" [ref=e252]:
            - text: Volgende
            - img
```

# Test source

```ts
  127 |     await maybeDump(page, "casussen-desktop");
  128 | 
  129 |     const rows = page.locator('[data-testid="worklist"] [data-care-work-row]');
  130 |     await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  131 |     const heights = await rows.evaluateAll((els) => els.slice(0, 10).map((el) => el.getBoundingClientRect().height));
  132 |     expect(maxMinusMin(heights)).toBeLessThan(36);
  133 | 
  134 |     await page.setViewportSize({ width: 390, height: 900 });
  135 |     await expect(page.getByRole("heading", { name: /^Casussen$/i })).toBeVisible({ timeout: 30_000 });
  136 |     const firstRow = page.locator('[data-testid="worklist"] [data-care-work-row]').first();
  137 |     await expect(firstRow).toBeVisible({ timeout: 30_000 });
  138 |     await expect(firstRow.locator('[data-component="care-meta-chip"]').first()).toBeVisible();
  139 |     await maybeDump(page, "casussen-mobile");
  140 |     await page.setViewportSize({ width: 1280, height: 900 });
  141 |   });
  142 | 
  143 |   test("Matching: rows or empty state", async ({ page }) => {
  144 |     await goSidebar(page, "Matching");
  145 |     await expect(page.getByRole("heading", { name: /^Matching$/i })).toBeVisible({ timeout: 30_000 });
  146 |     await maybeDump(page, "matching-desktop");
  147 |     const rows = page.locator('article[data-density="compact"]');
  148 |     const empty = page.getByText("Geen casussen in matching");
  149 |     if (await empty.isVisible().catch(() => false)) {
  150 |       await expect(page.getByText(/Zodra samenvatting/i)).toBeVisible();
  151 |       return;
  152 |     }
  153 |     await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  154 |     expect(maxMinusMin(await rows.evaluateAll((els) => els.slice(0, 8).map((el) => el.getBoundingClientRect().height)))).toBeLessThan(36);
  155 |   });
  156 | 
  157 |   test("Plaatsingen: tabs + rows or empty", async ({ page }) => {
  158 |     await goSidebar(page, "Plaatsingen");
  159 |     await expect(page.getByRole("heading", { name: /Plaatsingen/i })).toBeVisible({ timeout: 30_000 });
  160 |     await maybeDump(page, "plaatsingen-desktop");
  161 |     await expect(page.getByRole("tab", { name: /Te bevestigen/i })).toBeVisible();
  162 |     const rows = page.locator('article[data-density="compact"]');
  163 |     if ((await rows.count()) === 0) {
  164 |       await expect(page.getByText("Geen plaatsingen in dit overzicht")).toBeVisible();
  165 |       return;
  166 |     }
  167 |     await expect(rows.first()).toBeVisible();
  168 |   });
  169 | 
  170 |   test("Aanbieder beoordeling: rows or empty", async ({ page }) => {
  171 |     await goSidebar(page, "Aanbieder beoordeling");
  172 |     await expect(page.getByRole("heading", { name: /Aanbieder beoordeling/i })).toBeVisible({ timeout: 30_000 });
  173 |     await maybeDump(page, "beoordeling-desktop");
  174 |     const rows = page.locator('article[data-density="compact"]');
  175 |     if ((await rows.count()) === 0) {
  176 |       await expect(page.getByText("Geen casussen in deze fase")).toBeVisible();
  177 |       return;
  178 |     }
  179 |     await expect(rows.first()).toBeVisible();
  180 |     expect(maxMinusMin(await rows.evaluateAll((els) => els.slice(0, 8).map((el) => el.getBoundingClientRect().height)))).toBeLessThan(36);
  181 |   });
  182 | 
  183 |   test("Acties: sidebar badge matches open CareTask count (stub)", async ({ page }) => {
  184 |     const actiesNav = page.getByRole("navigation").getByRole("button", { name: /Acties/i }).first();
  185 |     await expect(actiesNav).toContainText("1");
  186 |     await goSidebar(page, "Acties");
  187 |     await expect(page.locator('article[data-density="compact"]')).toHaveCount(1);
  188 |   });
  189 | 
  190 |   test("Acties: leading icon + row shell when tasks exist", async ({ page }) => {
  191 |     await goSidebar(page, "Acties");
  192 |     await expect(page.getByRole("heading", { name: /^Acties$/i })).toBeVisible({ timeout: 30_000 });
  193 |     await maybeDump(page, "acties-desktop");
  194 |     const rows = page.locator('article[data-density="compact"]');
  195 |     const count = await rows.count();
  196 |     if (count === 0) {
  197 |       await expect(page.getByText("Geen openstaande acties")).toBeVisible();
  198 |       return;
  199 |     }
  200 |     const first = rows.first();
  201 |     await expect(first.locator("svg").first()).toBeVisible();
  202 |     const aligned = await first.evaluate((row) => {
  203 |       const el = row as HTMLElement;
  204 |       const lead = el.querySelector("[class*='mt-0.5'][class*='shrink-0']") as HTMLElement | null;
  205 |       /** Title stack — must not match the outer `flex-1` row wrapper (also has min-w-0 flex-1). */
  206 |       const title = el.querySelector(".min-w-0.flex-1.space-y-1") as HTMLElement | null;
  207 |       if (!lead || !title) {
  208 |         return false;
  209 |       }
  210 |       const lr = lead.getBoundingClientRect();
  211 |       const tr = title.getBoundingClientRect();
  212 |       return lr.right <= tr.left + 10;
  213 |     });
  214 |     expect(aligned, "leading icon column should sit left of title block").toBe(true);
  215 |   });
  216 | 
  217 |   test("Nieuwe casus: intake bootstrap, privacy copy, and submit redirect", async ({ page }) => {
  218 |     await page.goto(new URL("/casussen/nieuw", SPA_BASE).toString(), { waitUntil: "domcontentloaded" });
  219 |     await expect(page.getByRole("heading", { name: /^Nieuwe casus$/i })).toBeVisible({ timeout: 30_000 });
  220 |     await expect(page.getByRole("button", { name: "Toelichting" })).toBeVisible();
  221 | 
  222 |     await page.getByRole("button", { name: "Toelichting" }).click();
  223 |     await expect(page.getByText("Vul alleen kerngegevens in; details blijven in het bronsysteem.")).toBeVisible();
  224 |     await page.getByRole("button", { name: "Info" }).click();
  225 |     await expect(page.getByText("Velden met * zijn verplicht.")).toBeVisible();
  226 | 
> 227 |     await page.getByPlaceholder("CLI-88314").fill("CLI-12345");
      |                                              ^ Error: locator.fill: Test timeout of 90000ms exceeded.
  228 |     await page.getByRole("button", { name: "Volgende" }).click();
  229 |     await expect(page.getByRole("heading", { name: "Zorgvraag" })).toBeVisible();
  230 |     await page.getByRole("combobox").first().selectOption("ggz");
  231 |     await page.getByRole("button", { name: "Volgende" }).click();
  232 |     await expect(page.getByRole("heading", { name: "Randvoorwaarden" })).toBeVisible();
  233 | 
  234 |     await page.getByRole("button", { name: "Casus aanmaken" }).click();
  235 |     await page.waitForURL(/\/care\/cases\/99\/?$/, { timeout: 30_000 });
  236 |   });
  237 | 
  238 |   test("Design system: unified shell on Regiekamer, Casussen, Matching, Acties, Signalen", async ({ page }) => {
  239 |     await expect(page.getByRole("heading", { name: /Regiekamer/i })).toBeVisible();
  240 |     await expect(page.getByTestId("regiekamer-phase-board")).toBeVisible();
  241 |     await expect(page.getByPlaceholder(/Zoek casus, naam of type/i)).toBeVisible();
  242 | 
  243 |     await goSidebar(page, "Casussen");
  244 |     await expect(page.getByRole("heading", { name: /^Casussen$/i })).toBeVisible();
  245 |     await expect(page.getByPlaceholder(/Zoek casussen, cliënten, aanbieders/i)).toBeVisible();
  246 | 
  247 |     await goSidebar(page, "Matching");
  248 |     await expect(page.getByRole("heading", { name: /^Matching$/i })).toBeVisible();
  249 |     await expect(page.getByPlaceholder(/Zoek casus, client of regio/i)).toBeVisible();
  250 | 
  251 |     await goSidebar(page, "Acties");
  252 |     await expect(page.getByRole("heading", { name: /^Acties$/i })).toBeVisible();
  253 |     await expect(page.getByPlaceholder(/Zoek acties of casus ID/i)).toBeVisible();
  254 | 
  255 |     await goSidebar(page, "Signalen");
  256 |     await expect(page.getByRole("heading", { name: /^Signalen$/i })).toBeVisible();
  257 |     await expect(page.getByPlaceholder(/Zoek signalen\.\.\./i)).toBeVisible();
  258 |   });
  259 | });
  260 | 
  261 | function maxMinusMin(heights: number[]): number {
  262 |   if (heights.length === 0) {
  263 |     return 0;
  264 |   }
  265 |   return Math.max(...heights) - Math.min(...heights);
  266 | }
  267 | 
```