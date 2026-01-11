/**
 * Sri Lankan Legal Knowledge Base
 * 
 * This module contains the localized legal corpus for the RAG engine:
 * - Sri Lankan Penal Code sections
 * - Legal syllabus content
 * - Relevant case law summaries
 * 
 * Data is structured for efficient vector embedding and retrieval
 */

// Sri Lankan Penal Code Sections (Key provisions)
export const PENAL_CODE_SECTIONS = [
    {
        id: 'pc-294',
        section: 'Section 294',
        title: 'Causing Death by Negligence',
        category: 'Offences Affecting Life',
        content: `Section 294 - Causing Death by Negligence:
Whoever causes the death of any person by doing any rash or negligent act not amounting to culpable homicide shall be punished with imprisonment of either description for a term which may extend to five years, or with fine, or with both.

Key Elements:
1. Death of a person
2. Caused by the accused
3. By a rash or negligent act
4. Not amounting to culpable homicide

Legal Principle: This section covers cases where death results from negligence but lacks the intent required for murder or culpable homicide. Common applications include road accidents, medical negligence, and industrial accidents.

Burden of Proof: Prosecution must establish that the accused's act was rash or negligent, and that such act caused the death.`,
        keywords: ['negligence', 'death', 'rash act', 'accident', 'medical negligence', 'road accident'],
        relevantCases: ['King v. Perera (1948)', 'State v. Bandara (2015)']
    },
    {
        id: 'pc-296',
        section: 'Section 296',
        title: 'Murder',
        category: 'Offences Affecting Life',
        content: `Section 296 - Murder:
Except in the cases hereinafter excepted, culpable homicide is murder:

1. If the act by which the death is caused is done with the intention of causing death; or

2. If it is done with the intention of causing such bodily injury as the offender knows to be likely to cause the death of the person to whom the harm is caused; or

3. If it is done with the intention of causing bodily injury to any person, and the bodily injury intended to be inflicted is sufficient in the ordinary course of nature to cause death; or

4. If the person committing the act knows that it is so imminently dangerous that it must in all probability cause death, or such bodily injury as is likely to cause death, and commits such act without any excuse for incurring the risk of causing death or such injury.

Exceptions to Murder:
- Exception 1: Grave and sudden provocation
- Exception 2: Exercise of right of private defence in good faith
- Exception 3: Public servant acting in good faith
- Exception 4: Sudden fight without premeditation
- Exception 5: Consent of victim above 18 years`,
        keywords: ['murder', 'homicide', 'intent', 'death', 'provocation', 'private defence'],
        relevantCases: ['Queen v. Nandiya (1960)', 'Banda v. State (2008)', 'Perera v. AG (2012)']
    },
    {
        id: 'pc-302',
        section: 'Section 302',
        title: 'Punishment for Murder',
        category: 'Offences Affecting Life',
        content: `Section 302 - Punishment for Murder:
Whoever commits murder shall be punished with death.

Sentencing Considerations:
The death penalty is mandatory for convictions under Section 302. However, the President of Sri Lanka has the power to commute death sentences to life imprisonment under Article 34 of the Constitution.

Recent Developments:
Sri Lanka has maintained a de facto moratorium on executions since 1976, though the death penalty remains on the statute books.

Alternative Sentencing:
In practice, most death sentences are commuted to life imprisonment. Life imprisonment means imprisonment for the remainder of the prisoner's natural life.`,
        keywords: ['punishment', 'death penalty', 'capital punishment', 'life imprisonment', 'sentencing'],
        relevantCases: ['AG v. Silva (2005)', 'Sunil v. State (2018)']
    },
    {
        id: 'pc-363',
        section: 'Section 363',
        title: 'Kidnapping',
        category: 'Offences Against Person',
        content: `Section 363 - Kidnapping from Sri Lanka:
Whoever conveys any person beyond the limits of Sri Lanka without the consent of that person, or of some person legally authorized to consent on behalf of that person, is said to kidnap that person from Sri Lanka.

Punishment (Section 364):
Whoever kidnaps any person from Sri Lanka shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.

Key Elements:
1. Conveying a person beyond Sri Lanka limits
2. Without consent of the person or legal guardian
3. The person conveyed need not be a minor

Section 354 - Kidnapping from Lawful Guardianship:
Also covers taking a minor under 14 (male) or 16 (female) from lawful guardianship.`,
        keywords: ['kidnapping', 'abduction', 'minor', 'consent', 'guardian', 'custody'],
        relevantCases: ['State v. Wijeratne (2003)', 'Perera v. Republic (2016)']
    },
    {
        id: 'pc-380',
        section: 'Section 380',
        title: 'Theft in Dwelling House',
        category: 'Offences Against Property',
        content: `Section 380 - Theft in Dwelling House:
Whoever commits theft in any building, tent, or vessel used as a human dwelling, or used for the custody of property, shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.

Aggravating Factors:
- Committed at night
- Using force or threat
- Presence of inhabitants
- Value of stolen property

Key Elements:
1. Theft (as defined in Section 366)
2. Committed in a building/tent/vessel
3. Used as human dwelling OR for custody of property

Distinction from Simple Theft (Section 367):
Simple theft carries maximum 3 years imprisonment, while theft in dwelling carries up to 7 years.`,
        keywords: ['theft', 'burglary', 'dwelling', 'property', 'breaking', 'entering'],
        relevantCases: ['Ratnayake v. State (1999)', 'Fernando v. AG (2011)']
    },
    {
        id: 'pc-303',
        section: 'Section 303',
        title: 'Culpable Homicide Not Amounting to Murder',
        category: 'Offences Affecting Life',
        content: `Section 303 - Punishment for Culpable Homicide Not Amounting to Murder:
Whoever commits culpable homicide not amounting to murder shall be punished with imprisonment for life, or imprisonment of either description for a term which may extend to twenty years, and shall also be liable to fine.

When Culpable Homicide is NOT Murder:
1. Death caused under grave and sudden provocation
2. Death caused while exercising right of private defence
3. Death caused in a sudden fight without premeditation
4. Death caused with consent of deceased (above 18)

Distinction from Murder:
The key distinction lies in:
- The degree of intention
- The circumstances of the act
- The applicability of exceptions to murder`,
        keywords: ['culpable homicide', 'manslaughter', 'provocation', 'sudden fight', 'private defence'],
        relevantCases: ['Silva v. State (2001)', 'Gunasekara v. AG (2014)']
    },
    {
        id: 'pc-314',
        section: 'Section 314',
        title: 'Hurt',
        category: 'Offences Against Person',
        content: `Section 314 - Voluntarily Causing Hurt:
Whoever does any act with the intention of thereby causing hurt to any person, or with the knowledge that he is likely thereby to cause hurt to any person, and does thereby cause hurt to any person, is said voluntarily to cause hurt.

Section 312 - Hurt Definition:
Whoever causes bodily pain, disease, or infirmity to any person is said to cause hurt.

Punishments:
- Simple Hurt (Section 315): Up to 1 year imprisonment, or fine up to Rs. 500, or both
- Grievous Hurt (Section 316): Up to 7 years imprisonment and fine

Grievous Hurt includes:
1. Emasculation
2. Permanent privation of sight/hearing
3. Privation of any limb or joint
4. Destruction of any limb or joint
5. Permanent disfiguration of head or face
6. Fracture or dislocation of bone
7. Any hurt endangering life`,
        keywords: ['hurt', 'injury', 'assault', 'grievous hurt', 'bodily harm', 'violence'],
        relevantCases: ['Dissanayake v. State (2007)', 'Jayawardena v. AG (2019)']
    },
    {
        id: 'pc-483',
        section: 'Section 483',
        title: 'Cheating',
        category: 'Offences Against Property',
        content: `Section 483 - Cheating:
Whoever, by deceiving any person, fraudulently or dishonestly induces the person so deceived:
(a) to deliver any property to any person, or
(b) to consent that any person shall retain any property, or
(c) intentionally induces the person so deceived to do or omit to do anything which he would not do or omit,

is said to "cheat."

Punishment (Section 484):
Whoever cheats shall be punished with imprisonment of either description for a term which may extend to one year, or with fine, or with both.

Cheating by Personation (Section 485):
Whoever cheats by pretending to be some other person shall be punished with imprisonment up to three years, or fine, or both.

Key Elements:
1. Deception
2. Fraudulent or dishonest intention
3. Inducement to deliver property or act/omit`,
        keywords: ['cheating', 'fraud', 'deception', 'dishonesty', 'personation', 'inducement'],
        relevantCases: ['Wickramasinghe v. State (2004)', 'Perera v. Republic (2017)']
    }
];

