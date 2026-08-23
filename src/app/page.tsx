"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Upload, 
  MessageSquare, 
  Brain, 
  Zap, 
  Shield,
  Search,
  Cloud,
  Table,
  Hash,
  FileText,
  ChevronRight,
  Play,
  Star,
  Users,
  TrendingUp,
  Menu,
  X
} from "lucide-react";
import { 
  AnimatedBackground, 
  FloatingElement, 
  GradientText,
  TextReveal,
  FadeIn,
  StaggerContainer,
  StaggerItem,
  SpotlightCard
} from "@/components/animations";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";

const features = [
  { icon: Upload, title: "Smart Upload", desc: "Drag & drop PDFs, DOCX, XLSX. Auto-process & index.", color: "from-violet-500 to-purple-500" },
  { icon: MessageSquare, title: "Natural Chat", desc: "Ask questions in plain English. Get instant answers.", color: "from-cyan-500 to-blue-500" },
  { icon: Brain, title: "AI Powered", desc: "Mistral AI for deep understanding & intelligent responses.", color: "from-amber-500 to-orange-500" },
  { icon: Cloud, title: "Google Drive", desc: "Connect Drive, sync files automatically.", color: "from-emerald-500 to-green-500" },
  { icon: Table, title: "Google Sheets", desc: "Import & query your spreadsheets intelligently.", color: "from-green-500 to-teal-500" },
  { icon: Hash, title: "Slack", desc: "Search & chat with your Slack conversations.", color: "from-purple-500 to-pink-500" },
];

const integrations = [
  { icon: Cloud, name: "Google Drive", desc: "Sync files", color: "bg-emerald-500" },
  { icon: Table, name: "Google Sheets", desc: "Import data", color: "bg-green-500" },
  { icon: Hash, name: "Slack", desc: "Search messages", color: "bg-purple-500" },
  { icon: FileText, name: "Notion", desc: "Import pages", color: "bg-gray-500" },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "glass py-3" : "bg-transparent py-5"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.02 }}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            MindVault
          </span>
        </motion.div>
        
        <div className="hidden md:flex items-center gap-8">
          {["Features", "How it Works", "Integrations", "Pricing"].map((item, i) => (
            <motion.a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-sm text-gray-400 hover:text-white transition-colors relative group"
              whileHover={{ y: -2 }}
            >
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-violet-500 to-cyan-500 group-hover:w-full transition-all duration-300" />
            </motion.a>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="hidden sm:block">
            <motion.button
              className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Sign In
            </motion.button>
          </Link>
          <Link href="/signup">
            <motion.button
              className="px-5 py-2.5 text-sm font-medium rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
              whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(139, 92, 246, 0.4)" }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.button>
          </Link>
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden glass mt-2 mx-4 rounded-2xl p-4"
        >
          {["Features", "How it Works", "Integrations", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
              className="block py-3 text-gray-300 hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item}
            </a>
          ))}
        </motion.div>
      )}
    </motion.nav>
  );
}

function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);

  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 5,
    size: Math.random() * 4 + 2,
  }));

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      <AnimatedBackground />
      
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y, opacity, scale }}>
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-violet-500/20 to-cyan-500/20 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-amber-500/10 to-pink-500/10 blur-[80px]" />
      </motion.div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
        >
          <motion.span
            className="w-2 h-2 rounded-full bg-green-400"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-sm text-gray-300">Powered by Mistral AI</span>
        </motion.div>
        
        <motion.h1
          className="text-5xl md:text-7xl lg:text-8xl font-bold leading-tight mb-6"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          Your Knowledge,
          <br />
          <GradientText className="font-extrabold">Supercharged by AI</GradientText>
        </motion.h1>
        
        <motion.p
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          Connect Google Drive, Sheets, Slack & Notion. Chat with all your data 
          in one place. Instant answers with source citations.
        </motion.p>
        
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          <Link href="/signup">
            <motion.button
              className="group px-8 py-4 rounded-full bg-white text-black font-semibold flex items-center gap-2 shadow-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start for Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </Link>
          <motion.button
            className="px-8 py-4 rounded-full glass font-semibold flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Play className="w-4 h-4" />
            See How It Works
          </motion.button>
        </motion.div>

        <motion.div
          className="mt-16 flex justify-center gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute w-1 h-1 bg-violet-400 rounded-full"
              style={{ left: `${p.x}%`, top: `${30 + Math.random() * 40}%` }}
              animate={{ y: [-20, -100], opacity: [0, 1, 0] }}
              transition={{ duration: 4, repeat: Infinity, delay: p.delay }}
            />
          ))}
        </motion.div>
        
        <motion.div
          className="mt-24 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          {[
            { value: "10M+", label: "Documents", icon: TrendingUp },
            { value: "99.9%", label: "Accuracy", icon: Star },
            { value: "50ms", label: "Response", icon: Zap },
          ].map((stat, index) => (
            <motion.div
              key={index}
              className="text-center p-4 rounded-2xl glass"
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <stat.icon className="w-5 h-5 mx-auto mb-2 text-violet-400" />
              <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
      
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <motion.div
          className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <motion.div className="w-1.5 h-3 rounded-full bg-white/60" animate={{ y: [0, 12, 0] }} transition={{ duration: 1.5, repeat: Infinity }} />
        </motion.div>
      </motion.div>
    </section>
  );
}

