import aristotleBanner from "../assets/seed-banners/aristotle.jpg";
import confucioBanner from "../assets/seed-banners/confucio.jpg";
import descartesBanner from "../assets/seed-banners/descartes.jpg";
import humeBanner from "../assets/seed-banners/hume.jpg";
import kantBanner from "../assets/seed-banners/immanuel-kant.jpg";
import lockeBanner from "../assets/seed-banners/john_lock.jpg";
import marxBanner from "../assets/seed-banners/karl_marx.jpg";
import nietzscheBanner from "../assets/seed-banners/nietzsche.jpg";
import platoBanner from "../assets/seed-banners/plato.jpg";
import socratesBanner from "../assets/seed-banners/socrates.jpg";
import type { Notebook } from "./types";

type SeedNotebook = Omit<Notebook, "folderId" | "createdAt" | "updatedAt"> & { folderId: string | null };

// Adapted from backend/seed/notebooks.json. The prototype imports these
// local assets directly so it never depends on the API or object storage.
export const SEEDED_NOTEBOOKS: SeedNotebook[] = [
  {
    id: "seed-plato",
    title: "Platón",
    description:
      "Explora la filosofía de Platón: la teoría de las Ideas, el conocimiento, la justicia, el alma, la política y la educación. Incluye conceptos centrales, diálogos fundamentales, citas, preguntas de reflexión y una guía para comprender su enorme influencia en la filosofía occidental.",
    icon: "CircleDot",
    coverUrl: platoBanner,
    folderId: "folder-two",
  },
  {
    id: "seed-aristotle",
    title: "Aristóteles",
    description:
      "Estudia el pensamiento de Aristóteles sobre lógica, ética, política, metafísica, naturaleza y conocimiento. Revisa conceptos como virtud, término medio, causalidad y sustancia, junto con sus obras principales y su influencia decisiva en la ciencia, la filosofía y el pensamiento occidental.",
    icon: "Cloud",
    coverUrl: aristotleBanner,
    folderId: "folder-one",
  },
  {
    id: "seed-socrates",
    title: "Sócrates",
    description:
      "Descubre la filosofía de Sócrates a través del diálogo, la mayéutica, el examen de la vida, la virtud y la búsqueda del conocimiento. Incluye sus ideas centrales, el método socrático, su juicio y muerte, y preguntas para comprender su profunda influencia en Platón y en toda la tradición filosófica.",
    icon: "MessageCircleQuestion",
    coverUrl: socratesBanner,
    folderId: "folder-two",
  },
  {
    id: "seed-kant",
    title: "Immanuel Kant",
    description:
      "Explora el pensamiento de Kant sobre conocimiento, razón, moral, libertad y deber. Estudia el imperativo categórico, los límites de la razón, los juicios y su revolución en la filosofía moderna. Incluye conceptos clave, obras fundamentales y preguntas para comprender su impacto en la ética y la epistemología.",
    icon: "Scale",
    coverUrl: kantBanner,
    folderId: "folder-many",
  },
  {
    id: "seed-descartes",
    title: "René Descartes",
    description:
      "Analiza la filosofía de Descartes, padre del racionalismo moderno: la duda metódica, el cogito, la relación entre mente y cuerpo y la búsqueda de certezas fundamentales. Incluye sus principales argumentos, obras, conceptos y preguntas para entender su influencia en la ciencia y la filosofía moderna.",
    icon: "Brain",
    coverUrl: descartesBanner,
    folderId: "folder-many",
  },
  {
    id: "seed-confucio",
    title: "Confucio",
    description:
      "Explora las enseñanzas de Confucio sobre ética, educación, virtud, familia, respeto, liderazgo y armonía social. Estudia conceptos como ren, li y la formación moral del individuo, junto con sus principales enseñanzas y su enorme influencia en la cultura, la política y el pensamiento de Asia oriental.",
    icon: "BookOpen",
    coverUrl: confucioBanner,
    folderId: "folder-many",
  },
  {
    id: "seed-nietzsche",
    title: "Friedrich Nietzsche",
    description:
      "Explora la provocadora filosofía de Nietzsche: su crítica de la moral, la voluntad de poder, el eterno retorno, el nihilismo y el Übermensch. Incluye ideas clave, citas, temas y preguntas de reflexión, y ofrece una guía concisa para entender su desafío a los valores tradicionales y al pensamiento moderno.",
    icon: "Hammer",
    coverUrl: nietzscheBanner,
    folderId: "folder-many",
  },
  {
    id: "seed-locke",
    title: "John Locke",
    description:
      "Estudia las ideas de Locke sobre conocimiento, experiencia, identidad, libertad, derechos naturales y gobierno. Explora su defensa del empirismo, la propiedad y el consentimiento político, así como su influencia en el liberalismo, las democracias modernas y la filosofía política occidental.",
    icon: "KeyRound",
    coverUrl: lockeBanner,
    folderId: "folder-many",
  },
  {
    id: "seed-hume",
    title: "David Hume",
    description:
      "Explora el empirismo y escepticismo de Hume: el origen de las ideas, la causalidad, la identidad personal, la moral y los límites del conocimiento. Incluye sus argumentos más importantes, obras fundamentales y preguntas para comprender su enorme influencia en Kant, la epistemología y la filosofía moderna.",
    icon: "Eye",
    coverUrl: humeBanner,
    folderId: null,
  },
  {
    id: "seed-marx",
    title: "Karl Marx",
    description:
      "Analiza el pensamiento de Marx sobre capitalismo, clases sociales, alienación, trabajo, ideología y cambio histórico. Estudia el materialismo histórico, la lucha de clases y su crítica de la economía política, junto con la influencia que sus ideas han ejercido sobre la filosofía, la política y las ciencias sociales.",
    icon: "Factory",
    coverUrl: marxBanner,
    folderId: null,
  },
];
