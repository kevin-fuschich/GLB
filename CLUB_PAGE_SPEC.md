# GLB CLUB PAGE SPECIFICATION
Version 1.0 — Locked System Document

This document governs the design, content, and logic of all GLB Club Pages.
Deviation is not permitted without system-level revision.

---

## 1. Club Header Standard

**Established Line**
Format:
Est. [Year] • [Region/Country]

Style Rules:
- Typeface: Sans-serif (Helvetica / Arial)
- Size: 11px
- Case: Uppercase
- Tracking: letter-spacing: 2px
- Separator: &bull; (HTML bullet entity)

---

## 2. Image Philosophy — The Three Modes

Every club page must commit to **one and only one** image mode.
Mixing modes within a single page is forbidden.

Images must never feel like marketing assets.
They are treated as evidence — something found in a drawer.

### Option A: The Mark (Authority)

Used for clubs claiming institutional legitimacy or governance.

- Visual: Vector seal, stamp, or geometric insignia
- Tone: Official, restrained, emblematic
- CSS Class: `.club-mark`
- Width: 70px
- Format: SVG (preferred)

**Example Use Case:** San Pedro

---

### Option B: The Archive (Evidence)

Used for clubs grounded in history, geography, or place.

- Visual: Documentary photography (landscape, industrial, street)
- Content Rules:
  - No action shots
  - No posed subjects
  - No promotional framing
- Tone: Muted, black & white, or desaturated
- CSS Class: `.club-artifact`
- Width: 100px
- Format: JPG (high quality)

---

### Option C: The Artifact (Texture)

Used for clubs defined by material, labor, or industry.

- Visual: Macro textures or objects (steel, concrete, paint, wood)
- Tone: Abstract but immediately recognizable
- Purpose: Physical evidence, not illustration
- CSS Class: `.club-artifact`
- Width: 100px
- Format: JPG

**Example Use Case:** Birmingham

---

## 3. Writing Guidelines

### Tone & Voice

- Write like a historian, not a hype man
- Neutral, observational, grounded
- Avoid promotional language entirely

Rules:
- Use lowercase when referring to “the club” in narrative text
- Avoid adjectives like: passionate, electric, iconic, legendary
- Prefer concrete nouns:
  - iron, sugar, fog, steel, heat, light, labor

---

### Punctuation & Typography

- Smart quotes are mandatory:
  - “ ” and ‘ ’
- Periods belong **inside** quotation marks:
  - “The House That Sugar Built.”
- Em dashes (—) preferred over hyphens
- No exclamation points

---

### Titles & Naming

- H1 Title must use the **city name only**
  - Correct: Birmingham
  - Incorrect: Birmingham Vulcans
- Team names may appear in narrative context only

---

## 4. Required Section Structure

All club pages must include the following five sections, in this order.

---

### 1. Identity

Purpose:
Explain *why this club exists here*.

Required Content:
- Origin of the club name
- Cultural, geological, or historical logic of the location

Constraint:
- No on-field performance references

---

### 2. Grounds

Structure:
- Venue Name (bold)
- Location: City, Region/Country (sans-serif, uppercase)
- Descriptive paragraph

Focus Areas:
- Atmosphere
- Light
- Architecture
- Environmental conditions

Avoid:
- Seating capacity
- Amenities
- Fan experience language

---

### 3. Tradition

Purpose:
Define the club’s inherited philosophy.

Guiding Question:
How does the city’s character show up on the field?

Rules:
- No tactics diagrams
- No win-loss framing
- No mythology without grounding

---

### 4. Timeline

Format:
- Unordered list (`ul`)
- Two-column layout

Column Rules:
- Year column width: 110px (fixed)
- `white-space: nowrap` applied to year column

Content Rules:
- 3–5 entries maximum
- Focus on eras, origins, conditions
- Championships are optional, never required

---

### 5. Record Reference (Footer)

Exact Text:
“Official Statistics & Roster available in Team Record”

Link Target:
- Must link to the corresponding team page:
  - `team-[city].html`

Style:
- Sans-serif
- Uppercase
- Centered
- Quiet, non-promotional

---

## 5. Technical Specifications

### File Naming

- Club Page HTML:
  - `club-[city].html`
- Image Assets:
  - `club-[city]-[type].[ext]`
  - Examples:
    - `club-san-pedro-mark.svg`
    - `club-birmingham-artifact.jpg`

---

### CSS Variable Standard

All club pages must define the following root variables:

```css
:root {
  --field-white: #ffffff;
  --ink-navy: #002244;
  --meta-grey: #666666;
  --line-grey: #e0e0e0;
  --club-accent: [club-specific];
  --font-serif: "Georgia", "Times New Roman", serif;
  --font-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
}
