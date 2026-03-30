import { GoogleGenAI } from "@google/genai";
import { GeneratorConfig, GenerationResult } from "../types";

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
}

export async function* generateQuestionsStream(config: GeneratorConfig) {
  const model = "gemini-3-flash-preview";
  const ai = getAI();
  
  const prompt = `
    Bertindaklah sebagai ahli pembuat soal pendidikan di Indonesia. 
    Buatlah soal untuk ${config.assessmentType} tingkat ${config.level} kelas ${config.grade} dengan mata pelajaran ${config.subject}.
    Topik/Materi: ${config.topic}
    Tipe Soal: ${config.questionType}
    Tingkat Kesulitan: ${config.difficulty}
    Jumlah Soal: ${config.count}
    Bahasa: ${config.language}

    Instruksi Khusus:
    1. Pastikan soal sesuai dengan standar Kurikulum Merdeka atau K13 yang berlaku di Indonesia.
    2. Gunakan bahasa ${config.language} untuk seluruh teks soal, pilihan jawaban, dan penjelasan.
    3. Jika tipe soal Pilihan Ganda, gunakan format VERTIKAL (ke bawah) seperti contoh ini:
       1. Apa ibukota Indonesia?
       A. Jakarta
       B. Bandung
       C. Surabaya
       D. Medan
       
       - DILARANG menulis pilihan jawaban ke samping (A. Jakarta B. Bandung ...).
       - Setiap pilihan jawaban WAJIB berada di baris baru sendiri.
       - Gunakan huruf kapital diikuti titik dan spasi (A. , B. , C. , D. , E. ).
       - Berikan 4 pilihan (A, B, C, D) untuk tingkat SD dan SMP.
       - Berikan 5 pilihan (A, B, C, D, E) untuk tingkat SMA.
    3. Berikan kunci jawaban dan penjelasan singkat untuk setiap soal di bagian terpisah.
    4. Gunakan Google Search untuk memastikan fakta, data, atau konteks kurikulum terbaru jika diperlukan.

    Format Output:
    Berikan output dalam format Markdown yang rapi dengan struktur berikut:
    1. **Kisi-kisi Soal**: (Tujuan Pembelajaran, Indikator Soal, Level Kognitif)
    2. **Daftar Soal**: 
       - Gunakan penomoran angka (1, 2, 3, ...) untuk soal.
       - Untuk Pilihan Ganda, pastikan setiap opsi (A, B, C, D, E) berada di baris baru (satu baris untuk satu pilihan).
       - JANGAN menggabungkan beberapa pilihan dalam satu baris.
    3. **Kunci Jawaban & Penjelasan**: (Pisahkan dari daftar soal agar bisa dicetak terpisah)
    4. **Referensi**: (Sebutkan buku teks, standar kurikulum, atau sumber materi yang menjadi acuan pembuatan soal ini)
  `;

  try {
    const stream = await ai.models.generateContentStream({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let fullText = "";
    let sources: { title: string; uri: string }[] = [];

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        
        // Try to extract sources if they appear in the chunk's grounding metadata
        const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          const newSources = groundingMetadata.groundingChunks
            .map(c => ({
              title: c.web?.title || "Sumber",
              uri: c.web?.uri || ""
            }))
            .filter(s => s.uri !== "");
          
          // Add only unique sources
          for (const source of newSources) {
            if (!sources.find(s => s.uri === source.uri)) {
              sources.push(source);
            }
          }
        }

        yield {
          text: fullText,
          sources: sources,
          done: false
        };
      }
    }

    yield {
      text: fullText,
      sources: sources,
      done: true
    };
  } catch (error) {
    console.error("Error in streaming generation:", error);
    throw error;
  }
}

export async function generateImagesIfRequested(config: GeneratorConfig): Promise<string[] | undefined> {
  if (!config.includeImages || !config.imageCount || config.imageCount <= 0) return undefined;

  const ai = getAI();
  const imagePrompt = `Ilustrasi pendidikan untuk soal ${config.subject} kelas ${config.grade} tentang ${config.topic}. Gaya ilustrasi bersih, edukatif, dan cocok untuk materi sekolah.`;

  try {
    const tasks = Array.from({ length: config.imageCount }).map(async (_, i) => {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: `${imagePrompt} (Variasi ${i + 1})` }],
          },
        });
        
        if (!response.candidates || response.candidates.length === 0) return null;
        
        const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
        return imagePart?.inlineData?.data || null;
      } catch (err) {
        console.error(`Error generating image variation ${i + 1}:`, err);
        return null;
      }
    });

    const results = await Promise.all(tasks);
    return results
      .filter((data): data is string => !!data)
      .map(data => `data:image/png;base64,${data}`);
  } catch (error) {
    console.error("Error generating images:", error);
    return undefined;
  }
}
