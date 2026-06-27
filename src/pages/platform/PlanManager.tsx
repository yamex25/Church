/**
 * Subscription Plan Manager — Platform Owner only.
 *
 * Defines which modules are included in each subscription plan.
 * Changes here immediately affect all churches on that plan
 * (their module access is resolved at sign-in time).
 *
 * Priority order (highest → lowest):
 *   1. Church-specific overrides  (set per church in Platform Dashboard)
 *   2. Subscription plan rules    (managed here)
 *   3. System defaults
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutGrid, Save, Loader2, Check, RefreshCw,
  Info, CheckSquare, Square,
} from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { SUBSCRIPTION_PLANS } from '@/src/types';
import { MODULE_DEFS, ALL_MODULE_IDS, DEFAULT_PLAN_MODULES } from '@/src/lib/permissions';
import { cn } from '@/src/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanId = typeof SUBSCRIPTION_PLANS[number]['id'];

// ─── Module checkbox grid ─────────────────────────────────────────────────────

function ModuleGrid({
  selected, onChange,
}: {
  selected: string[];
  onChange: (m: string[]) => void;
}) {
  const all = selected.length === ALL_MODULE_IDS.length;

  // Group by category for better UX
  const groups = [
    {
      label: 'Core',
      ids: ['dashboard', 'members', 'home_cell', 'attendance', 'events', 'prayer', 'visitors'],
    },
    {
      label: 'Finance & HR',
      ids: ['finance', 'daily_expenses', 'hr', 'pledges', 'assets'],
    },
    {
      label: 'Operations',
      ids: ['requisitions', 'communications', 'ask'],
    },
    {
      label: 'Admin',
      ids: ['users', 'audit'],
    },
  ];

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(m => m !== id) : [...selected, id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wider text-church-gray">Included Modules</p>
        <button
          type="button"
          onClick={() => onChange(all ? [] : [...ALL_MODULE_IDS])}
          className="text-xs font-bold text-church-blue hover:underline"
        >
          {all ? 'Remove All' : 'Select All'}
        </button>
      </div>
      {groups.map(g => (
        <div key={g.label}>
          <p className="text-[10px] font-black uppercase tracking-wider text-church-gray/60 mb-2">{g.label}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {g.ids.map(id => {
              const m = MODULE_DEFS.find(d => d.id === id);
              if (!m) return null;
              const on = selected.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all text-sm',
                    on
                      ? 'bg-church-blue/5 border-church-blue/30 text-church-blue'
                      : 'bg-white border-gray-100 text-church-gray hover:border-church-blue/20',
                  )}
                >
                  <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                    on ? 'bg-church-blue border-church-blue' : 'border-gray-300')}>
                    {on && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{m.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlanManager() {
  const { user } = useAuth();

  // Which plan is being edited
  const [activePlan, setActivePlan] = useState<PlanId>('enterprise');
  // modules per plan (starts from Firestore, falls back to defaults)
  const [planModules, setPlanModules] = useState<Record<PlanId, string[]>>(() => {
    const rec: Record<string, string[]> = {};
    SUBSCRIPTION_PLANS.forEach(p => { rec[p.id] = [...(DEFAULT_PLAN_MODULES[p.id] ?? ALL_MODULE_IDS)]; });
    return rec as Record<PlanId, string[]>;
  });
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [savingPlan, setSavingPlan]   = useState<PlanId | null>(null);
  const [savedPlan, setSavedPlan]     = useState<PlanId | null>(null);
  const [dirty, setDirty]             = useState<Record<PlanId, boolean>>({} as any);

  // Load all plans from Firestore on mount
  useEffect(() => {
    const loadAll = async () => {
      for (const plan of SUBSCRIPTION_PLANS) {
        setLoadingPlan(plan.id as PlanId);
        try {
          const snap = await getDoc(doc(db, 'subscriptionPlanModules', plan.id));
          if (snap.exists()) {
            setPlanModules(prev => ({ ...prev, [plan.id]: snap.data().modules as string[] }));
          }
          // else: keep the default we initialised with
        } catch { /* keep defaults */ }
      }
      setLoadingPlan(null);
    };
    loadAll();
  }, []);

  const handleChange = (planId: PlanId, modules: string[]) => {
    setPlanModules(prev => ({ ...prev, [planId]: modules }));
    setDirty(prev => ({ ...prev, [planId]: true }));
  };

  const handleSave = async (planId: PlanId) => {
    if (!user) return;
    setSavingPlan(planId);
    try {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId)!;
      await setDoc(doc(db, 'subscriptionPlanModules', planId), {
        planId,
        planName: plan.name,
        modules: planModules[planId],
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      });
      setDirty(prev => ({ ...prev, [planId]: false }));
      setSavedPlan(planId);
      setTimeout(() => setSavedPlan(null), 2000);
    } catch (e) {
      alert('Failed to save plan. Please check your Firestore rules are published.');
    } finally {
      setSavingPlan(null);
    }
  };

  const handleReset = (planId: PlanId) => {
    if (!window.confirm(`Reset "${planId}" to system defaults?`)) return;
    const defaults = DEFAULT_PLAN_MODULES[planId] ?? [...ALL_MODULE_IDS];
    setPlanModules(prev => ({ ...prev, [planId]: defaults }));
    setDirty(prev => ({ ...prev, [planId]: true }));
  };

  const currentModules = planModules[activePlan] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-black text-church-black">Plan Manager</h1>
        <p className="text-church-gray text-sm mt-0.5">
          Configure which modules are included in each subscription plan.
          Changes take effect the next time a church user signs in.
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-church-blue/5 border border-church-blue/15 rounded-2xl px-5 py-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-church-blue flex-shrink-0 mt-0.5" />
        <p className="text-xs text-church-gray leading-relaxed">
          <strong className="text-church-black">Priority order:</strong>{' '}
          Church-specific overrides{' → '}Subscription plan rules (this page){' → '}System defaults.
          A church on Premium can still get Enterprise features if you grant an override from the Dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: plan selector */}
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-church-gray">Plans</p>
          {SUBSCRIPTION_PLANS.map(plan => {
            const active = activePlan === plan.id;
            const isDirty = dirty[plan.id as PlanId];
            const count = planModules[plan.id as PlanId]?.length ?? 0;
            return (
              <button
                key={plan.id}
                onClick={() => setActivePlan(plan.id as PlanId)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-left transition-all',
                  active
                    ? 'bg-church-blue/5 border-church-blue/30'
                    : 'bg-white border-gray-100 hover:border-church-blue/20',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-3 h-3 rounded-full flex-shrink-0', plan.badge.replace('text-', 'bg-').split(' ')[0])} />
                  <div>
                    <p className={cn('font-bold text-sm', active ? 'text-church-blue' : 'text-church-black')}>
                      {plan.name}
                    </p>
                    <p className="text-[10px] text-church-gray">{plan.priceLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isDirty && <span className="w-2 h-2 rounded-full bg-church-yellow" title="Unsaved changes" />}
                  <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', active ? 'bg-church-blue text-white' : 'bg-gray-100 text-gray-600')}>
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: module editor */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-church-blue/8 shadow-sm overflow-hidden">
          {/* Plan header */}
          {(() => {
            const plan = SUBSCRIPTION_PLANS.find(p => p.id === activePlan)!;
            return (
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-church-black">{plan.name} Plan</h3>
                    {loadingPlan === activePlan && <Loader2 className="w-3.5 h-3.5 animate-spin text-church-gray" />}
                  </div>
                  <p className="text-xs text-church-gray mt-0.5">
                    {currentModules.length} of {ALL_MODULE_IDS.length} modules included · {plan.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReset(activePlan)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-church-gray bg-church-soft rounded-xl hover:bg-gray-100 transition"
                    title="Reset to defaults"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                  <button
                    onClick={() => handleSave(activePlan)}
                    disabled={savingPlan === activePlan || !dirty[activePlan]}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition disabled:opacity-50',
                      savedPlan === activePlan
                        ? 'bg-emerald-500 text-white'
                        : 'bg-church-blue text-white hover:bg-church-blue/90',
                    )}
                  >
                    {savingPlan === activePlan
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : savedPlan === activePlan
                        ? <><Check className="w-3.5 h-3.5" /> Saved</>
                        : <><Save className="w-3.5 h-3.5" /> Save Plan</>}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Module grid */}
          <div className="p-6">
            <ModuleGrid
              selected={currentModules}
              onChange={modules => handleChange(activePlan, modules)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
