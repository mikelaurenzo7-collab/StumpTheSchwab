"use client";

// Project Memory — localStorage-backed learnings the Co-Producer accumulates
// across sessions. Each session, the recent learnings are sent to Claude as
// context, and Claude can call the `remember` tool to add new ones.

const STORAGE_KEY = "sts_project_memory_v1";
const MAX_LEARNINGS = 40;
const RECENT_FOR_CONTEXT = 20;

export type LearningCategory =
  | "preference"   // user style preferences (BPM, key, kit)
  | "style"        // genre / sonic tendencies
  | "context"      // current project context
  | "skill"        // what the user is learning / wants to improve
  | "fact";        // miscellaneous facts about the user

export interface Learning {
  id: string;
  text: string;
  category: LearningCategory;
  createdAt: number;
}

export interface ProjectMemory {
  learnings: Learning[];
  updatedAt: number;
}

function emptyMemory(): ProjectMemory {
  return { learnings: [], updatedAt: 0 };
}

export function loadMemory(): ProjectMemory {
  if (typeof window === "undefined") return emptyMemory();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw) as ProjectMemory;
    if (!parsed || !Array.isArray(parsed.learnings)) return emptyMemory();
    return parsed;
  } catch {
    return emptyMemory();
  }
}

function saveMemory(memory: ProjectMemory): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    window.dispatchEvent(new CustomEvent("sts-memory-changed"));
  } catch {
    // localStorage may be full or disabled
  }
}

export function addLearning(text: string, category: LearningCategory): Learning {
  const learning: Learning = {
    id: `lrn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim().slice(0, 240),
    category,
    createdAt: Date.now(),
  };
  const memory = loadMemory();
  // De-dup: skip if a near-identical learning exists
  const normalized = learning.text.toLowerCase();
  const dup = memory.learnings.find((l) => l.text.toLowerCase() === normalized);
  if (dup) return dup;

  memory.learnings.unshift(learning);
  if (memory.learnings.length > MAX_LEARNINGS) {
    memory.learnings = memory.learnings.slice(0, MAX_LEARNINGS);
  }
  memory.updatedAt = Date.now();
  saveMemory(memory);
  return learning;
}

export function removeLearning(id: string): void {
  const memory = loadMemory();
  memory.learnings = memory.learnings.filter((l) => l.id !== id);
  memory.updatedAt = Date.now();
  saveMemory(memory);
}

export function clearMemory(): void {
  saveMemory(emptyMemory());
}

// Build the compact memory block injected into Claude's context.
export function buildMemoryContext(): string {
  const memory = loadMemory();
  if (memory.learnings.length === 0) return "";
  const recent = memory.learnings.slice(0, RECENT_FOR_CONTEXT);
  const lines = recent.map((l) => `- [${l.category}] ${l.text}`);
  return lines.join("\n");
}
