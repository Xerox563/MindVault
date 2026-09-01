"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  PieChart,
  BarChart3,
  AlertCircle,
  Settings,
  Loader2,
  ChevronRight,
  Calendar,
  Users,
  CreditCard,
  Activity,
  FileText,
  Brain
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CostStats {
  total_cost: number;
  total_tokens: number;
  total_requests: number;
  today_cost: number;
  month_cost: number;
  by_provider: Array<{
    provider: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
  by_operation: Array<{
    operation: string;
    cost: number;
    tokens: number;
  }>;
  daily: Array<{
    date: string;
    cost: number;
    tokens: number;
  }>;
  period_days: number;
}

interface BudgetData {
  monthly_budget: number;
  alert_threshold: number;
  alert_email: string | null;
  last_alert_sent: string | null;
  current_usage: {
    should_alert: boolean;
    monthly_budget: number;
    current_cost: number;
    percentage: number;
    threshold_percentage: number;
  } | null;
}

interface CostResponse {
  stats: CostStats;
  budget: BudgetData;
  alert: {
    should_alert: boolean;
    monthly_budget: number;
    current_cost: number;
    percentage: number;
    threshold_percentage: number;
  } | null;
  days: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short'
  }).format(value);
};

const getProviderColor = (provider: string) => {
  const colors: Record<string, string> = {
    'mistral': 'bg-blue-500',
    'ollama': 'bg-green-500',
    'gemini': 'bg-amber-500',
    'openrouter': 'bg-pink-500',
    'default': 'bg-gray-500'
  };
  const key = provider.toLowerCase();
  const prefix = Object.keys(colors).find((p) => p !== 'default' && key.startsWith(p));
  return prefix ? colors[prefix] : colors.default;
};

