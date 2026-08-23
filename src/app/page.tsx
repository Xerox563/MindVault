"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Upload, 
  MessageSquare, 
  Brain, 
  Zap, 
  Shield,
  ChevronDown,
  Sparkles,
  FileText,
  Search,
  Cloud
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

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <AnimatedBackground />
      
      {/* Navigation */}
      <motion.nav 
        className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              MindVault
            </span>
          </motion.div>
          
          <div className="hidden md:flex items-center gap-8">
            {["Features", "How it Works", "Pricing"].map((item) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-sm text-gray-400 hover:text-white transition-colors"
                whileHover={{ y: -2 }}
              >
                {item}
              </motion.a>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <motion.button
                className="text-sm text-gray-300 hover:text-white transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Sign In
              </motion.button>
            </Link>
            <Link href="/signup">
              <motion.button
                className="px-5 py-2.5 text-sm font-medium rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/25"
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 20px 40px rgba(139, 92, 246, 0.4)"
                }}
                whileTap={{ scale: 0.95 }}
              >
                Get Started
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-20">
        <motion.div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ y, opacity }}
        >
          <div className="w-[800px] h-[800px] rounded-full bg-gradient-to-r from-violet-500/20 to-cyan-500/20 blur-[120px]" />
        </motion.div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
          >
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-gray-300">Powered by Mistral AI</span>
          </motion.div>
          
          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-bold leading-tight mb-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            Your Documents,
            <br />
            <GradientText className="font-extrabold">
              Supercharged by AI
            </GradientText>
          </motion.h1>
          
          <motion.p
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            Upload any document and chat with it intelligently. MindVault uses 
            advanced AI to understand your files and provide instant, accurate answers.
          </motion.p>
          
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          >
            <Link href="/signup">
              <motion.button
                className="group px-8 py-4 rounded-full bg-white text-black font-semibold flex items-center gap-2"
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
              Learn More
            </motion.button>
          </motion.div>
          
          {/* Hero Stats */}
          <motion.div
            className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
          >
            {[
              { value: "10M+", label: "Documents Processed" },
              { value: "99.9%", label: "Accuracy Rate" },
              { value: "50ms", label: "Response Time" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
        
        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2"
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <motion.div
              className="w-1.5 h-3 rounded-full bg-white/60"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
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
            {[
              {
                icon: Upload,
                title: "Smart Upload",
                description: "Drag and drop PDFs, Word docs, Excel files, and more. Our AI automatically processes and indexes your documents.",
                color: "from-violet-500 to-purple-500",
              },
              {
                icon: MessageSquare,
                title: "Natural Chat",
                description: "Ask questions in plain English. Get accurate answers with citations from your documents instantly.",
                color: "from-cyan-500 to-blue-500",
              },
              {
                icon: Brain,
                title: "AI Powered",
                description: "Built on Mistral AI's cutting-edge language models for deep understanding and intelligent responses.",
                color: "from-amber-500 to-orange-500",
              },
              {
                icon: Cloud,
                title: "Google Drive",
                description: "Connect your Google Drive and sync files automatically. Your documents, always accessible.",
                color: "from-emerald-500 to-green-500",
              },
              {
                icon: Shield,
                title: "Enterprise Security",
                description: "Bank-grade encryption, secure authentication, and complete data privacy for your sensitive documents.",
                color: "from-rose-500 to-pink-500",
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Sub-second response times. Our optimized infrastructure delivers answers faster than you can type.",
                color: "from-yellow-500 to-amber-500",
              },
            ].map((feature, index) => (
              <StaggerItem key={index}>
                <SpotlightCard className="h-full">
                  <motion.div
                    className="h-full p-8 rounded-2xl glass gradient-border group"
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                  </motion.div>
                </SpotlightCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-6 relative">
          <TextReveal className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Three simple steps to unlock the power of your documents
            </p>
          </TextReveal>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Upload,
                title: "Upload Your Documents",
                description: "Drag and drop files or connect your Google Drive. We support PDF, DOCX, XLSX, and TXT formats.",
              },
              {
                step: "02",
                icon: FileText,
                title: "AI Processing",
                description: "Our AI automatically extracts text, creates embeddings, and builds a searchable knowledge base.",
              },
              {
                step: "03",
                icon: Search,
                title: "Chat & Discover",
                description: "Ask questions in natural language. Get precise answers with citations from your documents.",
              },
            ].map((item, index) => (
              <FadeIn key={index} delay={index * 0.2}>
                <div className="relative">
                  <div className="text-6xl font-bold text-white/5 absolute -top-6 -left-2">
                    {item.step}
                  </div>
                  <div className="relative pt-8">
                    <motion.div
                      className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mb-6"
                      whileHover={{ rotate: 5, scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      <item.icon className="w-8 h-8 text-white" />
                    </motion.div>
                    <h3 className="text-2xl font-semibold mb-4">{item.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{item.description}</p>
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

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            className="relative rounded-3xl overflow-hidden"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-cyan-600/20" />
            <div className="absolute inset-0 glass-strong" />
            
            {/* Floating Elements */}
            <FloatingElement className="absolute top-10 right-10 opacity-50" delay={0}>
              <div className="w-20 h-20 rounded-full bg-violet-500/30 blur-xl" />
            </FloatingElement>
            <FloatingElement className="absolute bottom-10 left-10 opacity-50" delay={2}>
              <div className="w-32 h-32 rounded-full bg-cyan-500/30 blur-xl" />
            </FloatingElement>
            
            {/* Content */}
            <div className="relative z-10 px-8 py-20 md:px-16 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Ready to Transform Your
                  <br />
                  <GradientText>Document Workflow?</GradientText>
                </h2>
                <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
                  Join thousands of users who are already using MindVault to unlock 
                  the knowledge hidden in their documents.
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
                  <motion.button
                    className="px-8 py-4 rounded-full glass font-semibold"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    View Demo
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">MindVault</span>
            </div>
            <p className="text-gray-500 text-sm">
              © 2024 MindVault. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {["Privacy", "Terms", "Contact"].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