// Sri Lankan Legal Education Syllabus Topics
export const LEGAL_SYLLABUS = [
    {
        id: 'syl-criminal-law',
        topic: 'Criminal Law',
        module: 'Foundation of Law',
        content: `Criminal Law in Sri Lanka:

Primary Sources:
1. Penal Code (Ordinance No. 2 of 1883) - Based on Indian Penal Code
2. Criminal Procedure Code
3. Evidence Ordinance

Key Principles:
- Actus Reus (Guilty Act): Physical element of crime
- Mens Rea (Guilty Mind): Mental element/intention
- Causation: Link between act and consequence
- Strict Liability: Offences not requiring mens rea

Categories of Crimes:
1. Offences against the State
2. Offences against public tranquility
3. Offences by public servants
4. Offences affecting life and personal safety
5. Offences against property

Trial Process:
- Magistrate's Court (minor offences)
- High Court (serious offences, murder, rape)
- Court of Appeal
- Supreme Court`,
        keywords: ['criminal law', 'penal code', 'actus reus', 'mens rea', 'trial', 'courts']
    },
    {
        id: 'syl-evidence',
        topic: 'Law of Evidence',
        module: 'Procedural Law',
        content: `Evidence Law in Sri Lanka:

Governing Law: Evidence Ordinance (Ordinance No. 14 of 1895)

Types of Evidence:
1. Oral Evidence - Witness testimony
2. Documentary Evidence - Written documents
3. Real Evidence - Physical objects
4. Circumstantial Evidence - Inference from facts

Burden of Proof:
- Criminal Cases: Beyond reasonable doubt (on prosecution)
- Civil Cases: Balance of probabilities

Key Principles:
- Relevancy of facts (Sections 5-55)
- Hearsay Rule and Exceptions
- Admissions and Confessions
- Dying Declarations
- Expert Opinion
- Character Evidence
- Corroboration requirements

Examination of Witnesses:
1. Examination-in-chief
2. Cross-examination
3. Re-examination`,
        keywords: ['evidence', 'burden of proof', 'witness', 'testimony', 'hearsay', 'admissibility']
    },
    {
        id: 'syl-civil-procedure',
        topic: 'Civil Procedure',
        module: 'Procedural Law',
        content: `Civil Procedure in Sri Lanka:

Governing Law: Civil Procedure Code (Ordinance No. 2 of 1889)

Court Hierarchy:
1. Primary Courts - Minor civil matters
2. District Courts - Major civil jurisdiction
3. Provincial High Courts
4. Court of Appeal
5. Supreme Court

Filing a Civil Case:
1. Plaint (Statement of Claim)
2. Summons to Defendant
3. Answer
4. Replication (if necessary)
5. Issues framed
6. Trial
7. Judgment

Time Limitations (Prescription):
- Contract claims: 3-6 years
- Tort claims: 2-3 years
- Land matters: 10 years

Remedies:
- Damages (compensatory, punitive)
- Injunctions (temporary, permanent)
- Specific Performance
- Declaration`,
        keywords: ['civil procedure', 'plaint', 'defendant', 'damages', 'injunction', 'prescription']
    },
    {
        id: 'syl-constitutional',
        topic: 'Constitutional Law',
        module: 'Public Law',
        content: `Constitutional Law of Sri Lanka:

Constitution: 1978 Constitution of the Democratic Socialist Republic of Sri Lanka

Key Features:
1. Unitary State
2. Executive Presidency
3. Parliamentary System
4. Independent Judiciary
5. Fundamental Rights (Chapter III)

Fundamental Rights (Articles 10-14):
- Freedom of thought, conscience, religion
- Freedom from torture
- Right to equality
- Freedom of speech and expression
- Freedom of peaceful assembly
- Freedom of association
- Freedom of movement
- Right to engage in lawful occupation
- Freedom from arbitrary arrest

Fundamental Rights Applications:
- Filed directly in Supreme Court
- Within 1 month of violation
- Article 126 jurisdiction

Constitutional Amendments:
- Requires 2/3 parliamentary majority
- Some provisions require referendum`,
        keywords: ['constitution', 'fundamental rights', 'supreme court', 'president', 'parliament']
    },
    {
        id: 'syl-contract',
        topic: 'Law of Contract',
        module: 'Private Law',
        content: `Contract Law in Sri Lanka:

Sources:
1. Roman-Dutch Law principles
2. English Law influences
3. Statutory modifications

Elements of Valid Contract:
1. Offer and Acceptance
2. Intention to create legal relations
3. Consideration (in commercial contracts)
4. Capacity to contract
5. Free consent (no fraud, mistake, duress)
6. Lawful object

Types of Contracts:
- Express and Implied
- Executed and Executory
- Void, Voidable, and Unenforceable

Breach of Contract:
- Actual breach
- Anticipatory breach

Remedies for Breach:
1. Damages (compensatory)
2. Specific performance
3. Injunction
4. Rescission
5. Quantum meruit

Limitation: 6 years from cause of action`,
        keywords: ['contract', 'offer', 'acceptance', 'consideration', 'breach', 'damages']
    }
];