export default function CostDashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CostResponse | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    monthly_budget: 50,
    alert_threshold: 0.8,
    alert_email: ''
  });

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchCostData();
    }
  }, [isLoaded, isSignedIn, selectedPeriod]);

  const fetchCostData = async () => {
    const token = await getToken();
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cost/stats?days=${selectedPeriod}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setData(data);
        if (data.budget) {
          setBudgetForm({
            monthly_budget: data.budget.monthly_budget,
            alert_threshold: data.budget.alert_threshold,
            alert_email: data.budget.alert_email || ''
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch cost data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateBudget = async () => {
    const token = await getToken();
    if (!token) return;
    
    try {
      const res = await fetch(`${API_URL}/api/cost/budget`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(budgetForm),
      });
      
      if (res.ok) {
        await fetchCostData();
        setShowBudgetModal(false);
      }
    } catch (error) {
      console.error("Failed to update budget:", error);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center">
        <p className="text-white mb-4">Please sign in to access the dashboard</p>
        <Link href="/login">
          <button className="px-6 py-3 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-700">
            Sign In
          </button>
        </Link>
      </div>
    );
  }

  const stats = data?.stats;
  const budget = data?.budget;
  const alert = data?.alert;
  const budgetPercentage = alert?.percentage || 0;
  const isNearLimit = budgetPercentage >= (budget?.alert_threshold || 0.8) * 100;

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">Cost Monitoring</h1>
                <p className="text-sm text-gray-400">Track your LLM usage and spending</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <div className="flex bg-white/5 rounded-lg p-1">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setSelectedPeriod(days)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                      selectedPeriod === days 
                        ? 'bg-white/10 text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
              
              {/* Settings Button */}
              <motion.button
                onClick={() => setShowBudgetModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">Budget Settings</span>
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert Banner */}
        {isNearLimit && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-400">
                Approaching Budget Limit
              </p>
              <p className="text-sm text-orange-300/80">
                You've used {budgetPercentage.toFixed(1)}% of your monthly budget
              </p>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Cost */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">Total Cost</span>
            </div>
            <p className="text-2xl font-semibold">{formatCurrency(stats?.total_cost || 0)}</p>
            <p className="text-sm text-gray-500 mt-1">Last {selectedPeriod} days</p>
          </motion.div>

          {/* This Month */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">This Month</span>
            </div>
            <p className="text-2xl font-semibold">{formatCurrency(stats?.month_cost || 0)}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    budgetPercentage > 90 ? 'bg-red-500' : budgetPercentage > 70 ? 'bg-orange-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{budgetPercentage.toFixed(0)}%</span>
            </div>
          </motion.div>

          {/* Total Tokens */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-gray-400">Total Tokens</span>
            </div>
            <p className="text-2xl font-semibold">{formatNumber(stats?.total_tokens || 0)}</p>
            <p className="text-sm text-gray-500 mt-1">Across all requests</p>
          </motion.div>

          {/* Total Requests */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-sm text-gray-400">Total Requests</span>
            </div>
            <p className="text-2xl font-semibold">{formatNumber(stats?.total_requests || 0)}</p>
            <p className="text-sm text-gray-500 mt-1">API calls</p>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Cost Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold">Daily Cost</h3>
              </div>
              <span className="text-sm text-gray-500">Last {selectedPeriod} days</span>
            </div>
            
            <div className="h-48 flex items-end gap-1">
              {stats?.daily?.map((day, i) => {
                const maxCost = Math.max(...(stats?.daily?.map(d => d.cost) || [1]));
                const height = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
                return (
                  <motion.div
                    key={day.date}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 5)}%` }}
                    transition={{ delay: i * 0.02, duration: 0.3 }}
                    className="flex-1 bg-purple-500/50 hover:bg-purple-500 rounded-t-sm relative group cursor-pointer"
                    title={`${day.date}: ${formatCurrency(day.cost)}`}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {formatCurrency(day.cost)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>{stats?.daily?.[0]?.date}</span>
              <span>{stats?.daily?.[stats.daily.length - 1]?.date}</span>
            </div>
          </motion.div>

          {/* Cost by Provider */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <PieChart className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold">Cost by Provider</h3>
              </div>
            </div>
            
            <div className="space-y-4">
              {stats?.by_provider?.map((provider, i) => (
                <div key={provider.provider} className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${getProviderColor(provider.provider)}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{provider.provider}</span>
                      <span className="text-sm text-gray-400">{formatCurrency(provider.cost)}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(provider.cost / (stats?.total_cost || 1)) * 100}%` }}
                        transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
                        className={`h-full rounded-full ${getProviderColor(provider.provider)}`}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right">
                    {formatNumber(provider.tokens)} tokens
                  </span>
                </div>
              ))}
              
              {(!stats?.by_provider || stats.by_provider.length === 0) && (
                <p className="text-center text-gray-500 py-8">No data yet</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Budget Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold">Budget Status</h3>
            </div>
            <button
              onClick={() => setShowBudgetModal(true)}
              className="text-sm text-purple-400 hover:text-purple-300"
            >
              Edit Budget
            </button>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Monthly Budget</span>
                <span className="text-sm font-medium">{formatCurrency(budget?.monthly_budget || 0)}</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                  transition={{ duration: 0.8 }}
                  className={`h-full rounded-full transition-colors ${
                    budgetPercentage > 90 ? 'bg-red-500' : 
                    budgetPercentage > 70 ? 'bg-orange-500' : 
                    'bg-green-500'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">
                  Used: {formatCurrency(stats?.month_cost || 0)}
                </span>
                <span className={`text-xs ${isNearLimit ? 'text-orange-400' : 'text-gray-500'}`}>
                  {budgetPercentage.toFixed(1)}% used
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-2xl font-semibold">{formatCurrency((budget?.monthly_budget || 0) - (stats?.month_cost || 0))}</p>
              <p className="text-sm text-gray-500">Remaining</p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Budget Settings Modal */}
      <AnimatePresence>
        {showBudgetModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBudgetModal(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 m-auto w-[480px] h-fit bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-semibold">Budget Settings</h3>
                <button onClick={() => setShowBudgetModal(false)}>
                  <span className="text-gray-400 hover:text-white">✕</span>
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Monthly Budget (USD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="number"
                      value={budgetForm.monthly_budget}
                      onChange={(e) => setBudgetForm({...budgetForm, monthly_budget: parseFloat(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Alert Threshold ({(budgetForm.alert_threshold * 100).toFixed(0)}%)
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.05"
                    value={budgetForm.alert_threshold}
                    onChange={(e) => setBudgetForm({...budgetForm, alert_threshold: parseFloat(e.target.value)})}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>50%</span>
                    <span>95%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Alert Email (optional)</label>
                  <input
                    type="email"
                    value={budgetForm.alert_email}
                    onChange={(e) => setBudgetForm({...budgetForm, alert_email: e.target.value})}
                    placeholder="you@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <button
                  onClick={updateBudget}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
