# Medical Doctor Interview

> **Historical context (added 2026-05-14):** This interview was conducted during the
> icd-10-parser capstone phase to inform a coder-UI SaaS product. The interviewee's
> framing (real-time chart feedback, revenue optimisation for doctors, upcoding/downcoding
> risk) reflects the prior product's wedge — augmenting human coders — rather than the
> current Somnia on-chain adjudication direction. The domain knowledge it contains
> (E/M coding levels, ICD-10 vs CPT distinctions, RVUs, MDM complexity, scribes,
> upcoding/downcoding penalties, critical-care billing) remains valuable background for
> designing the AI coding agent that produces on-chain attestations. Treat the "software
> opportunity" section at the end as pre-pivot product thinking, not a current requirement.

## Handwritten vs. typed documentation

- Very little is handwritten.
- The main handwritten items are forms that patients sign, such as consent forms or emergency release forms.
- On the backend, almost everything is electronic and e-signed.
- One example given was doctors carrying encrypted USB drives with password-protected electronic notes.
- There are exceptions for downtime procedures, such as power outages or other emergency situations.
- A few people still choose to write notes manually, but this is very rare rather than nonexistent.
- Manual note-taking is more likely among specialists outside large hospitals. One example mentioned was some Costco optometrists.

## Role of scribes

- Scribes are very important to coding.
- They are often trained by coders to document in the way coders want.
- They are also trained by doctors to document in the way those doctors prefer.
- This creates a difficult middle ground for scribes.
- Their training is heavily tied to capturing the data points needed for billing and reimbursement.
- Scribes have to take doctors' rambling explanations and turn them into usable notes.
- Good scribes can distill a coherent story while still preserving the details needed for coding.

## Coding systems and standards

- For billing and coding, the main systems mentioned were ICD-10 and CPT.
- The interviewee described those as the core systems for billing/coding.
- In psychology and psychiatry, there is also a standard way of documenting through the DSM.
- The DSM was described as controversial and debated, especially because conditions have been added and removed over time.
- Homosexuality was given as an example of something historically removed from the DSM.

## Communication with coders

- The doctor almost never meets coders.
- The doctor almost never gets feedback from coders.
- A representative example of feedback, when it does happen, would be something like: several mistakes were found across a large batch of charts months later.
- Better technology could improve communication between doctors and coders.
- The doctor thought basic coding help for doctors would be useful, especially real-time prompts such as:
  - what is missing to support a higher coding level
  - what detail must be documented to code correctly
- One example was a chart that is currently level 3 but could support level 4 if it included family history or documented a considered-but-not-ordered test.
- The doctor felt that some coding criteria are arbitrary or "stupid."

## Documentation for medical decision-making

- The doctor referenced the 2023 emergency department evaluation and management guidance:
  - <https://www.acep.org/administration/reimbursement/reimbursement-faqs/2023-ed-em-guidelines-faqs>
- The doctor said that documenting considered-but-not-done tests can help both coding and medico-legal defense.
- Example:
  - documenting "I considered a blood clot test but did not do it because..." can matter if the patient later dies of a blood clot.

## Whether coders can look at past notes

- The doctor was unsure whether coders can look into past medical notes.
- The view expressed was essentially "maybe," but with uncertainty about why they would do so.
- A possible HIPAA concern was mentioned.
- Looking at notes from different specialties could increase complexity.
- For that complexity to count, the doctor believed the chart should explicitly say that a prior note was reviewed, identify the note, and explain how it informed care.
- The doctor referenced item 18 on the ACEP guidance as relevant to documenting review of external notes.

## Do doctors code themselves?

- In very small hospitals, yes.
- In most settings, no.

## E/M coding level reference

| E/M | MDM | Number and Complexity of Problems Addressed | Amount and/or Complexity of Data to be Reviewed and Analyzed | Risk of Complications / Morbidity / Mortality of Patient Management |
| --- | --- | --- | --- | --- |
| `99281` | N/A | N/A | N/A | N/A |
| `99282` | Straightforward | Minimal | Minimal or none | Minimal |
| `99283` | Low | Low | Limited | Low |
| `99284` | Moderate | Moderate | Moderate | Moderate |
| `99285` | High | High | Extensive | High |

## Additional notes

### Purpose of coding vs. purpose of charting

- According to coders, one purpose of coding is to maximize revenue from a chart.
- Example: talking about smoking for five minutes can increase reimbursement.
- From the doctor's perspective, the chart exists to document what was done, why it was done, and the clinician's thought process in a way that is readable and understandable.
- The doctor said thought process has only counted for money since January 2023, specifically in emergency medicine.
- The January 2023 change was described as an incentive to include all relevant reasoning in the chart.

