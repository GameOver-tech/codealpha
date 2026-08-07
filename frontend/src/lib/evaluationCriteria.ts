/** The 10 selectable evaluation criteria (mirrors backend CRITERIA). */
export const EVALUATION_CRITERIA: { key: string; label: string }[] = [
  { key: 'technical_skills', label: 'Technical' },
  { key: 'communication', label: 'Communication' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'problem_solving', label: 'Problem Solving' },
  { key: 'relevant_experience', label: 'Experience' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'critical_thinking', label: 'Critical Thinking' },
  { key: 'behavior', label: 'Behavior' },
  { key: 'professionalism', label: 'Professionalism' },
]

/** Default selection on the upload form. */
export const DEFAULT_EVALUATION_CRITERIA = [
  'technical_skills',
  'communication',
  'confidence',
  'problem_solving',
]
