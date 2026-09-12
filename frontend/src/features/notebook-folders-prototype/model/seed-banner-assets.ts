// Responsive WebP variants of the seed banner artwork, generated once from
// the original JPGs (see git history for the sources). Folder thumbnails use
// the 240w/480w pair, notebook artwork renders at ~239px (480w covers 2x
// retina), and the dialog goes up to full width (960w).
import aristotle240 from "../assets/seed-banners/aristotle-240w.webp";
import aristotle480 from "../assets/seed-banners/aristotle-480w.webp";
import aristotle960 from "../assets/seed-banners/aristotle-960w.webp";
import confucio240 from "../assets/seed-banners/confucio-240w.webp";
import confucio480 from "../assets/seed-banners/confucio-480w.webp";
import confucio960 from "../assets/seed-banners/confucio-960w.webp";
import descartes240 from "../assets/seed-banners/descartes-240w.webp";
import descartes480 from "../assets/seed-banners/descartes-480w.webp";
import descartes960 from "../assets/seed-banners/descartes-960w.webp";
import hume240 from "../assets/seed-banners/hume-240w.webp";
import hume480 from "../assets/seed-banners/hume-480w.webp";
import hume960 from "../assets/seed-banners/hume-960w.webp";
import immanuelKant240 from "../assets/seed-banners/immanuel-kant-240w.webp";
import kant480 from "../assets/seed-banners/immanuel-kant-480w.webp";
import kant960 from "../assets/seed-banners/immanuel-kant-960w.webp";
import johnLock240 from "../assets/seed-banners/john_lock-240w.webp";
import locke480 from "../assets/seed-banners/john_lock-480w.webp";
import locke960 from "../assets/seed-banners/john_lock-960w.webp";
import karlMarx240 from "../assets/seed-banners/karl_marx-240w.webp";
import marx480 from "../assets/seed-banners/karl_marx-480w.webp";
import marx960 from "../assets/seed-banners/karl_marx-960w.webp";
import nietzsche240 from "../assets/seed-banners/nietzsche-240w.webp";
import nietzsche480 from "../assets/seed-banners/nietzsche-480w.webp";
import nietzsche960 from "../assets/seed-banners/nietzsche-960w.webp";
import plato240 from "../assets/seed-banners/plato-240w.webp";
import plato480 from "../assets/seed-banners/plato-480w.webp";
import plato960 from "../assets/seed-banners/plato-960w.webp";
import socrates240 from "../assets/seed-banners/socrates-240w.webp";
import socrates480 from "../assets/seed-banners/socrates-480w.webp";
import socrates960 from "../assets/seed-banners/socrates-960w.webp";
import type { CoverVariants } from "./types";

export const SEED_BANNER_VARIANTS: Record<string, CoverVariants> = {
  plato: { w240: plato240, w480: plato480, w960: plato960 },
  aristotle: { w240: aristotle240, w480: aristotle480, w960: aristotle960 },
  socrates: { w240: socrates240, w480: socrates480, w960: socrates960 },
  kant: { w240: immanuelKant240, w480: kant480, w960: kant960 },
  descartes: { w240: descartes240, w480: descartes480, w960: descartes960 },
  confucio: { w240: confucio240, w480: confucio480, w960: confucio960 },
  nietzsche: { w240: nietzsche240, w480: nietzsche480, w960: nietzsche960 },
  locke: { w240: johnLock240, w480: locke480, w960: locke960 },
  hume: { w240: hume240, w480: hume480, w960: hume960 },
  marx: { w240: karlMarx240, w480: marx480, w960: marx960 },
};
