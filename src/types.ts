export type EducationLevel = 'SD' | 'SMP' | 'SMA';

export type QuestionType = 'Pilihan Ganda' | 'Essay' | 'Benar/Salah';

export type Difficulty = 'Mudah' | 'Sedang' | 'Sulit';

export type Language = 'Indonesia' | 'Inggris';

export type AssessmentType = 'Ulangan Harian' | 'Ulangan Latihan' | 'PAS' | 'PTS';

export interface GeneratorConfig {
  level: EducationLevel;
  grade: string;
  subject: string;
  topic: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  count: number;
  language: Language;
  assessmentType: AssessmentType;
  includeImages?: boolean;
  imageCount?: number;
}

export interface Question {
  id: string;
  text: string;
  options?: string[];
  answer: string;
  explanation?: string;
}

export interface GenerationResult {
  questions: Question[];
  rawMarkdown: string;
  sources?: { title: string; uri: string }[];
  images?: string[];
}
