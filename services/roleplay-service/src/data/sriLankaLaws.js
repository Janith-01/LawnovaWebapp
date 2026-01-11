/**
 * Sri Lankan Laws Database - Static Context Injection
 * Instead of RAG, we inject relevant law sections directly into prompts
 * based on the case type/category.
 */

export const SRI_LANKAN_LAWS = {
    "Theft": `
**RELEVANT LAW: THEFT (Penal Code of Sri Lanka)**
- **Section 366 (Definition):** Whoever, intending to take dishonestly any movable property out of the possession of any person without that person's consent, moves that property in order to such taking, is said to commit theft.
- **Section 368 (Punishment):** Imprisonment up to 3 years, or fine, or both.
- **Key Elements to Prove:** 1. Dishonest intention. 2. Movable property. 3. Taking out of possession without consent.
    `,

    "Murder": `
**RELEVANT LAW: MURDER (Penal Code of Sri Lanka)**
- **Section 293 (Culpable Homicide):** Causing death by doing an act with the intention of causing death.
- **Section 294 (Murder):** Culpable homicide is murder if the act by which death is caused is done with the intention of causing death.
- **Section 296 (Punishment):** Whoever commits murder shall be punished with death.
- **Defense:** The accused may argue "Grave and Sudden Provocation" to reduce the charge to Culpable Homicide not amounting to Murder.
    `,

    "Contract": `
**RELEVANT LAW: BREACH OF CONTRACT (Roman-Dutch Law)**
- **Principles:** A contract requires an offer, acceptance, and intention to create legal relations.
- **Breach:** Occurs when one party fails to fulfill their obligations without a lawful excuse (e.g., frustration).
- **Remedies:** 
  1. **Damages:** Monetary compensation to put the innocent party in the position they would have been in if the contract was performed.
  2. **Specific Performance:** A court order compelling the defaulting party to perform their duty (rare in personal service contracts).
    `,

    "Negligence": `
**RELEVANT LAW: NEGLIGENCE (Law of Delict / Aquilian Action)**
- **Core Elements:**
  1. **Duty of Care:** The defendant owed a legal duty to the plaintiff.
  2. **Breach:** The defendant failed to act as a "Reasonable Man" (diligens paterfamilias) would.
  3. **Causation:** The breach directly caused the damage.
  4. **Loss:** Actual quantifiable damage occurred.
- **Standard:** The "Bonus Paterfamilias" test - what would a reasonable person have done in the same circumstances?
    `,

    "Robbery": `
**RELEVANT LAW: ROBBERY (Penal Code of Sri Lanka)**
- **Section 380:** Theft is "robbery" if, in order to the committing of the theft, the offender voluntarily causes or attempts to cause to any person death, hurt, or wrongful restraint, or fear of instant death/hurt/restraint.
- **Section 381 (Punishment):** Rigorous imprisonment for up to 10 years and a fine.
- **Key Elements:** 1. Theft must occur. 2. Force or threat of force must be used. 3. Victim must be put in fear.
    `,

    "Fraud": `
**RELEVANT LAW: CHEATING/FRAUD (Penal Code of Sri Lanka)**
- **Section 398 (Definition):** Whoever, by deceiving any person, fraudulently induces the person so deceived to deliver any property, or to consent that any person shall retain any property, is said to "cheat."
- **Section 399 (Punishment):** Imprisonment up to 3 years, or fine, or both.
- **Key Elements:** 1. Deception. 2. Dishonest or fraudulent intent. 3. Delivery of property or consent obtained through deceit.
    `,

    "Assault": `
**RELEVANT LAW: ASSAULT & HURT (Penal Code of Sri Lanka)**
- **Section 310 (Hurt):** Whoever causes bodily pain, disease, or infirmity to any person is said to cause "hurt."
- **Section 311 (Grievous Hurt):** Includes permanent privation of sight, hearing, amputation, bone fractures, etc.
- **Section 314 (Punishment for Hurt):** Imprisonment up to 1 year, or fine up to Rs. 1,000, or both.
- **Section 315 (Punishment for Grievous Hurt):** Imprisonment up to 7 years and fine.
    `,

    "Property": `
**RELEVANT LAW: PROPERTY DISPUTES (Roman-Dutch Law)**
- **Ownership:** The right to possess, use, and dispose of property to the exclusion of others.
- **Rei Vindicatio:** Action to recover property from an unlawful possessor.
- **Prescription Ordinance:** 
  - 10 years' adverse possession required for unregistered land.
  - Land Registry Act protects registered title holders.
- **Easements:** Right to use another's land (e.g., right of way). Can be acquired by long use or express grant.
    `,

    "Customs": `
**RELEVANT LAW: CUSTOMS ORDINANCE (Sri Lanka)**
- **Section 43:** All goods imported shall be declared truthfully. False declarations are punishable.
- **Section 45:** Prohibited goods may be seized and forfeited.
- **Section 127:** Attempt to evade customs duty is punishable by imprisonment up to 2 years and forfeiture of goods.
- **Section 129:** Making false statements knowingly - Imprisonment up to 3 years.
    `,

    "Defamation": `
**RELEVANT LAW: DEFAMATION (Penal Code of Sri Lanka)**
- **Section 479 (Definition):** Whoever by words, signs, or visible representations makes or publishes any imputation concerning any person, intending to harm the reputation of such person, is said to defame that person.
- **Section 480 (Punishment):** Imprisonment up to 2 years, or fine, or both.
- **Defenses:** 1. Truth (if for public good). 2. Fair comment on matters of public interest. 3. Privilege (court proceedings, parliamentary).
    `,

    "Default": `
**RELEVANT LAW: GENERAL CRIMINAL LAW PRINCIPLES (Penal Code of Sri Lanka)**
- **Burden of Proof:** The prosecution must prove guilt "beyond reasonable doubt."
- **Presumption of Innocence:** Every accused is presumed innocent until proven guilty.
- **Section 50 (General Exception):** Nothing is an offence if done by a person who, at the time, was incapable of knowing the nature of the act due to unsoundness of mind.
- **Right to Silence:** An accused need not incriminate themselves.
    `
};

