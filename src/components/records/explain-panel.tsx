"use client";
import { useState } from "react";
import { AlertTriangle, Info, Loader2, Sparkles, Volume2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssistant } from "@/lib/voice/store";
import { speaker } from "@/lib/voice/tts";
import { LANGS, LANG_META, type Lang } from "@/lib/domain";
import type { Explanation } from "@/lib/explain";
import { cn } from "@/lib/utils";

export function ExplainPanel({ recordId, llmAvailable, isLab }: { recordId: string; llmAvailable: boolean; isLab: boolean }) {
  const fromVoice = useAssistant((s) => s.explanations[recordId]);
  const setExplanation = useAssistant((s) => s.setExplanation);
  const assistantLang = useAssistant((s) => s.lang);
  const [loading, setLoading] = useState<Lang | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useAi, setUseAi] = useState(false);
  const ex: Explanation | undefined = fromVoice;

  const run = async (lang: Lang) => {
    setLoading(lang);
    setError(null);
    try {
      const res = await fetch(`/api/records/${recordId}/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang, mode: useAi ? "llm" : "deterministic" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setExplanation(data.explanation);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="sticky top-24 overflow-hidden" aria-live="polite">
      <div className="h-1.5 bg-gradient-to-r from-brand-300 via-brand-500 to-brand-700" aria-hidden />
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-brand-600" aria-hidden />Explain in simple language</CardTitle>
          <p className="text-sm text-muted">Or say “explain it in Telugu” to the assistant.</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <Button key={l} variant={l === assistantLang ? "primary" : "outline"} size="sm" onClick={() => run(l)} disabled={loading !== null} data-testid={`explain-${l}`}>
              {loading === l ? <Loader2 className="animate-spin" /> : null}
              {LANG_META[l].native}
            </Button>
          ))}
        </div>
        {llmAvailable && isLab && (
          <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="size-4 accent-brand-600" />
            Use AI wording (sends only test values; needs consent on the Privacy page)
          </label>
        )}
        {error && <p role="alert" className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-bad"><AlertTriangle className="size-4 shrink-0" />{error}</p>}

        {ex ? (
          <div className="mt-4 space-y-3" lang={LANG_META[ex.lang].bcp47} data-testid="explanation">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-brand-800">{LANG_META[ex.lang].native} · {ex.mode === "llm" ? "AI-worded" : "built-in, grounded"}</span>
              <button onClick={() => void speaker().speak(ex.spoken, ex.lang)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline cursor-pointer">
                <Volume2 className="size-4" aria-hidden /> Read aloud
              </button>
            </div>
            <p className="text-[0.95rem]">{ex.intro}</p>
            {ex.items.length > 0 && (
              <ul className="space-y-2.5">
                {ex.items.map((it) => (
                  <li key={it.testCode} className={cn("rounded-xl border p-3 text-[0.93rem]", it.status === "low" || it.status === "high" ? "border-amber-200 bg-amber-50" : "border-line bg-canvas")}>
                    <p>{it.line}</p>
                    {it.meaning && <p className="mt-1 text-sm text-muted">{it.meaning}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[0.95rem] font-semibold">{ex.summary}</p>
            <p className="flex gap-2 rounded-xl bg-ink p-3 text-sm text-slate-200"><Info className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />{ex.caution}</p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-canvas p-4 text-sm text-muted">Choose a language above. Explanations use only the values and ranges printed on this report — they are educational, not a diagnosis.</p>
        )}
      </CardContent>
    </Card>
  );
}