// Sri Lankan Case Law Summaries
export const CASE_LAW = [
    {
        id: 'case-001',
        name: 'Queen v. Nandiya (1960)',
        citation: '62 NLR 505',
        court: 'Supreme Court',
        topic: 'Murder - Intention',
        content: `Queen v. Nandiya (1960) 62 NLR 505

Facts: The accused struck the deceased on the head with a club during an altercation. Death resulted from the head injury.

Issue: Whether the accused had the necessary intention for murder under Section 296.

Held: The Supreme Court held that when a person strikes another on a vital part of the body with a deadly weapon, the intention to cause death or grievous harm can be inferred. The accused was convicted of murder.

Ratio Decidendi: Intention can be inferred from the nature of the weapon used, the part of the body targeted, and the force applied. A person is presumed to intend the natural consequences of their acts.

Legal Principle: This case established the principle of inferring intention from circumstances in murder cases under Sri Lankan law.`,
        keywords: ['murder', 'intention', 'inference', 'deadly weapon', 'section 296']
    },
    {
        id: 'case-002',
        name: 'Banda v. State (2008)',
        citation: 'SC Appeal 15/2007',
        court: 'Supreme Court',
        topic: 'Murder - Provocation',
        content: `Banda v. State (2008) SC Appeal 15/2007

Facts: The accused killed his wife after discovering her in an adulterous situation. He immediately attacked both his wife and the other man.

Issue: Whether the accused was entitled to the exception of grave and sudden provocation under Exception 1 to Section 296.

Held: The Supreme Court reduced the conviction from murder to culpable homicide not amounting to murder. The court found that discovering one's spouse in adultery constitutes grave and sudden provocation.

Ratio Decidendi: The test for provocation is objective - would a reasonable person in the accused's position have lost self-control? The provocation must be grave and sudden, not based on previous grievances.

Legal Principle: Adultery discovered in flagrante delicto can constitute grave and sudden provocation, reducing murder to culpable homicide.`,
        keywords: ['murder', 'provocation', 'adultery', 'culpable homicide', 'exception']
    },
    {
        id: 'case-003',
        name: 'Wijetunga v. AG (2015)',
        citation: 'SC Appeal 89/2014',
        court: 'Supreme Court',
        topic: 'Self-Defence',
        content: `Wijetunga v. Attorney General (2015) SC Appeal 89/2014

Facts: The accused killed an intruder who had entered his home at night armed with a knife. The accused used a sword that was kept for home protection.

Issue: Whether the accused exceeded the right of private defence under Section 92 of the Penal Code.

Held: The Supreme Court acquitted the accused, holding that he had not exceeded his right of private defence. The court considered the suddenness of the attack, the relative strengths of the parties, and the reasonable apprehension of danger.

Ratio Decidendi: The right of private defence extends to causing death if there is reasonable apprehension of death or grievous hurt. The defender need not weigh with golden scales the force required.

Legal Principle: A person defending their home against armed intrusion at night may use lethal force if there is reasonable apprehension of death or grievous hurt.`,
        keywords: ['private defence', 'self-defence', 'home intrusion', 'lethal force', 'section 92']
    },
    {
        id: 'case-004',
        name: 'State v. Fernando (2012)',
        citation: 'HC Colombo 456/2011',
        court: 'High Court',
        topic: 'Medical Negligence',
        content: `State v. Fernando (2012) HC Colombo 456/2011

Facts: A surgeon left a surgical instrument inside a patient during an operation. The patient developed complications and died three weeks later.

Issue: Whether the surgeon was guilty of causing death by negligence under Section 294.

Held: The High Court convicted the surgeon of causing death by negligence. Leaving a surgical instrument inside a patient was held to be gross negligence falling below the standard expected of a competent medical practitioner.

Ratio Decidendi: Medical practitioners owe a duty of care to their patients. Breach of this duty causing death amounts to criminal negligence under Section 294, distinct from civil medical malpractice.

Legal Principle: Medical negligence causing death can attract criminal liability under Section 294 where the negligence is of a sufficient degree to be characterized as gross or reckless.`,
        keywords: ['medical negligence', 'death by negligence', 'section 294', 'duty of care', 'doctor']
    },
    {
        id: 'case-005',
        name: 'Perera v. People\'s Bank (1985)',
        citation: '1985 1 SLR 177',
        court: 'Supreme Court',
        topic: 'Contract - Employment',
        content: `Perera v. People's Bank (1985) 1 SLR 177

Facts: An employee was dismissed without being given an opportunity to be heard. The employer alleged misconduct but provided no formal inquiry.

Issue: Whether an employer can dismiss an employee without following principles of natural justice.

Held: The Supreme Court held that the dismissal was wrongful. Even in private employment, the principles of natural justice require that an employee be given an opportunity to be heard before dismissal for misconduct.

Ratio Decidendi: The audi alteram partem principle (hear the other side) applies to employment relationships. A failure to give an employee an opportunity to respond to allegations before dismissal renders the dismissal wrongful.

Legal Principle: Natural justice principles apply to employment termination - employees must be given opportunity to be heard before dismissal for alleged misconduct.`,
        keywords: ['employment', 'dismissal', 'natural justice', 'audi alteram partem', 'wrongful termination']
    }
];