### Examples of charted information

- Social history can matter.
- Family history can matter.
- The level of care depends on both the complexity of care and the seriousness of disease.
- If there is a reasonable rationale for the level of care, the provider should be able to bill at that level.

### Coding levels and critical care

- Coding levels were described as levels 1, 2, 3, 4, and 5.
- Critical care sits above level 5 and is handled separately.
- Critical care can waive some normal data-point requirements because the situation is urgent and severe.
- Critical care and non-critical care are separated deliberately.
- Critical care time is billed in 30-minute increments.
- The minutes do not need to be continuous.

### Insurance, RVUs, and payment

- Coding can depend on insurance.
- RVU means Relative Value Unit.
- RVUs are attached to codes and then multiplied for payment.
- The doctor described this roughly as: insurance pays a dollar amount for a given code with a given RVU.
- Complexity can affect RVUs.
- RVUs can be looked up.
- This was described especially in relation to CPT codes.

### CPT and ICD-10 distinctions

- CPT is a procedure code.
- ICD-10 is a diagnosis code.
- Example level 1 visit: medication refill.
- Example level 3 visit: minor injury.
- Level 5 was described as as intense as possible without reaching critical care.
- Example CPT:
  - `12006` for laceration repair
- Example critical care CPT codes:
  - `99291`
  - `99292`
- The doctor said critical care notes may also separately list additional procedures such as intubation or IV placement.
- ICD-10 answers what is wrong with the person, such as pneumonia worsened by diabetes.
- The doctor said billing may only take up to two ICD-10 codes into account.

### Constraints and edge cases

- CPR and critical care cannot both be billed together.
- In bigger places, coders usually do the coding.
- In smaller places, doctors sometimes code.
- Doctors do not necessarily need formal coding certification and may learn largely on the job.

### Upcoding and downcoding

- Upcoding means coding at a higher level or RVU than justified.
- The doctor said upcoding carries major penalties.
- Smaller companies may downcode to avoid the risk of upcoding.
- Downcoding was described as a big issue.
- Since coders are often paid hourly, downcoding can be the safer choice for them personally even though it reduces hospital revenue.

### Inpatient coding

- Inpatient coding is different from emergency medicine coding.
- Admission, daily, and discharge coding were mentioned as internal medicine work.
- The interviewee said there are only three tiers there, though details should be confirmed from another source.

### Coding references and matching codes

- Suggested reading:
  - <https://www.amazon.com/Medical-Billing-Coding-Dummies-Smiley/dp/1119625440>
- Procedure codes should match diagnosis codes so that the procedure appears medically necessary.
- Example:
  - if a patient presents with chest pain and receives a large workup, the chart may need a chest pain diagnosis code even if the final diagnosis is bronchitis
- Notes often contain symptom-based terms.
- Codes can be symptom-based.
- Codes can be very specific, but there are also general codes for situations where the exact problem is not yet known.

### ICD-10 as public-health data

- The doctor described ICD-10 as useful not only for billing but also as a dataset for public health pattern analysis.

### Modifiers and specificity

- Right and left modifiers matter, especially in CPT codes.
- CPT can also express how difficult a treatment or procedure was.

### Complexity and medical decision-making

- Differential diagnosis was described as the list of possible causes of a patient's symptoms.
- Greater complexity can justify higher billing.
- Calling someone from another specialty can increase complexity.
- Talking with anyone who has appropriate knowledge can increase complexity.
- Examples given:
  - the child's mother
  - a police officer who witnessed the mechanism of injury
- Considerations about a patient's finances or transportation ability can also count for something in decision-making.

## Software opportunity noted by the doctor

- The doctor thought the best software approach would be real-time chart feedback.
- The goal would be to double-check documentation and point out what the provider may be missing.
- The doctor specifically liked the idea of surfacing missed opportunities to justify a higher supported level of care.
- A follow-up question noted in the raw notes is whether this kind of guidance is legally permissible, and if so, why.

## Memorable examples and observations

- The interviewee mentioned that there are "funny" diagnosis codes, including examples like jet ski fires and various parrot-related codes.
- The repeated theme throughout the interview was justification:
  - justify what was done
  - justify why it was done
  - justify why the billing level is appropriate

---

**See also** — historical background; carries a 2026-05-14 context header. For current domain background see [[../research/medical-coding-domain|medical-coding-domain]] and [[../research/topics/corti|Corti hub]].