function Integrations() {
  return (
    <section id="integrations" className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <TextReveal className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            All Your Data, <GradientText>One Place</GradientText>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Connect your favorite tools and chat with all your data unified
          </p>
        </TextReveal>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {integrations.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="p-6 rounded-2xl glass text-center cursor-pointer group"
            >
              <div className={`w-14 h-14 ${item.color} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                <item.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-semibold mb-1">{item.name}</h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <Link href="/signup">
            <motion.button
              className="px-6 py-3 rounded-full glass font-medium flex items-center gap-2 mx-auto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Connect Your Tools
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <TextReveal className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Everything You Need
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Powerful features that make document intelligence effortless
          </p>
        </TextReveal>
        
        <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <StaggerItem key={index}>
              <SpotlightCard>
                <motion.div
                  className="h-full p-8 rounded-2xl glass gradient-border group"
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                </motion.div>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { step: "01", icon: Cloud, title: "Connect Your Sources", desc: "Link Google Drive, Sheets, Slack, Notion in one click." },
    { step: "02", icon: Brain, title: "AI Indexes Everything", desc: "We extract, embed & store your data intelligently." },
    { step: "03", icon: Search, title: "Ask Anything", desc: "Get answers from all sources with citations." },
  ];

  return (
    <section id="how-it-works" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <TextReveal className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Three simple steps to unlock your knowledge</p>
        </TextReveal>
        
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((item, index) => (
            <FadeIn key={index} delay={index * 0.2}>
              <div className="relative">
                <div className="text-6xl font-bold text-white/5 absolute -top-6 -left-2">{item.step}</div>
                <div className="relative pt-8">
                  <motion.div
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mb-6"
                    whileHover={{ rotate: 5, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <item.icon className="w-8 h-8 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-semibold mb-4">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-gradient-to-r from-violet-500/50 to-transparent" />
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-32 relative">
      <div className="max-w-5xl mx-auto px-6">
        <TextReveal className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple Pricing</h2>
          <p className="text-gray-400 text-lg">Start free, scale as you grow</p>
        </TextReveal>
        
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            className="p-8 rounded-3xl glass border border-white/10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-bold mb-2">Free</h3>
            <div className="text-4xl font-bold mb-6">$0<span className="text-lg text-gray-400 font-normal">/mo</span></div>
            <ul className="space-y-3 mb-8">
              {["100MB storage", "5 documents", "Basic chat", "Google Drive"].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-400">
                  <Zap className="w-4 h-4 text-violet-400" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup">
              <motion.button
                className="w-full py-3 rounded-full glass font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Get Started
              </motion.button>
            </Link>
          </motion.div>
          
          <motion.div
            className="p-8 rounded-3xl glass border-2 border-violet-500/50 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-xs font-medium">Popular</div>
            <h3 className="text-2xl font-bold mb-2">Pro</h3>
            <div className="text-4xl font-bold mb-6">$19<span className="text-lg text-gray-400 font-normal">/mo</span></div>
            <ul className="space-y-3 mb-8">
              {["10GB storage", "Unlimited documents", "Advanced chat", "All integrations", "Priority support"].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <Zap className="w-4 h-4 text-cyan-400" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup">
              <motion.button
                className="w-full py-3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 font-medium"
                whileHover={{ scale: 1.02, boxShadow: "0 10px 30px rgba(139, 92, 246, 0.3)" }}
                whileTap={{ scale: 0.98 }}
              >
                Start Free Trial
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-32 relative">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          className="relative rounded-3xl overflow-hidden"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-cyan-600/20" />
          <div className="absolute inset-0 glass-strong" />
          <FloatingElement className="absolute top-10 right-10 opacity-50" delay={0}>
            <div className="w-20 h-20 rounded-full bg-violet-500/30 blur-xl" />
          </FloatingElement>
          <FloatingElement className="absolute bottom-10 left-10 opacity-50" delay={2}>
            <div className="w-32 h-32 rounded-full bg-cyan-500/30 blur-xl" />
          </FloatingElement>
          
          <div className="relative z-10 px-8 py-20 md:px-16 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ready to Transform Your
                <br />
                <GradientText>Workflow?</GradientText>
              </h2>
              <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
                Join thousands of users who are already using MindVault to unlock the knowledge hidden in their data.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup">
                  <motion.button
                    className="px-8 py-4 rounded-full bg-white text-black font-semibold flex items-center gap-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Get Started Free
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold">MindVault</span>
          </div>
          <p className="text-gray-500 text-sm">© 2024 MindVault. All rights reserved.</p>
          <div className="flex items-center gap-6">
            {["Privacy", "Terms", "Contact"].map((link) => (
              <a key={link} href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{link}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const { theme, mounted } = useTheme();

  if (!mounted) {
    return <div className="min-h-screen bg-[#0a0a0a] text-white" />;
  }

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#0a0a0a]" : "bg-gradient-to-br from-slate-50 to-slate-100"} text-white overflow-x-hidden transition-colors duration-300`}>
      <Navbar />
      <Hero />
      <Integrations />
      <Features />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}