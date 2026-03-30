import React, { useState, useCallback, useMemo } from 'react';
import { 
  BookOpen, 
  GraduationCap, 
  Settings2, 
  FileText, 
  Send, 
  Loader2, 
  Copy, 
  Check,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Search,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Virtuoso } from 'react-virtuoso';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { generateQuestionsStream, generateImagesIfRequested } from './services/geminiService';
import { GeneratorConfig, GenerationResult, EducationLevel, QuestionType, Difficulty, AssessmentType } from './types';
import { cn } from './lib/utils';
import { useEffect } from 'react';

// Memoized Result Component to prevent unnecessary re-renders of complex markdown
const QuestionResult = React.memo(({ 
  result, 
  config, 
  copyToClipboard, 
  copied, 
  downloadWord,
  generating
}: {
  result: GenerationResult;
  config: GeneratorConfig;
  copyToClipboard: () => void;
  copied: boolean;
  downloadWord: () => void;
  generating: boolean;
}) => {
  // Split markdown into chunks for virtualization
  // We split by headers or by numbered list items at the start of a line
  const chunks = React.useMemo(() => {
    if (!result.rawMarkdown) return [];
    
    // Split by headers (##, ###, etc) or numbered list items (1., 2., etc) at the start of lines
    // This keeps the delimiter with the chunk
    const parts = result.rawMarkdown.split(/(?=\n#{1,6}\s|\n\d+\.\s)/g);
    
    // Clean up parts and filter out empty ones
    return parts.map(p => p.trim()).filter(p => p.length > 0);
  }, [result.rawMarkdown]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-yellow-600" />
            <span className="font-bold text-slate-800">Hasil Generasi Soal</span>
          </div>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Salin Semua
              </>
            )}
          </button>
        </div>
        
        <div className="bg-slate-50/30 border-b border-slate-100 px-6 py-3 flex flex-wrap gap-3 no-print">
          <button
            onClick={downloadWord}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-yellow-50 hover:border-yellow-200 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            Download Word
          </button>
        </div>
        
        <div className="p-6 md:p-8" id="printable-content">
          {/* Virtualized list for long content, fallback to normal for short content */}
          {chunks.length > 10 ? (
            <div className="markdown-body prose prose-slate max-w-none no-print">
              <Virtuoso
                useWindowScroll
                data={chunks}
                itemContent={(index, chunk) => (
                  <div className="mb-4 content-visibility-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{chunk}</ReactMarkdown>
                  </div>
                )}
              />
            </div>
          ) : (
            <div className="markdown-body prose prose-slate max-w-none content-visibility-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.rawMarkdown}</ReactMarkdown>
            </div>
          )}

          {result.images && result.images.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.images.map((img, idx) => (
                <div key={idx} className="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img 
                    src={img} 
                    alt={`Ilustrasi ${idx + 1}`} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md">
                    Ilustrasi {idx + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.sources && result.sources.length > 0 && (
            <div className="mt-10 pt-8 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-yellow-600" />
                Sumber Referensi & Verifikasi (Google Search)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.sources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50/30 transition-all shadow-sm"
                  >
                    <div className="bg-white p-2 rounded-lg border border-slate-100 group-hover:border-yellow-200">
                      <ExternalLink className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate group-hover:text-yellow-700">
                        {source.title}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {source.uri}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {generating && (
            <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm italic animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sedang menulis soal...
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-100">
        <div className="flex items-center gap-2 text-yellow-700 text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          Soal ini dibuat khusus untuk tingkat {config.level} dalam Bahasa {config.language}
        </div>
      </div>
    </motion.div>
  );
});

// Memoized Form Component
const ConfigForm = React.memo(({ 
  config, 
  setConfig, 
  loading, 
  handleGenerate, 
  handleLevelChange, 
  getGrades,
  getSubjects,
  handleReset
}: {
  config: GeneratorConfig;
  setConfig: React.Dispatch<React.SetStateAction<GeneratorConfig>>;
  loading: boolean;
  handleGenerate: (e: React.FormEvent) => void;
  handleLevelChange: (l: EducationLevel) => void;
  getGrades: (level: EducationLevel) => string[];
  getSubjects: (level: EducationLevel) => string[];
  handleReset: () => void;
}) => {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Settings2 className="w-24 h-24" />
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-yellow-600" />
          Konfigurasi Soal
        </h2>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
        >
          Reset Form
        </button>
      </div>

      <form onSubmit={handleGenerate} className="space-y-5">
        {/* Level */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Jenjang Pendidikan</label>
          <div className="grid grid-cols-3 gap-2">
            {(['SD', 'SMP', 'SMA'] as EducationLevel[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => handleLevelChange(l)}
                className={cn(
                  "py-2 px-3 rounded-lg text-sm font-medium transition-all border",
                  config.level === l 
                    ? "bg-yellow-50 border-yellow-200 text-yellow-700 shadow-sm" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Grade */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Kelas</label>
          <select
            value={config.grade}
            onChange={(e) => setConfig(prev => ({ ...prev, grade: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
          >
            {getGrades(config.level).map((g) => (
              <option key={g} value={g}>Kelas {g}</option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Mata Pelajaran</label>
          <select
            value={config.subject}
            onChange={(e) => setConfig(prev => ({ ...prev, subject: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
          >
            {getSubjects(config.level).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Topic */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Topik / Materi Spesifik</label>
          <textarea
            value={config.topic}
            onChange={(e) => setConfig(prev => ({ ...prev, topic: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all min-h-[100px]"
            placeholder="Contoh: Perkalian pecahan, Hukum Newton, Proklamasi Kemerdekaan..."
            required
          />
        </div>

        {/* Assessment Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Jenis Ulangan</label>
          <div className="grid grid-cols-2 gap-2">
            {(['Ulangan Harian', 'Ulangan Latihan', 'PAS', 'PTS'] as AssessmentType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, assessmentType: type }))}
                className={cn(
                  "py-2 px-3 rounded-lg text-sm font-medium transition-all border",
                  config.assessmentType === type 
                    ? "bg-yellow-50 border-yellow-200 text-yellow-700 shadow-sm" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Type & Difficulty */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Tipe Soal</label>
            <select
              value={config.questionType}
              onChange={(e) => setConfig(prev => ({ ...prev, questionType: e.target.value as QuestionType }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
            >
              <option>Pilihan Ganda</option>
              <option>Essay</option>
              <option>Benar/Salah</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Kesulitan</label>
            <select
              value={config.difficulty}
              onChange={(e) => setConfig(prev => ({ ...prev, difficulty: e.target.value as Difficulty }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
            >
              <option>Mudah</option>
              <option>Sedang</option>
              <option>Sulit</option>
            </select>
          </div>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Bahasa Output</label>
          <div className="grid grid-cols-2 gap-2">
            {(['Indonesia', 'Inggris'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, language: lang }))}
                className={cn(
                  "py-2 px-3 rounded-lg text-sm font-medium transition-all border",
                  config.language === lang 
                    ? "bg-yellow-50 border-yellow-200 text-yellow-700 shadow-sm" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 flex justify-between">
            <span>Jumlah Soal</span>
            <span className="text-yellow-600 font-bold">{config.count}</span>
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={config.count}
            onChange={(e) => setConfig(prev => ({ ...prev, count: parseInt(e.target.value) }))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
        </div>

        {/* Image Options */}
        <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-700">Sertakan Gambar</label>
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, includeImages: !prev.includeImages }))}
              className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                config.includeImages ? "bg-yellow-400" : "bg-slate-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                config.includeImages ? "left-6" : "left-1"
              )} />
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
              <span>Jumlah Gambar</span>
              <span className="text-yellow-600 font-bold">{config.imageCount}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={config.imageCount}
              disabled={!config.includeImages}
              onChange={(e) => setConfig(prev => ({ ...prev, imageCount: parseInt(e.target.value) }))}
              className={cn(
                "w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-all",
                config.includeImages ? "bg-slate-200 accent-yellow-500" : "bg-slate-100 accent-slate-300 cursor-not-allowed"
              )}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !config.topic}
          className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-300 text-slate-900 font-bold py-3 rounded-xl shadow-lg shadow-yellow-100 transition-all flex items-center justify-center gap-2 group"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Buat Soal Sekarang
              <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </section>
  );
});

export default function App() {
  const [config, setConfig] = useState<GeneratorConfig>({
    level: 'SMP',
    grade: '7',
    subject: 'Matematika',
    topic: '',
    questionType: 'Pilihan Ganda',
    difficulty: 'Sedang',
    count: 5,
    language: 'Indonesia',
    assessmentType: 'Ulangan Harian',
    includeImages: false,
    imageCount: 1
  });

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getGrades = useCallback((level: EducationLevel) => {
    switch (level) {
      case 'SD': return ['1', '2', '3', '4', '5', '6'];
      case 'SMP': return ['7', '8', '9'];
      case 'SMA': return ['10', '11', '12'];
      default: return [];
    }
  }, []);

  const getSubjects = useCallback((level: EducationLevel) => {
    const common = ['Matematika', 'Bahasa Indonesia', 'Pendidikan Pancasila (PPKn)', 'Pendidikan Agama Islam', 'Seni Budaya', 'PJOK'];
    switch (level) {
      case 'SD':
        return [...common, 'IPA (Ilmu Pengetahuan Alam)', 'IPS (Ilmu Pengetahuan Sosial)'];
      case 'SMP':
        return [...common, 'Bahasa Inggris', 'IPA (Ilmu Pengetahuan Alam)', 'IPS (Ilmu Pengetahuan Sosial)', 'Informatika'];
      case 'SMA':
        return [
          ...common, 
          'Bahasa Inggris', 'Fisika', 'Kimia', 'Biologi', 
          'Sejarah', 'Ekonomi', 'Geografi', 'Sosiologi', 'Informatika'
        ];
      default:
        return common;
    }
  }, []);

  const handleLevelChange = useCallback((l: EducationLevel) => {
    const grades = getGrades(l);
    const subjects = getSubjects(l);
    setConfig(prev => ({ 
      ...prev, 
      level: l, 
      grade: grades[0],
      subject: subjects.includes(prev.subject) ? prev.subject : subjects[0]
    }));
  }, [getGrades, getSubjects]);

  const handleReset = useCallback(() => {
    setConfig({
      level: 'SMP',
      grade: '7',
      subject: 'Matematika',
      topic: '',
      questionType: 'Pilihan Ganda',
      difficulty: 'Sedang',
      count: 5,
      language: 'Indonesia',
      assessmentType: 'Ulangan Harian',
      includeImages: false,
      imageCount: 1
    });
    setResult(null);
    setError(null);
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.topic) return;
    
    setLoading(true);
    setGenerating(true);
    setResult(null);
    setError(null);
    
    try {
      let currentText = "";
      let currentSources: any[] = [];
      
      // Start streaming text
      const stream = generateQuestionsStream(config);
      
      // Start image generation in parallel if requested
      const imagePromise = config.includeImages ? generateImagesIfRequested(config) : Promise.resolve(undefined);
      
      let isFirstChunk = true;
      for await (const chunk of stream) {
        if (isFirstChunk) {
          setLoading(false);
          isFirstChunk = false;
        }
        
        currentText = chunk.text;
        currentSources = chunk.sources;
        
        setResult({
          questions: [],
          rawMarkdown: currentText,
          sources: currentSources,
          images: undefined
        });
      }

      setGenerating(false);

      // Wait for images to finish and update result
      const images = await imagePromise;
      if (images) {
        setResult(prev => prev ? { ...prev, images } : null);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan saat membuat soal. Silakan coba lagi.");
      setLoading(false);
      setGenerating(false);
    }
  };

  const copyToClipboard = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.rawMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const downloadWord = useCallback(async () => {
    if (!result) return;
    
    setLoading(true);
    try {
      const children: any[] = [];

      // Add Header
      children.push(new Paragraph({
        children: [
          new TextRun({
            text: `BANK SOAL PINTAR`,
            bold: true,
            size: 36,
            color: "EAB308", // Yellow-500
          }),
        ],
        alignment: AlignmentType.CENTER,
      }));

      children.push(new Paragraph({
        children: [
          new TextRun({
            text: `${config.subject} - Kelas ${config.grade} (${config.level})`,
            bold: true,
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }));

      // Process Markdown to Word Paragraphs
      const lines = result.rawMarkdown.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed && line === '') {
          children.push(new Paragraph({ spacing: { after: 120 } }));
          return;
        }

        let isBold = false;
        let cleanText = line;

        // Simple Markdown parsing
        if (trimmed.startsWith('#')) {
          const level = (trimmed.match(/^#+/) || ['#'])[0].length;
          const text = trimmed.replace(/^#+\s*/, '');
          children.push(new Paragraph({
            children: [new TextRun({ text, bold: true, size: level === 1 ? 32 : level === 2 ? 28 : 24 })],
            spacing: { before: 240, after: 120 },
          }));
        } else {
          // Check for bold **text**
          const boldMatch = line.match(/\*\*(.*?)\*\*/);
          if (boldMatch) {
            const parts = line.split(/\*\*(.*?)\*\*/);
            const textRuns: TextRun[] = [];
            for (let i = 0; i < parts.length; i++) {
              if (i % 2 === 1) {
                textRuns.push(new TextRun({ text: parts[i], bold: true }));
              } else if (parts[i]) {
                textRuns.push(new TextRun({ text: parts[i] }));
              }
            }
            children.push(new Paragraph({ children: textRuns, spacing: { after: 120 } }));
          } else {
            children.push(new Paragraph({
              children: [new TextRun({ text: line })],
              spacing: { after: 120 },
            }));
          }
        }
      });

      // Add Images
      if (result.images && result.images.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: "LAMPIRAN GAMBAR", bold: true, size: 24 })],
          spacing: { before: 400, after: 200 },
          alignment: AlignmentType.CENTER,
        }));

        for (const imgData of result.images) {
          try {
            const base64 = imgData.split(',')[1];
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            children.push(new Paragraph({
              children: [
                new ImageRun({
                  data: bytes,
                  type: "png",
                  transformation: {
                    width: 550,
                    height: 310,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
            }));
          } catch (imgErr) {
            console.error("Error adding image to Word:", imgErr);
          }
        }
      }
      
      // Add Google Search Sources to Word
      if (result.sources && result.sources.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: "SUMBER REFERENSI & VERIFIKASI", bold: true, size: 24 })],
          spacing: { before: 400, after: 200 },
          alignment: AlignmentType.CENTER,
        }));

        result.sources.forEach((source, idx) => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${idx + 1}. ${source.title}`, bold: true }),
            ],
            spacing: { before: 120 },
          }));
          children.push(new Paragraph({
            children: [
              new TextRun({ text: source.uri, color: "2563EB", underline: {} }), // Blue-600
            ],
            spacing: { after: 120 },
          }));
        });
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Soal_${config.subject}_Kelas${config.grade}.docx`);
    } catch (err) {
      console.error('Word Generation Error:', err);
      setError('Gagal membuat file Word. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [result, config.subject, config.grade, config.level]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-400 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
                Asisten Soal <span className="text-yellow-400">Pintar</span>
              </h1>
              <p className="text-[10px] font-bold text-yellow-400/80 tracking-[0.2em] uppercase">Pixelloka</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-slate-400">
            <span className="flex items-center gap-1"><GraduationCap className="w-4 h-4 text-yellow-400" /> SD/SMP/SMA</span>
            <span className="flex items-center gap-1"><Search className="w-4 h-4 text-yellow-400" /> Google Search Support</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar / Form */}
        <div className="lg:col-span-4 space-y-6 no-print">
          <ConfigForm 
            config={config}
            setConfig={setConfig}
            loading={loading}
            handleGenerate={handleGenerate}
            handleLevelChange={handleLevelChange}
            getGrades={getGrades}
            getSubjects={getSubjects}
            handleReset={handleReset}
          />

          {/* Info Card */}

          {/* Info Card */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
            <h3 className="font-bold flex items-center gap-2 mb-2 text-yellow-400">
              <BookOpen className="w-4 h-4" />
              Tips Cepat
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Berikan konteks topik yang lebih detail untuk mendapatkan soal yang lebih akurat dan menantang. AI akan menyesuaikan gaya bahasa dengan jenjang yang dipilih.
            </p>
          </div>
        </div>

        {/* Output Area */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700"
              >
                <div className="bg-red-100 p-2 rounded-lg">
                  <Settings2 className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Terjadi Kesalahan</p>
                  <p className="text-xs opacity-80">{error}</p>
                </div>
                <button 
                  onClick={() => setError(null)}
                  className="text-xs font-bold hover:underline"
                >
                  Tutup
                </button>
              </motion.div>
            )}

            {!result && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border-2 border-dashed border-slate-200"
              >
                <div className="bg-slate-50 p-6 rounded-full mb-4">
                  <FileText className="w-12 h-12 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Belum Ada Soal</h3>
                <p className="text-slate-500 max-w-md">
                  Isi formulir di samping dan klik tombol "Buat Soal Sekarang" untuk mulai menghasilkan soal latihan pintar.
                </p>
              </motion.div>
            )}

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[500px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200"
              >
                <div className="relative">
                  <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
                  <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <p className="mt-6 text-lg font-medium text-slate-700 animate-pulse">
                  Menyusun soal terbaik untuk Anda...
                </p>
                <p className="text-sm text-slate-400 mt-2 italic">
                  Menggunakan Google Search untuk referensi kurikulum terbaru
                </p>
              </motion.div>
            )}

            {result && !loading && (
              <QuestionResult 
                result={result}
                config={config}
                copyToClipboard={copyToClipboard}
                copied={copied}
                downloadWord={downloadWord}
                generating={generating}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} Asisten Pembuat Soal Pintar. by Pixelloka
          </p>
        </div>
      </footer>
    </div>
  );
}
