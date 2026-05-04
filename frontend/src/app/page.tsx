"use client";

import { useState, useRef, useEffect } from "react";

type ReviewResult = {
  summary: string;
  podcast_script: string;
  questions: string[];
  sample_answers: string[];
};

type AudioSegment = {
  text: string;
  start: number;
  end: number;
};

export default function Home() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const activeSegmentRef = useRef<HTMLSpanElement>(null);

  // Scroll the highlighted segment into view whenever it changes
  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentTime]);

  function handlePdfChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      setPdfFile(null);
      return;
    }

    setPdfFile(file);
    setError("");
  }

  function clearPdfFile() {
    setPdfFile(null);
  }

  async function generateReview() {
    if (!title.trim()) {
      setError("Please enter a study topic.");
      return;
    }

    if (!notes.trim() && !pdfFile) {
      setError("Please enter study notes or upload a PDF file.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);
      // Reset audio state when generating a new review
      setAudioUrl("");
      setAudioSegments([]);
      setCurrentTime(0);

      let response: Response;

      if (pdfFile) {
        const formData = new FormData();
        formData.append("title", title);
        formData.append("file", pdfFile);

        response = await fetch(
          "http://localhost:8000/api/review/generate-from-pdf",
          {
            method: "POST",
            body: formData,
          }
        );
      } else {
        response = await fetch("http://localhost:8000/api/review/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            notes,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate review.");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please check if the backend is running.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function generateAudio() {
    if (!result?.podcast_script) {
      setError("Please generate a review first.");
      return;
    }

    try {
      setAudioLoading(true);
      setError("");
      setAudioSegments([]);
      setCurrentTime(0);

      const response = await fetch(
        "http://localhost:8000/api/audio/generate-with-timestamps",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: result.podcast_script }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate audio.");
      }

      const data = await response.json();

      // Decode base64 audio into a blob URL
      const binaryStr = atob(data.audio_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(audioBlob);

      setAudioUrl(url);
      setAudioSegments(data.segments);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong while generating audio.");
      }
    } finally {
      setAudioLoading(false);
    }
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }

  // Index of the segment that is currently being spoken
  const activeSegmentIndex = audioSegments.findIndex(
    (seg) => currentTime >= seg.start && currentTime < seg.end
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <section className="mb-10">
          <p className="mb-3 text-sm font-medium text-blue-300">
            AI Learning Review Assistant
          </p>

          <h1 className="mb-4 text-4xl font-bold tracking-tight">
            EchoLearn AI
          </h1>

          <p className="max-w-2xl text-slate-300">
            Turn yesterday&apos;s study notes or PDF documents into an English
            podcast-style review session. Practice knowledge review, speaking,
            and interview explanation at the same time.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold">Create Review</h2>

            <label className="mb-2 block text-sm font-medium text-slate-300">
              Study Topic
            </label>
            <input
              className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
              placeholder="Example: React table sorting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label className="mb-2 block text-sm font-medium text-slate-300">
              Upload PDF Study Material
            </label>

            <div className="mb-4 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-4">
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfChange}
                className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-400"
              />

              {pdfFile && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-300">
                  <span className="truncate">{pdfFile.name}</span>
                  <button
                    type="button"
                    onClick={clearPdfFile}
                    className="ml-4 text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              )}

              <p className="mt-3 text-xs text-slate-500">
                If you upload a PDF, EchoLearn AI will use the PDF content
                instead of the manual notes below.
              </p>
            </div>

            <label className="mb-2 block text-sm font-medium text-slate-300">
              Or Paste Study Notes
            </label>
            <textarea
              className="mb-4 min-h-48 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
              placeholder="Paste what you learned yesterday..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

            <button
              onClick={generateReview}
              disabled={loading}
              className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate English Review"}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold">Review Result</h2>

            {!result && (
              <p className="text-slate-400">
                Your generated summary, podcast script, and English review
                questions will appear here.
              </p>
            )}

            {result && (
              <div className="space-y-6">
                <section>
                  <h3 className="mb-2 font-semibold text-blue-300">Summary</h3>
                  <p className="text-slate-200">{result.summary}</p>
                </section>

                <section>
                  <h3 className="mb-2 font-semibold text-blue-300">
                    Podcast Script
                  </h3>

                  {/* Render segments with per-sentence highlighting when audio is loaded,
                      otherwise fall back to the raw script text */}
                  {audioSegments.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto rounded-xl bg-slate-950 p-4 leading-7 text-slate-200">
                      {audioSegments.map((seg, index) => {
                        const isActive = index === activeSegmentIndex;
                        return (
                          <span
                            key={index}
                            ref={isActive ? activeSegmentRef : null}
                            className={
                              isActive
                                ? "rounded bg-yellow-400/25 text-yellow-100 transition-colors duration-200"
                                : "transition-colors duration-200"
                            }
                          >
                            {seg.text}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-slate-950 p-4 leading-7 text-slate-200">
                      {result.podcast_script}
                    </p>
                  )}

                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="mb-3 text-xs text-slate-500">
                      This audio is AI-generated for learning and review practice.
                    </p>

                    <button
                      type="button"
                      onClick={generateAudio}
                      disabled={audioLoading}
                      className="mb-4 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {audioLoading
                        ? "Generating Audio..."
                        : audioUrl
                        ? "Regenerate Podcast Audio"
                        : "Generate Podcast Audio"}
                    </button>

                    {audioUrl && (
                      <audio
                        ref={audioRef}
                        controls
                        className="w-full"
                        onTimeUpdate={handleTimeUpdate}
                      >
                        <source src={audioUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 font-semibold text-blue-300">
                    Review Questions
                  </h3>

                  <div className="space-y-3">
                    {result.questions.map((question, index) => (
                      <div
                        key={`${question}-${index}`}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <p className="mb-2 font-medium">
                          {index + 1}. {question}
                        </p>
                        <p className="text-sm text-slate-400">
                          Sample answer: {result.sample_answers[index]}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
