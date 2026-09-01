"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Upload,
  MessageSquare,
  Brain,
  Zap,
  Shield,
  Sparkles,
  FileText,
  Search,
  Cloud,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const FEATURES = [
  {
    icon: Upload,
    title: "Smart Upload",
    description: "Drop in PDFs, Word docs, spreadsheets, whatever. The AI reads and indexes it all.",
    color: "var(--candy-yellow)",
    blob: "blob-1",
    rotate: -3,
  },
  {
    icon: MessageSquare,
    title: "Natural Chat",
    description: "Ask questions like a normal person. Get real answers with the receipts to prove it.",
    color: "var(--candy-pink)",
    blob: "blob-2",
    rotate: 2,
  },
  {
    icon: Brain,
    title: "Actually Smart AI",
    description: "Pick Mistral, Gemini, OpenRouter, or run it fully local. Your call, your keys.",
    color: "var(--candy-lavender)",
    blob: "blob-3",
    rotate: -2,
  },
  {
    icon: Cloud,
    title: "Google Drive Sync",
    description: "Connect Drive once and everything in it becomes searchable. No more digging.",
    color: "var(--candy-lime)",
    blob: "blob-4",
    rotate: 3,
  },
  {
    icon: Shield,
    title: "Your Data, Locked Up",
    description: "Encrypted keys, scoped access, workspaces with real permissions. Nothing leaky.",
    color: "var(--candy-cyan)",
    blob: "blob-1",
    rotate: 2,
  },
  {
    icon: Zap,
    title: "Fast, For Real",
    description: "Streaming answers, hybrid search, background indexing. No spinning wheels of doom.",
    color: "var(--candy-orange)",
    blob: "blob-2",
    rotate: -3,
  },
];

const STEPS = [
  {
    step: "1",
    icon: Upload,
    title: "Chuck your files in",
    description: "PDFs, DOCX, XLSX, TXT, or plug in Google Drive. Whatever you've got.",
    color: "var(--candy-yellow)",
  },
  {
    step: "2",
    icon: FileText,
    title: "Let it think",
    description: "It reads everything, chunks it up, and builds a searchable brain out of your docs.",
    color: "var(--candy-pink)",
  },
  {
    step: "3",
    icon: Search,
    title: "Ask it anything",
    description: "Plain English questions in, sourced answers out. Click a source to see exactly where it came from.",
    color: "var(--candy-lavender)",
  },
];

function CandyBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 candy-mesh" />
      <div className="absolute inset-0 candy-dot-grid" />
      <motion.div
        className="absolute -top-40 -left-32 w-[500px] h-[500px] rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, var(--candy-yellow) 0%, transparent 70%)", filter: "blur(90px)" }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/4 -right-40 w-[550px] h-[550px] rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, var(--candy-pink) 0%, transparent 70%)", filter: "blur(100px)" }}
        animate={{ x: [0, -50, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute bottom-0 left-1/4 w-[450px] h-[450px] rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, var(--candy-cyan) 0%, transparent 70%)", filter: "blur(90px)" }}
        animate={{ x: [0, 40, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, var(--candy-lavender) 0%, transparent 70%)", filter: "blur(90px)" }}
        animate={{ x: [0, -30, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
    </div>
  );
}

function StickerBadge({ children, color, className = "" }: { children: React.ReactNode; color: string; className?: string }) {
  return (
    <span
      className={`sticker-sm inline-flex items-center gap-1.5 px-3 py-1.5 font-grotesk text-sm font-bold rounded-full ${className}`}
      style={{ background: color, color: "var(--candy-ink)" }}
    >
      {children}
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="candy-theme isolate min-h-screen overflow-x-hidden font-grotesk">
      <CandyBackground />
      <nav className="sticky top-0 z-50 border-b-[3px] border-[var(--candy-ink)]" style={{ background: "var(--candy-bg)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div className="flex items-center gap-2" whileHover={{ rotate: -4 }}>
            <div className="sticker-sm w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "var(--candy-yellow)" }}>
              <Brain className="w-5 h-5" style={{ color: "var(--candy-ink)" }} />
            </div>
            <span className="font-marker text-2xl">MindVault</span>
          </motion.div>

          <div className="hidden md:flex items-center gap-8 font-bold text-sm">
            {["Features", "How it Works"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="hover:opacity-60 transition-opacity"
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <motion.button className="text-sm font-bold hover:opacity-60 transition-opacity" whileTap={{ scale: 0.95 }}>
                Sign In
              </motion.button>
            </Link>
            <Link href="/signup">
              <motion.button
                className="sticker-sm px-4 py-2 text-sm font-bold rounded-full"
                style={{ background: "var(--candy-lime)", color: "var(--candy-ink)" }}
                whileHover={{ y: -2, rotate: -1 }}
                whileTap={{ scale: 0.95, y: 0 }}
              >
                Get Started
              </motion.button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative pt-20 pb-32 px-6">
        <motion.div
          className="absolute top-24 left-[6%] hidden lg:block bob"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: "spring" }}
        >
          <StickerBadge color="var(--candy-cyan)">✦ AI-powered</StickerBadge>
        </motion.div>
        <motion.div
          className="absolute top-52 right-[8%] hidden lg:block bob"
          style={{ animationDelay: "1.2s" }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring" }}
        >
          <StickerBadge color="var(--candy-pink)">☆ instant answers</StickerBadge>
        </motion.div>

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block mb-8"
          >
            <StickerBadge color="var(--candy-yellow)">
              <Sparkles className="w-3.5 h-3.5" />
              Mistral, Gemini, OpenRouter, or fully local
            </StickerBadge>
          </motion.div>

          <motion.h1
            className="font-marker text-5xl md:text-7xl leading-tight mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            your documents,
            <br />
            <span className="inline-block -rotate-2" style={{ color: "var(--candy-pink)" }}>
              actually
            </span>{" "}
            make sense now
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl font-bold max-w-xl mx-auto mb-10"
            style={{ color: "var(--candy-ink-soft)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            Upload your files, ask questions in plain English, get real answers with sources. No more Ctrl+F through fifty PDFs.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Link href="/signup">
              <motion.button
                className="sticker group px-8 py-4 rounded-full font-marker text-lg flex items-center gap-2"
                style={{ background: "var(--candy-yellow)", color: "var(--candy-ink)" }}
                whileHover={{ y: -3, rotate: -1 }}
                whileTap={{ scale: 0.96, y: 0 }}
              >
                open your vault
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </Link>
            <motion.button
              className="sticker px-8 py-4 rounded-full font-marker text-lg"
              style={{ background: "var(--candy-card)", color: "var(--candy-ink)" }}
              whileHover={{ y: -3, rotate: 1 }}
              whileTap={{ scale: 0.96, y: 0 }}
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              see how it works
            </motion.button>
          </motion.div>

          <motion.div
            className="sticker blob-2 mt-20 mx-auto max-w-md p-6 text-left"
            style={{ background: "var(--candy-card)" }}
            initial={{ opacity: 0, y: 40, rotate: -2 }}
            whileInView={{ opacity: 1, y: 0, rotate: -2 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="font-bold text-sm mb-2" style={{ color: "var(--candy-ink-soft)" }}>You asked:</p>
            <p className="font-grotesk font-bold mb-4">&ldquo;What was our Q3 revenue?&rdquo;</p>
            <p className="font-bold text-sm mb-2" style={{ color: "var(--candy-ink-soft)" }}>MindVault answered:</p>
            <p className="font-grotesk">Q3 revenue was $2.4M, up 18% from Q2, from page 4 of Q3_Report.pdf ✦</p>
          </motion.div>
        </div>
      </section>

      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-marker text-4xl md:text-5xl mb-4">everything you actually need</h2>
            <p className="font-bold text-lg" style={{ color: "var(--candy-ink-soft)" }}>
              no bloat, just the stuff that makes document chaos manageable
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                className={`sticker ${feature.blob} p-7`}
                style={{ background: "var(--candy-card)", rotate: `${feature.rotate}deg` }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: (index % 3) * 0.1 }}
                whileHover={{ y: -6, rotate: 0 }}
              >
                <div
                  className="sticker-sm w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: feature.color }}
                >
                  <feature.icon className="w-7 h-7" style={{ color: "var(--candy-ink)" }} />
                </div>
                <h3 className="font-marker text-xl mb-2">{feature.title}</h3>
                <p className="font-grotesk font-medium leading-relaxed" style={{ color: "var(--candy-ink-soft)" }}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-marker text-4xl md:text-5xl mb-4">how it works</h2>
            <p className="font-bold text-lg" style={{ color: "var(--candy-ink-soft)" }}>three steps, zero headaches</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="text-center"
              >
                <motion.div
                  className="sticker w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 font-marker text-3xl"
                  style={{ background: item.color, color: "var(--candy-ink)" }}
                  whileHover={{ rotate: 8, scale: 1.08 }}
                >
                  {item.step}
                </motion.div>
                <h3 className="font-marker text-2xl mb-3">{item.title}</h3>
                <p className="font-grotesk font-medium leading-relaxed" style={{ color: "var(--candy-ink-soft)" }}>
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <motion.div
          className="sticker blob-3 max-w-4xl mx-auto px-8 py-16 md:px-16 text-center"
          style={{ background: "var(--candy-lavender)" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-marker text-4xl md:text-5xl mb-6" style={{ color: "var(--candy-ink)" }}>
            stop losing your documents
            <br />
            in the void
          </h2>
          <p className="font-bold text-lg mb-10 max-w-xl mx-auto" style={{ color: "var(--candy-ink)" }}>
            it&apos;s free to start, takes two minutes, and your files are actually searchable by the end of it
          </p>
          <Link href="/signup">
            <motion.button
              className="sticker px-8 py-4 rounded-full font-marker text-lg inline-flex items-center gap-2"
              style={{ background: "var(--candy-yellow)", color: "var(--candy-ink)" }}
              whileHover={{ y: -3, rotate: -1 }}
              whileTap={{ scale: 0.96, y: 0 }}
            >
              let&apos;s go
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
        </motion.div>
      </section>

      <footer className="py-12 px-6 border-t-[3px]" style={{ borderColor: "var(--candy-ink)" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="sticker-sm w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--candy-yellow)" }}>
              <Brain className="w-4 h-4" style={{ color: "var(--candy-ink)" }} />
            </div>
            <span className="font-marker text-lg">MindVault</span>
          </div>
          <p className="font-bold text-sm" style={{ color: "var(--candy-ink-soft)" }}>© 2026 MindVault. Built different.</p>
          <div className="flex items-center gap-6 font-bold text-sm">
            {["Privacy", "Terms", "Contact"].map((link) => (
              <a key={link} href="#" className="hover:opacity-60 transition-opacity">
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
