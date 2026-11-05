/**
 * The twelve gradient tokens the API accepts for text stories. Keeping them in
 * one place means the composer, viewer, and chat cards always agree, and no
 * client ever sends raw CSS.
 */
export const STORY_BACKGROUND_TOKENS = [
  'indigo',
  'violet',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'slate',
  'sunset',
  'ocean',
  'forest',
  'midnight',
  'peach',
] as const;

export const STORY_BACKGROUND_CLASSES: Record<string, string> = {
  indigo: 'bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700',
  violet: 'bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-700',
  emerald: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700',
  amber: 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600',
  rose: 'bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700',
  cyan: 'bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700',
  slate: 'bg-gradient-to-br from-slate-600 via-slate-800 to-slate-950',
  sunset: 'bg-gradient-to-br from-orange-400 via-rose-500 to-purple-700',
  ocean: 'bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-800',
  forest: 'bg-gradient-to-br from-lime-500 via-emerald-600 to-teal-800',
  midnight: 'bg-gradient-to-br from-slate-800 via-indigo-950 to-black',
  peach: 'bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400',
};

export function storyBackgroundClass(token: string | null | undefined): string {
  return STORY_BACKGROUND_CLASSES[token || ''] || STORY_BACKGROUND_CLASSES.indigo;
}