export const EVIDENCE_RULES = `
**EVIDENCE ORDINANCE HIGHLIGHTS (Sri Lanka):**
- **Section 5:** Evidence may be given of facts in issue and relevant facts ONLY.
- **Section 45 (Expert Evidence):** Opinions of experts (doctors, ballistics, handwriting) are relevant when the Court has to form an opinion on matters of science, art, or foreign law.
- **Section 25 (Confessions):** A confession made to a police officer shall not be proved against an accused.
- **Section 27 (Discovery):** Information leading to discovery of facts may be proved even if obtained during police custody.
- **Hearsay Rule:** A witness generally cannot testify about what someone else said, unless it falls under specific exceptions (e.g., dying declaration under Section 32, res gestae).
- **Section 134 (Number of Witnesses):** No particular number of witnesses is required to prove any fact.
`;

/**
 * Function to detect the relevant law based on case title/topic
 * @param {object} caseDetails - The case details object
 * @returns {string} - The relevant law text
 */
export function getRelevantLaw(caseDetails) {
    const title = (caseDetails?.title || '').toLowerCase();
    const topic = (caseDetails?.topic || '').toLowerCase();
    const relevantLaw = (caseDetails?.relevantLaw || '').toLowerCase();
    const combined = `${title} ${topic} ${relevantLaw}`;

    // Match keywords to law categories
    if (combined.includes('murder') || combined.includes('homicide') || combined.includes('killing')) {
        return SRI_LANKAN_LAWS["Murder"];
    }
    if (combined.includes('robbery') || combined.includes('armed theft')) {
        return SRI_LANKAN_LAWS["Robbery"];
    }
    if (combined.includes('theft') || combined.includes('steal') || combined.includes('stolen')) {
        return SRI_LANKAN_LAWS["Theft"];
    }
    if (combined.includes('contract') || combined.includes('agreement') || combined.includes('breach')) {
        return SRI_LANKAN_LAWS["Contract"];
    }
    if (combined.includes('negligence') || combined.includes('accident') || combined.includes('careless')) {
        return SRI_LANKAN_LAWS["Negligence"];
    }
    if (combined.includes('fraud') || combined.includes('cheat') || combined.includes('deceive')) {
        return SRI_LANKAN_LAWS["Fraud"];
    }
    if (combined.includes('assault') || combined.includes('hurt') || combined.includes('attack') || combined.includes('beat')) {
        return SRI_LANKAN_LAWS["Assault"];
    }
    if (combined.includes('property') || combined.includes('land') || combined.includes('timber') || combined.includes('dispute')) {
        return SRI_LANKAN_LAWS["Property"];
    }
    if (combined.includes('customs') || combined.includes('import') || combined.includes('smuggl')) {
        return SRI_LANKAN_LAWS["Customs"];
    }
    if (combined.includes('defam') || combined.includes('libel') || combined.includes('slander')) {
        return SRI_LANKAN_LAWS["Defamation"];
    }

    // Default fallback
    return SRI_LANKAN_LAWS["Default"];
}
