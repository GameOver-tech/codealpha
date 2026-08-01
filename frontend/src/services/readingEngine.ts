/**
 * ReadingEngine — builds a structured, section-aware representation of the
 * report so the reader can highlight words per section, switch tabs
 * automatically, and keep timing in sync with speech.
 */

export interface ReadingSection {
  id: string
  /** Tab this section belongs to (overview / evaluation / transcript). */
  tab: string
  label: string
  text: string
  /** Words of `text`, pre-split for cheap rendering. */
  words: string[]
}

export interface ReadingDocument {
  text: string
  sections: ReadingSection[]
}

export function splitWords(text: string): string[] {
  return (text || '').match(/\S+/g) ?? []
}

export function buildReadingDocument(input: {
  executiveSummary?: string
  strengths?: string[]
  weaknesses?: string[]
  interviewOverview?: string
  candidateOverview?: string
  technicalAssessment?: string
  communicationAssessment?: string
  confidenceAssessment?: string
  problemSolvingAssessment?: string
  experienceAssessment?: string
  performanceAnalysis?: string
  improvementSuggestions?: string
  transcriptText?: string
  speechNotes?: string
  sentimentSummary?: string
  recommendationReason?: string
  /** Key-value pairs from the technical evaluation (AI Insights). */
  technicalEvaluation?: Record<string, string>
}): ReadingDocument {
  const sections: ReadingSection[] = []

  const push = (tab: string, label: string, text?: string) => {
    const cleaned = (text || '').trim()
    if (!cleaned) return
    sections.push({
      id: `${tab}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      tab,
      label,
      text: cleaned,
      words: splitWords(cleaned),
    })
  }

  // Overview tab
  push('overview', 'Executive Summary', input.executiveSummary)
  if (input.strengths?.length) push('overview', 'Strengths', input.strengths.join('. '))
  if (input.weaknesses?.length) push('overview', 'Areas for Improvement', input.weaknesses.join('. '))

  // Evaluation tab
  push('evaluation', 'Interview Overview', input.interviewOverview)
  push('evaluation', 'Candidate Overview', input.candidateOverview)
  push('evaluation', 'Technical Assessment', input.technicalAssessment)
  push('evaluation', 'Communication Assessment', input.communicationAssessment)
  push('evaluation', 'Confidence Assessment', input.confidenceAssessment)
  push('evaluation', 'Problem Solving Assessment', input.problemSolvingAssessment)
  push('evaluation', 'Experience Assessment', input.experienceAssessment)
  push('evaluation', 'Performance Analysis', input.performanceAnalysis)
  push('evaluation', 'Improvement Suggestions', input.improvementSuggestions)

  // Transcript tab
  push('transcript', 'Transcript', input.transcriptText)

  // AI Insights tab
  push('insights', 'Speech Analysis', input.speechNotes)
  push('insights', 'Sentiment Analysis', input.sentimentSummary)
  push('insights', 'Recommendation', input.recommendationReason)
  // Each technical evaluation dimension becomes its own section so the
  // reader highlights the exact cell being spoken.
  if (input.technicalEvaluation) {
    for (const [key, value] of Object.entries(input.technicalEvaluation)) {
      const label = key.replace(/_/g, ' ')
      push('insights', `Technical: ${label}`, String(value))
    }
  }

  const text = sections.map((s) => s.text).join(' ')
  return { text, sections }
}

/** Find the section index containing the given sentence. */
export function findSectionIndex(doc: ReadingDocument, sentence: string): number {
  if (!sentence) return -1
  return doc.sections.findIndex((s) => s.text.includes(sentence))
}