// Trial procedure stages for mock trial context
export const TRIAL_STAGES = {
    OPENING_STATEMENTS: {
        description: 'Parties present overview of their case',
        tips: [
            'Outline the main facts you intend to prove',
            'State the legal issues clearly',
            'Preview your key witnesses and evidence',
            'Keep it persuasive but factual'
        ]
    },
    PROSECUTION_CASE: {
        description: 'Prosecution presents evidence and witnesses',
        tips: [
            'Present evidence in logical order',
            'Lay proper foundation before introducing exhibits',
            'Ask clear, non-leading questions in examination-in-chief',
            'Anticipate defense objections'
        ]
    },
    CROSS_EXAMINATION: {
        description: 'Opposing counsel questions witnesses',
        tips: [
            'Use leading questions to control the witness',
            'Never ask a question you don\'t know the answer to',
            'Impeach witness credibility where possible',
            'Keep questions focused and brief'
        ]
    },
    DEFENSE_CASE: {
        description: 'Defense presents evidence and witnesses',
        tips: [
            'Challenge prosecution\'s burden of proof',
            'Present alibi or alternative theories',
            'Attack the credibility of prosecution witnesses',
            'Highlight reasonable doubt'
        ]
    },
    CLOSING_ARGUMENTS: {
        description: 'Parties summarize their case',
        tips: [
            'Summarize key evidence supporting your position',
            'Address weaknesses in your case',
            'Apply law to facts clearly',
            'Make a compelling final appeal'
        ]
    }
};

