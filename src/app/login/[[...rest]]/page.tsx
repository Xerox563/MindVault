"use client";

import { SignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Brain } from "lucide-react";
import { AnimatedBackground, GradientText, FadeIn } from "@/components/animations";

export default function LoginPage({ params }: { params: { rest?: string[] } }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Floating Decorative Elements */}
      <motion.div
        className="absolute top-20 left-20 w-64 h-64 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{
          y: [0, -30, 0],
          x: [0, 20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 right-20 w-80 h-80 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        animate={{
          y: [0, 40, 0],
          x: [0, -30, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      
      <div className="relative z-10 w-full max-w-md px-6">
        <FadeIn>
          {/* Logo */}
          <motion.div 
            className="flex items-center justify-center gap-3 mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold">
              <GradientText>MindVault</GradientText>
            </span>
          </motion.div>
          
          {/* Clerk Sign In */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <SignIn 
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                  card: "glass-strong rounded-3xl shadow-2xl border-0",
                  headerTitle: "text-2xl font-bold text-white",
                  headerSubtitle: "text-gray-400",
                  socialButtonsBlockButton: "bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl",
                  socialButtonsBlockButtonText: "text-white font-medium",
                  formButtonPrimary: "bg-gradient-to-r from-violet-500 to-cyan-500 hover:opacity-90 rounded-xl",
                  formFieldInput: "bg-white/5 border-white/10 rounded-xl text-white placeholder-gray-500",
                  formFieldLabel: "text-gray-300",
                  footerActionLink: "text-violet-400 hover:text-violet-300",
                  dividerLine: "bg-white/10",
                  dividerText: "text-gray-500",
                  identityPreviewText: "text-white",
                  identityPreviewEditButton: "text-violet-400",
                  formFieldErrorText: "text-red-400",
                  alertText: "text-red-400",
                  spinner: "border-violet-500",
                },
              }}
              routing="path"
              path="/login"
              signUpUrl="/signup"
              redirectUrl="/dashboard"
              forceRedirectUrl="/dashboard"
            />
          </motion.div>
        </FadeIn>
      </div>
    </div>
  );
}
