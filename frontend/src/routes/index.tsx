import { createFileRoute, Link } from "@tanstack/react-router";
import type { MotionValue } from "motion/react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Logo } from "@/shared/ui/logo";
import { authClient } from "@/shared/auth";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const benefits = [
  {
    label: "Keep the thread",
    title: "Your sources stay attached to the thinking.",
    body: "Bring papers, notes, links, and PDFs into one notebook so every answer has a place to point back to.",
  },
  {
    label: "Ask better questions",
    title: "Talk to the material, not a blank chat box.",
    body: "Memsystems uses the context you collected to help you compare ideas, find gaps, and move a question forward.",
  },
  {
    label: "Leave with something useful",
    title: "Turn a reading list into a study system.",
    body: "Generate flashcards, quizzes, roadmaps, and mind maps from the work you already did.",
  },
];

const workflows = [
  {
    step: "01",
    title: "Collect",
    body: "Start a notebook and bring in the sources that shape your question.",
  },
  {
    step: "02",
    title: "Connect",
    body: "Ask questions with the material close by, and keep useful answers beside it.",
  },
  {
    step: "03",
    title: "Remember",
    body: "Turn the ideas into flashcards, quizzes, and maps you can return to.",
  },
];

const faqs = [
  [
    "What is Memsystems?",
    "Memsystems is a research and study notebook that keeps your sources, notes, AI conversations, and study materials together.",
  ],
  [
    "Who is it for?",
    "It is built for students, independent researchers, and curious people who need to make sense of a body of material.",
  ],
  [
    "Can I use my own sources?",
    "Yes. Add the sources you are already using, then keep the resulting conversation and study materials in the same notebook.",
  ],
  [
    "Does it replace reading?",
    "No. It helps you read with more structure by making the relationships between your sources easier to inspect.",
  ],
  [
    "How do I start?",
    "Choose Start building your notebook, continue with Google, and create your first notebook from the home screen.",
  ],
  [
    "Can I cancel?",
    "There is no long term commitment to begin. You can leave whenever you want, and your work remains yours.",
  ],
];

function ArrowUpRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
      <path
        d="M3 13 13 3M5 3h8v8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RevealWord({
  word,
  range,
  progress,
  isLast,
  shouldReduceMotion,
}: {
  word: string;
  range: [number, number];
  progress: MotionValue<number>;
  isLast: boolean;
  shouldReduceMotion: boolean;
}) {
  const opacity = useTransform(progress, range, [0.25, 1]);
  const y = useTransform(progress, range, [4, 0]);

  return (
    <span className={`inline-block ${!isLast ? "mr-[0.24em]" : ""}`}>
      {shouldReduceMotion ? (
        <motion.span style={{ opacity }} className="text-foreground">
          {word}
        </motion.span>
      ) : (
        <motion.span
          style={{ opacity, y, display: "inline-block" }}
          className="text-foreground"
        >
          {word}
        </motion.span>
      )}
    </span>
  );
}

function ScrollWordReveal({ text }: { text: string }) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.85", "start 0.35"],
  });
  const words = useMemo(() => text.split(" "), [text]);

  return (
    <p
      ref={containerRef}
      className="max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.06em] text-foreground/30 text-balance sm:text-6xl"
    >
      {words.map((word, index) => {
        const start = index / words.length;
        const end = Math.min(start + 1.2 / words.length, 1);
        return (
          <RevealWord
            key={`${word}-${index}`}
            word={word}
            range={[start, end]}
            progress={scrollYProgress}
            isLast={index === words.length - 1}
            shouldReduceMotion={!!shouldReduceMotion}
          />
        );
      })}
    </p>
  );
}

function FaqAccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
  shouldReduceMotion,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  shouldReduceMotion: boolean;
}) {
  return (
    <div className="border-b border-border py-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer items-center justify-between gap-6 text-left text-lg font-medium tracking-[-0.02em] text-foreground transition-colors duration-150 ease-out hover:text-foreground/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <span>{question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: EASE_OUT }}
          className="inline-flex size-6 shrink-0 items-center justify-center text-2xl font-light text-primary"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : {
                    height: "auto",
                    opacity: 1,
                    transition: {
                      height: { duration: 0.24, ease: EASE_OUT },
                      opacity: { duration: 0.2, delay: 0.04 },
                    },
                  }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : {
                    height: 0,
                    opacity: 0,
                    transition: {
                      height: { duration: 0.2, ease: EASE_OUT },
                      opacity: { duration: 0.12 },
                    },
                  }
            }
            className="overflow-hidden"
          >
            <p className="max-w-2xl pt-4 text-base leading-6 text-muted-foreground text-pretty">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LandingPage() {
  const { isPending } = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  if (isPending) {
    return <div className="min-h-screen bg-background" />;
  }

  const closeMenu = () => setMenuOpen(false);
  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const navItemTransition = { duration: 0.18, ease: EASE_OUT };

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Navigation */}
      <header className="relative z-20 px-4 pt-4 sm:px-6 sm:pt-6">
        <motion.nav
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-border bg-card/90 px-4 py-3 backdrop-blur-xl sm:px-5"
          aria-label="Main navigation"
        >
          <a
            href="#top"
            className="flex items-center gap-2.5 transition-transform active:scale-[0.98]"
            onClick={closeMenu}
          >
            <Logo className="size-7 text-foreground" />
            <span className="text-sm font-semibold tracking-[-0.02em]">Memsystems</span>
          </a>

          <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a
              href="#why"
              className="transition-colors duration-150 ease-out hover:text-foreground active:scale-[0.98]"
            >
              Why it works
            </a>
            <a
              href="#how"
              className="transition-colors duration-150 ease-out hover:text-foreground active:scale-[0.98]"
            >
              How it works
            </a>
            <a
              href="#faq"
              className="transition-colors duration-150 ease-out hover:text-foreground active:scale-[0.98]"
            >
              FAQ
            </a>
          </div>

          <Button
            render={<Link to="/login" />}
            className="hidden cursor-pointer md:inline-flex"
          >
            Start free
          </Button>

          {/* Mobile hamburger button with animated icon bars */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="relative flex size-9 items-center justify-center rounded-full text-foreground transition-transform active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
          >
            <motion.span
              animate={{
                rotate: menuOpen ? 45 : 0,
                y: menuOpen ? 0 : -4,
              }}
              transition={navItemTransition}
              className="absolute h-px w-4 bg-current"
            />
            <motion.span
              animate={{
                rotate: menuOpen ? -45 : 0,
                y: menuOpen ? 0 : 4,
              }}
              transition={navItemTransition}
              className="absolute h-px w-4 bg-current"
            />
          </button>
        </motion.nav>

        {/* Mobile Menu Drawer */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="fixed inset-0 -z-10 flex flex-col justify-center bg-background/95 px-8 backdrop-blur-3xl md:hidden"
            >
              <div className="flex flex-col gap-6 text-4xl font-semibold tracking-[-0.05em]">
                {[
                  ["Why it works", "#why"],
                  ["How it works", "#how"],
                  ["FAQ", "#faq"],
                ].map(([label, href], index) => (
                  <motion.a
                    key={label}
                    href={href}
                    onClick={closeMenu}
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: 0.05 + index * 0.04,
                      ease: EASE_OUT,
                    }}
                    className="transition-colors hover:text-primary active:scale-[0.98]"
                  >
                    {label}
                  </motion.a>
                ))}
                <motion.div
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.2, ease: EASE_OUT }}
                >
                  <Button
                    render={<Link to="/login" onClick={closeMenu} />}
                    size="lg"
                    className="mt-4 w-fit cursor-pointer text-base"
                  >
                    Start free
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="main-content">
        {/* Hero Section */}
        <section
          id="top"
          className="mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28 lg:pb-32 lg:pt-36"
        >
          <div className="mx-auto max-w-3xl text-center">
            <motion.h1
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mx-auto max-w-2xl text-5xl font-semibold leading-none tracking-[-0.06em] text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground text-balance sm:text-7xl"
            >
              Think with your sources, not around them.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT }}
              className="mx-auto mt-6 max-w-xl text-lg leading-7 text-muted-foreground text-pretty sm:text-xl"
            >
              Memsystems brings research, notes, and AI into one quiet workspace so you can go
              from scattered reading to a point of view.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16, ease: EASE_OUT }}
              className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            >
              <Button
                render={<Link to="/login" />}
                size="lg"
                className="cursor-pointer gap-2 px-5 py-3 text-base font-semibold"
              >
                Start building your notebook <ArrowUpRight />
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="why" className="border-y border-border bg-card px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="mb-12 flex flex-col gap-4 md:mb-16 md:flex-row md:items-end md:justify-between"
            >
              <div>
                <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  The difference
                </p>
                <h2 className="max-w-xl text-3xl font-semibold tracking-tighter text-balance sm:text-5xl">
                  Make the work easier to return to.
                </h2>
              </div>
              <p className="max-w-sm text-base leading-6 text-muted-foreground text-pretty">
                A useful notebook does not just hold information. It gives the next thought
                somewhere to land.
              </p>
            </motion.div>

            <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
              {benefits.map((benefit, index) => (
                <motion.article
                  key={benefit.label}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.08,
                    ease: EASE_OUT,
                  }}
                  className="group relative bg-card p-6 transition-colors duration-200 hover:bg-card/90 sm:p-8"
                >
                  <p className="mb-16 font-mono text-xs uppercase tracking-[0.15em] text-primary">
                    {benefit.label}
                  </p>
                  <h3 className="mb-4 text-2xl font-semibold leading-tight tracking-[-0.04em] text-balance">
                    {benefit.title}
                  </h3>
                  <p className="text-base leading-6 text-muted-foreground text-pretty">
                    {benefit.body}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Editorial Scroll-Progress Word Reveal */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-36">
          <ScrollWordReveal text="Good research is not more tabs. It is a clear path through what you already know." />
        </section>

        {/* Workflow Section */}
        <section
          id="how"
          className="border-y border-border bg-secondary px-4 py-20 text-secondary-foreground sm:px-6 sm:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="mb-12 flex flex-col gap-4 md:mb-16 md:flex-row md:justify-between"
            >
              <div>
                <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  A calmer workflow
                </p>
                <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                  From first source to a study system.
                </h2>
              </div>
              <p className="max-w-sm text-base leading-6 text-muted-foreground text-pretty">
                Keep the messy middle. Memsystems helps you make it legible.
              </p>
            </motion.div>

            <div className="grid gap-10 md:grid-cols-3">
              {workflows.map((item, index) => (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.08,
                    ease: EASE_OUT,
                  }}
                  className="border-t border-secondary-foreground/20 pt-5"
                >
                  <p className="mb-12 font-mono text-xs text-muted-foreground">{item.step}</p>
                  <h3 className="mb-3 text-2xl font-semibold tracking-[-0.04em]">{item.title}</h3>
                  <p className="max-w-xs text-base leading-6 text-muted-foreground text-pretty">
                    {item.body}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial Quote */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:items-start"
          >
            <div>
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Built for the long read
              </p>
              <h2 className="max-w-sm text-3xl font-semibold tracking-[-0.05em] text-balance sm:text-4xl">
                Your best ideas deserve better than a browser tab.
              </h2>
            </div>
            <blockquote className="border-l border-primary pl-6">
              <p className="max-w-2xl text-2xl leading-tight tracking-[-0.04em] text-balance sm:text-4xl">
                “I can finally see the argument I am building, not just the articles I have opened.”
              </p>
              <footer className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Maya Chen / graduate researcher
              </footer>
            </blockquote>
          </motion.div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="border-t border-border bg-card px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="mb-10"
            >
              <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
                Questions worth answering.
              </h2>
            </motion.div>

            <div className="border-t border-border">
              {faqs.map(([question, answer], index) => (
                <FaqAccordionItem
                  key={question}
                  question={question}
                  answer={answer}
                  isOpen={openFaqIndex === index}
                  onToggle={() => toggleFaq(index)}
                  shouldReduceMotion={!!shouldReduceMotion}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="px-4 py-24 sm:px-6 sm:py-36">
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="mx-auto max-w-4xl text-center"
          >
            <h2 className="text-4xl font-semibold tracking-[-0.06em] text-balance sm:text-6xl">
              Make room for the thought after the thought.
            </h2>
            <Button
              render={<Link to="/login" />}
              size="lg"
              className="mt-8 cursor-pointer gap-2 px-5 py-3 text-base font-semibold"
            >
              Start building your notebook <ArrowUpRight />
            </Button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <a
            href="#top"
            className="flex items-center gap-2 text-foreground transition-transform active:scale-[0.98]"
          >
            <Logo className="size-5 text-foreground" />
            <span className="font-semibold">Memsystems</span>
          </a>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="#privacy" className="transition-colors hover:text-foreground">
              Privacy
            </a>
            <a href="#terms" className="transition-colors hover:text-foreground">
              Terms
            </a>
            <span id="privacy">© 2026 Memsystems</span>
            <span id="terms">Built for better questions.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
