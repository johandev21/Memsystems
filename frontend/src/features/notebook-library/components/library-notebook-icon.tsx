import {
  BookOpen, Brain, CircleDot, Cloud, Eye, Factory, Hammer, KeyRound,
  MessageCircleQuestion, Notebook, Scale,
} from "lucide-react";
import { DynamicIcon } from "@/features/notebooks/components/icon-picker/dynamic-icon";

const commonIcons: Record<string, typeof Notebook> = {
  notebook: Notebook,
  "book-open": BookOpen,
  brain: Brain,
  "circle-dot": CircleDot,
  cloud: Cloud,
  eye: Eye,
  factory: Factory,
  hammer: Hammer,
  "key-round": KeyRound,
  "message-circle-question": MessageCircleQuestion,
  scale: Scale,
};

export function LibraryNotebookIcon({ name }: { name?: string | null }) {
  const normalized = (name || "notebook")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
  const Icon = Object.hasOwn(commonIcons, normalized) ? commonIcons[normalized] : undefined;
  const className = "size-6 shrink-0 text-(--notebook-label-foreground)";

  return Icon ? (
    <Icon aria-hidden="true" className={className} />
  ) : (
    <DynamicIcon name={normalized} fallbackIcon={Notebook} aria-hidden="true" className={className} />
  );
}