/**
 * Get all documents for vector embedding
 */
export function getAllDocuments() {
    const documents = [];

    // Add Penal Code sections
    PENAL_CODE_SECTIONS.forEach(section => {
        documents.push({
            id: section.id,
            type: 'penal_code',
            content: section.content,
            metadata: {
                section: section.section,
                title: section.title,
                category: section.category,
                keywords: section.keywords,
                relevantCases: section.relevantCases
            }
        });
    });

    // Add syllabus topics
    LEGAL_SYLLABUS.forEach(topic => {
        documents.push({
            id: topic.id,
            type: 'syllabus',
            content: topic.content,
            metadata: {
                topic: topic.topic,
                module: topic.module,
                keywords: topic.keywords
            }
        });
    });

    // Add case law
    CASE_LAW.forEach(caseItem => {
        documents.push({
            id: caseItem.id,
            type: 'case_law',
            content: caseItem.content,
            metadata: {
                name: caseItem.name,
                citation: caseItem.citation,
                court: caseItem.court,
                topic: caseItem.topic,
                keywords: caseItem.keywords
            }
        });
    });

    return documents;
}

export default {
    PENAL_CODE_SECTIONS,
    LEGAL_SYLLABUS,
    CASE_LAW,
    TRIAL_STAGES,
    getAllDocuments
};
