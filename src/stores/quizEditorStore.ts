import { create } from "zustand";
import { DEFAULT_QUIZ_THEME, mergeTheme, type QuizTheme } from "@/lib/quizTheme";

export type QuestionType = "multiple" | "single" | "text" | "lead" | "visual";

export interface QuizOptionDraft {
  id: string;
  text: string;
  order_index: number;
  points?: number;
  image_url?: string;
  _new?: boolean;
  _deleted?: boolean;
}

export interface QuizQuestionDraft {
  id: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  order_index: number;
  config: Record<string, any>;
  image_url?: string;
  options: QuizOptionDraft[];
  _new?: boolean;
  _deleted?: boolean;
  _dirty?: boolean;
}

export interface QuizScoreRange {
  min: number;
  max: number;
  title: string;
  text: string;
  cta_label: string;
  cta_url: string;
  image_url: string;
}

export interface QuizMeta {
  id: string;
  client_id: string;
  name: string;
  slug: string;
  description: string;
  status: "draft" | "active" | "paused";
  result_title: string;
  result_text: string;
  result_cta_label: string;
  result_cta_url: string;
  result_image_url: string;
  redirect_url: string;
  redirect_delay_seconds: number;
  score_enabled: boolean;
  score_ranges: QuizScoreRange[];
  pixel_meta: string;
  pixel_ga: string;
  webhook_url: string;
  progress_bar: boolean;
  show_question_numbers: boolean;
  theme: QuizTheme;
}

interface QuizEditorState {
  meta: QuizMeta | null;
  questions: QuizQuestionDraft[];
  selectedId: string | null;
  dirty: boolean;
  setQuiz: (meta: QuizMeta, questions: QuizQuestionDraft[]) => void;
  updateMeta: (patch: Partial<QuizMeta>) => void;
  updateTheme: (patch: Partial<QuizTheme>) => void;
  addQuestion: (type: QuestionType) => void;
  updateQuestion: (id: string, patch: Partial<QuizQuestionDraft>) => void;
  removeQuestion: (id: string) => void;
  reorderQuestions: (ids: string[]) => void;
  select: (id: string | null) => void;
  addOption: (questionId: string) => void;
  updateOption: (questionId: string, optionId: string, patch: Partial<QuizOptionDraft>) => void;
  removeOption: (questionId: string, optionId: string) => void;
  markClean: () => void;
}

const tempId = () => "temp_" + Math.random().toString(36).slice(2, 10);

export const buildDefaultMeta = (overrides: Partial<QuizMeta>): QuizMeta => ({
  id: "",
  client_id: "",
  name: "",
  slug: "",
  description: "",
  status: "draft",
  result_title: "Obrigado!",
  result_text: "Recebemos suas respostas.",
  result_cta_label: "",
  result_cta_url: "",
  result_image_url: "",
  redirect_url: "",
  redirect_delay_seconds: 0,
  score_enabled: false,
  score_ranges: [],
  pixel_meta: "",
  pixel_ga: "",
  webhook_url: "",
  progress_bar: true,
  show_question_numbers: true,
  theme: { ...DEFAULT_QUIZ_THEME },
  ...overrides,
  theme: mergeTheme(overrides.theme),
});

export const useQuizEditorStore = create<QuizEditorState>((set) => ({
  meta: null,
  questions: [],
  selectedId: null,
  dirty: false,

  setQuiz: (meta, questions) =>
    set({ meta, questions, selectedId: questions[0]?.id ?? null, dirty: false }),

  updateMeta: (patch) =>
    set((s) => ({ meta: s.meta ? { ...s.meta, ...patch } : s.meta, dirty: true })),

  updateTheme: (patch) =>
    set((s) => ({
      meta: s.meta ? { ...s.meta, theme: { ...s.meta.theme, ...patch } } : s.meta,
      dirty: true,
    })),

  addQuestion: (type) =>
    set((s) => {
      const id = tempId();
      const base: QuizQuestionDraft = {
        id,
        type,
        title:
          type === "lead" ? "Seus dados de contato"
          : type === "visual" ? "Seção"
          : "Nova pergunta",
        description: "",
        required: type !== "visual",
        order_index: s.questions.length,
        image_url: "",
        config:
          type === "lead" ? { fields: { name: true, email: true, phone: true } }
          : type === "visual" ? { image_url: "" }
          : {},
        options:
          type === "multiple" || type === "single"
            ? [
                { id: tempId(), text: "Opção 1", order_index: 0, points: 0, image_url: "", _new: true },
                { id: tempId(), text: "Opção 2", order_index: 1, points: 0, image_url: "", _new: true },
              ]
            : [],
        _new: true,
        _dirty: true,
      };
      return { questions: [...s.questions, base], selectedId: id, dirty: true };
    }),

  updateQuestion: (id, patch) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === id ? { ...q, ...patch, _dirty: true } : q,
      ),
      dirty: true,
    })),

  removeQuestion: (id) =>
    set((s) => {
      const q = s.questions.find((x) => x.id === id);
      if (!q) return s;
      const next = q._new
        ? s.questions.filter((x) => x.id !== id)
        : s.questions.map((x) => (x.id === id ? { ...x, _deleted: true } : x));
      return {
        questions: next,
        selectedId: s.selectedId === id ? null : s.selectedId,
        dirty: true,
      };
    }),

  reorderQuestions: (ids) =>
    set((s) => {
      const map = new Map(s.questions.map((q) => [q.id, q]));
      const next: QuizQuestionDraft[] = [];
      ids.forEach((id, i) => {
        const q = map.get(id);
        if (q) next.push({ ...q, order_index: i, _dirty: true });
      });
      s.questions.forEach((q) => {
        if (q._deleted && !ids.includes(q.id)) next.push(q);
      });
      return { questions: next, dirty: true };
    }),

  select: (id) => set({ selectedId: id }),

  addOption: (questionId) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: [
                ...q.options,
                {
                  id: tempId(),
                  text: `Opção ${q.options.filter((o) => !o._deleted).length + 1}`,
                  order_index: q.options.length,
                  points: 0,
                  image_url: "",
                  _new: true,
                },
              ],
              _dirty: true,
            }
          : q,
      ),
      dirty: true,
    })),

  updateOption: (questionId, optionId, patch) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((o) =>
                o.id === optionId ? { ...o, ...patch } : o,
              ),
              _dirty: true,
            }
          : q,
      ),
      dirty: true,
    })),

  removeOption: (questionId, optionId) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options
                .map((o) =>
                  o.id === optionId
                    ? o._new ? null : { ...o, _deleted: true }
                    : o,
                )
                .filter(Boolean) as QuizOptionDraft[],
              _dirty: true,
            }
          : q,
      ),
      dirty: true,
    })),

  markClean: () => set({ dirty: false }),
}));
