"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, Eye, EyeOff, ArrowRight, Sparkles, Check, Lock, Mail } from "lucide-react";
import { AnimatedBackground, GradientText, FadeIn } from "@/components/animations";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Signup failed");
        setIsLoading(false);
        return;
      }
      
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  const passwordStrength = () => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^A-Za-z0-9]/)) strength++;
    return strength;
  };

  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Floating Decorative Elements */}
      <motion.div
        className="absolute top-20 right-20 w-64 h-64 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{
          y: [0, -30, 0],
          x: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 left-20 w-80 h-80 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        animate={{
          y: [0, 40, 0],
          x: [0, 30, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      
      <div className="relative z-10 w-full max-w-md px-6 py-10">
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
          
          {/* Card */}
          <motion.div
            className="glass-strong rounded-3xl p-8 shadow-2xl"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {isSuccess ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <Check className="w-10 h-10 text-green-400" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
                <p className="text-gray-400">Redirecting to login...</p>
              </motion.div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <motion.div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass mb-4"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-gray-300">Start Your Journey</span>
                  </motion.div>
                  <h1 className="text-3xl font-bold mb-2">Create Account</h1>
                  <p className="text-gray-400">Join thousands of users discovering their documents</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <motion.div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        required
                      />
                    </motion.div>
                  </div>
                  
                  {/* Password Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <motion.div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </motion.div>
                    
                    {/* Password Strength */}
                    {password && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2"
                      >
                        <div className="flex gap-1 h-1 mb-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={`flex-1 rounded-full transition-all duration-300 ${
                                i < passwordStrength() ? strengthColors[passwordStrength() - 1] : "bg-white/10"
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`text-xs ${passwordStrength() > 0 ? "text-gray-400" : "text-transparent"}`}>
                          {strengthLabels[passwordStrength() - 1] || "Too short"}
                        </p>
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Confirm Password Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm Password
                    </label>
                    <motion.div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full bg-white/5 border rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
                          confirmPassword && password !== confirmPassword
                            ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                            : "border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                        }`}
                        required
                      />
                    </motion.div>
                    {confirmPassword && password !== confirmPassword && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-red-400 mt-1"
                      >
                        Passwords do not match
                      </motion.p>
                    )}
                  </div>
                  
                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
                    >
                      {error}
                    </motion.div>
                  )}
                  
                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={isLoading || password !== confirmPassword}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25"
                    whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(6, 182, 212, 0.3)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLoading ? (
                      <motion.div
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </form>
                
                {/* Footer */}
                <div className="mt-8 text-center">
                  <p className="text-gray-400 text-sm">
                    Already have an account?{" "}
                    <Link href="/login">
                      <motion.span 
                        className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                        whileHover={{ scale: 1.05 }}
                      >
                        Sign In
                      </motion.span>
                    </Link>
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </FadeIn>
      </div>
    </div>
  );
}
