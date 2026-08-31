# MediSem — Hospital Management Knowledge Graph

A hospital management system where the record is an RDF knowledge graph, described
by an OWL 2 ontology, with a reasoner running in the browser.

Care teams see an ordinary clinical interface. Underneath, disease categories,
safety alerts, caseloads, bed occupancy and patient classification are all
**derived** rather than stored. A toggle in the sidebar reveals the machinery:
every panel carries a ◈ chip that opens the exact SPARQL query behind it.

Two features go beyond a normal portal:

- **Longitudinal visit history.** Each entry in the patient timeline is assembled
  by joining encounter, condition, prescription and lab triples on the visit.
- **Comorbidity network.** Which conditions travel together is *measured* from
  the patient population, not hand-written, then asserted back into the graph as
  `med:comorbidWith` triples.

---

## Deploying to Render

This is a static site. No build step, no server, no database, no environment
variables.

### 1. Put the folder in a Git repository

```bash
cd medisem
git init
git add .
git commit -m "MediSem hospital knowledge graph"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/medisem.git
git push -u origin main
```

### 2. Create the site on Render

1. Sign in at [render.com](https://render.com) and click **New → Static Site**.
2. Connect the repository you just pushed.
3. Fill in exactly this:

   | Field | Value |
   |---|---|
   | **Name** | `medisem` (or anything) |
   | **Branch** | `main` |
   | **Root Directory** | *leave blank* |
   | **Build Command** | *leave blank* |
   | **Publish Directory** | `.` |

4. Click **Create Static Site**.

It deploys in under a minute and you get a URL like
`https://medisem.onrender.com`. Static sites on Render's free tier never sleep,
so there is no cold start.

The repository also contains `render.yaml`, so you can instead use
**New → Blueprint** and point it at the repo if you prefer.

### Running it locally first

Because the page loads its scripts with relative paths, opening `index.html`
directly from the file system works in some browsers but not others. Serving it
is more reliable:

```bash
cd medisem
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

---

## Demo accounts

Every passcode is `demo1234`. The login screen lists them as one-click buttons,
so you do not need to type anything.

| Role | Email | What you see |
|---|---|---|
| Patient | `arjun@medisem.health` | Cardiac patient, long history, several medicines |
| Patient | `lakshmi@medisem.health` | Stroke and neurology pathway |
| Patient | `gopal@medisem.health` | Elderly, multiple chronic conditions |
| Patient | `rekha@medisem.health` | Oncology pathway |
| Patient | `divya@medisem.health` | Younger patient, respiratory |
| Doctor | `r.iyer@medisem.health` | Cardiology, largest caseload |
| Doctor | `p.raghavan@medisem.health` | Neurology |
| Doctor | `n.venkatesh@medisem.health` | Endocrinology |
| Doctor | `a.krishnan@medisem.health` | Oncology |
| Doctor | `s.rao@medisem.health` | Pulmonology |
| Administration | `records@medisem.health` | Whole hospital, exports, graph tools |
| Laboratory | `lab@medisem.health` | Pending worklist, result entry |
| Pharmacy | `pharmacy@medisem.health` | Dispensing queue with interaction checks |

---

## What to show in a demo

**1. A derived safety alert appearing live.**
Sign in as `r.iyer@medisem.health` → **My patients** → open any patient with
asthma → **Record a consultation** → prescribe **Ibuprofen**. Ibuprofen is
marked contraindicated for asthma once, in the formulary. The alert appears on
save because the reasoner re-runs, not because anything checks for that drug.

**2. A class nobody typed.**
Administration → **Knowledge graph → Ontology**. Compare the *Stated* and
*Reasoned* columns. `med:CriticalPatient`, `med:AbnormalResult` and
`med:ChronicPatient` have zero stated instances and hundreds of reasoned ones.

**3. The same query with and without reasoning.**
**Knowledge graph → SPARQL console** → load *Critical patients* → run it, then
untick *Reason over the graph* and run again. Full table, then nothing.

**4. The comorbidity network.**
Doctor or Administration → **Population health**. Click any node. Diabetes,
hypertension and chronic kidney disease form the dense hub because that is what
the data says, not because anyone drew it that way.

**5. Lab result changing a classification.**
`lab@medisem.health` → enter a wildly out-of-range value → it immediately
appears under **Abnormal results**, because `med:AbnormalResult` is defined by
an `owl:hasValue` restriction on `med:outOfRange`.

---

## How it is built

```
index.html                  loads everything in dependency order
styles.css
assets/
  rdf.js                    RDF terms, indexed triple store, Turtle parser,
                            RDFS + OWL 2 RL reasoner, SPARQL engine, serialisers
  ontology.js               the TBox: ~90 classes, ~55 object properties
  data-reference.js         departments, wards, beds, staff, diseases, formulary,
                            insurers, login accounts
  data-cohort.js            GENERATED. 120 patients, 468 encounters, 323
                            conditions, 363 prescriptions, 213 lab orders
  db.js                     changeset persistence in localStorage
  queries.js                every panel's SPARQL, one function per panel
  comorbidity.js            measures the network, lays it out, renders it
  app.js                    shell, auth, routing, provenance drawer
  view-*.js                 one file per role interface
scripts/
  generate-cohort.mjs       regenerates data-cohort.js
```

Nothing is fetched at runtime and there are no dependencies. The only external
request is the Google Fonts stylesheet, and the app degrades gracefully without it.

### The reasoner

Forward chaining to a fixpoint, 19 entailment rules, roughly 400 ms over 30,000
triples. Every derived triple records the rule that produced it and the premises
it came from, which is what the **Inference explorer** shows.

Implemented: `rdfs2`, `rdfs3`, `rdfs5`, `rdfs7`, `rdfs9`, `rdfs11`,
`owl:inverseOf`, `owl:SymmetricProperty`, `owl:TransitiveProperty`,
`owl:equivalentClass`, `owl:equivalentProperty`, `owl:sameAs`,
`owl:propertyChainAxiom`, `owl:someValuesFrom`, `owl:allValuesFrom`,
`owl:hasValue`, `owl:intersectionOf`, `owl:unionOf`.

### The comorbidity measure

For each pair of diseases A and B across the cohort:

- **support** — patients carrying both
- **lift** — `P(A∩B) / (P(A)·P(B))`; above 1 means more often together than chance
- **phi** — the correlation coefficient for two binary variables

Pairs clearing the support floor with lift above 1 become edges. This runs over
`med:suffersFrom`, which is itself derived by a property chain, so the network is
computed over inferred facts.

### Persistence

The base graph is compiled into the bundle and never changes. Edits are appended
to a changeset of RDF additions and retractions in `localStorage`, replayed over
the base graph on load, then reasoned over. The edit history is itself RDF and
exports as Turtle from **Knowledge graph → Changeset**.

**This is per browser.** A static site has no server, so the changeset is not
shared between devices or users. If you need shared state later, the same
changeset would move behind an HTTP endpoint and the site becomes a small Node
service instead.

### Regenerating the patient data

```bash
node scripts/generate-cohort.mjs
```

Patients are drawn from clinically plausible comorbidity clusters with a fixed
seed, so the same hospital comes out every time. Change the seed or the cluster
probabilities at the top of the file to get a different population.

---

## Limitations, stated plainly

- The SPARQL engine covers a large subset of SPARQL 1.1 — SELECT, ASK,
  CONSTRUCT, DESCRIBE, OPTIONAL, UNION, FILTER, BIND, GROUP BY, aggregates,
  ORDER BY, LIMIT — but not property paths, subqueries or MINUS.
- The reasoner is OWL 2 RL style forward chaining. It does not do consistency
  checking, so `owl:disjointWith` is declared in the ontology but not enforced.
- Comorbidity links are population associations. They are not causal, not
  predictive for an individual, and the interface says so wherever they appear.
- Authentication is a demonstration only: passcodes sit in the graph in plain
  text. Never put real patient data in this.

All patients, staff and clinical records are fictional.
