import { create } from "zustand";
import { DEFAULT_QUIZ_THEME, mergeTheme, type QuizTheme } from "@/lib/quizTheme";

export type QuestionType =
  | "multiple" | "single" | "text" | "lead" | "visual"
  | "scarcity" | "social_proof" | "testimonials" | "cta_whatsapp"
  | "cta_price" | "authority" | "before_after" | "comparison_table";

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
  button_label: string;
  button_final_label: string;
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

export const buildDefaultMeta = (overrides: Partial<QuizMeta>): QuizMeta => {
  const { theme: themeOverride, ...rest } = overrides;
  return {
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
    show_question_numbers: false,
    button_label: "Continuar",
    button_final_label: "Ver meu resultado",
    ...rest,
    theme: mergeTheme(themeOverride),
  };
};

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
      const salesTypes: QuestionType[] = ["scarcity","social_proof","testimonials","cta_whatsapp","cta_price","authority","before_after","comparison_table"];
      const isSales = salesTypes.includes(type);
      const titleMap: Partial<Record<QuestionType, string>> = {
        lead: "Seus dados de contato",
        visual: "Seção",
        scarcity: "Escassez",
        social_proof: "Prova Social",
        testimonials: "Depoimentos",
        cta_whatsapp: "CTA WhatsApp",
        cta_price: "Oferta Especial",
        authority: "Autoridade",
        before_after: "Antes e Depois",
        comparison_table: "Comparação",
      };
      const configMap: Partial<Record<QuestionType, Record<string, any>>> = {
        lead: { fields: { name: true, email: true, phone: true } },
        visual: { image_url: "" },
        scarcity: { text: "Restam apenas {n} vagas para este mês", slots_total: 10, slots_filled: 7, show_timer: true, timer_minutes: 15 },
        social_proof: { text: "{n} pessoas responderam esse quiz hoje", count: 127, variant: "responded", show_animation: true },
        testimonials: { items: [{ name: "Cliente", role: "Empresa", text: "Depoimento aqui...", stars: 5, photo_url: "" }], autoplay_seconds: 5 },
        cta_whatsapp: { phone: "", message: "Olá! Acabei de fazer o quiz e gostaria de saber mais.", button_text: "Falar com especialista", above_text: "Fale agora com um especialista" },
        cta_price: { original_price: "5.000", current_price: "2.997", discount_badge: "-40%", button_text: "Quero aproveitar", button_url: "", urgency_text: "Somente para quem concluir o quiz hoje", guarantee_text: "7 dias de garantia" },
        authority: { title: "Empresas que já confiaram no nosso trabalho", logos: [] },
        before_after: { before_title: "Situação Atual", before_items: ["Problema 1", "Problema 2"], after_title: "Com nossa solução", after_items: ["Resultado 1", "Resultado 2"] },
        comparison_table: { col1_title: "Fazendo sozinho", col2_title: "Com nossa solução", col2_badge: "Recomendado", rows: [{ feature: "Característica 1", col1: false, col2: true }] },
      };
      const base: QuizQuestionDraft = {
        id,
        type,
        title: titleMap[type] ?? "Nova pergunta",
        description: "",
        required: type !== "visual" && !isSales,
        order_index: s.questions.length,
        image_url: "",
        config: configMap[type] ?? {},
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
