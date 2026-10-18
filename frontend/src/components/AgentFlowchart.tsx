import React from 'react';
import { BookOpen, Briefcase, Calendar, Building2, CheckCircle2, Clock } from 'lucide-react';

export type NodeStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped';

export interface FlowchartState {
  rewrite: { status: NodeStatus; text?: string };
  router: { status: NodeStatus; domains: string[]; reasoning?: string; confidence?: number };
  agents: {
    academics: { status: NodeStatus; confidence?: number; preview?: string };
    placement: { status: NodeStatus; confidence?: number; preview?: string };
    events: { status: NodeStatus; confidence?: number; preview?: string };
    services: { status: NodeStatus; confidence?: number; preview?: string };
  };
  synthesizer: { status: NodeStatus; fallbackUsed?: boolean };
}

interface FlowchartProps {
  state: FlowchartState;
}

export const AgentFlowchart: React.FC<FlowchartProps> = ({ state }) => {
  const agentDefinitions = [
    {
      key: 'academics' as const,
      icon: BookOpen,
      name: 'Academic Regulations',
      subtext: 'Handbook 2024',
      domain: 'academics',
      activeColor: 'bg-emerald-500',
      iconColor: 'text-emerald-600',
    },
    {
      key: 'placement' as const,
      icon: Briefcase,
      name: 'Career Development Cell',
      subtext: 'Placement Rules',
      domain: 'placement',
      activeColor: 'bg-indigo-500',
      iconColor: 'text-indigo-600',
    },
    {
      key: 'events' as const,
      icon: Calendar,
      name: 'Student Activities & Fests',
      subtext: 'Campus Calendar',
      domain: 'events',
      activeColor: 'bg-amber-500',
      iconColor: 'text-amber-600',
    },
    {
      key: 'services' as const,
      icon: Building2,
      name: 'Housing & Campus Facilities',
      subtext: 'Campus Operations',
      domain: 'services',
      activeColor: 'bg-purple-500',
      iconColor: 'text-purple-600',
    },
  ];

  const activeDomainsCount = state.router.domains.length;
  const isRoutingActive = state.router.status === 'running' || state.rewrite.status === 'running';

  return (
    <section className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] mb-6 transition-all">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Connected Advisors for this Query
          </h2>
          {isRoutingActive && (
            <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium animate-pulse">
              <Clock size={11} className="animate-spin" /> Routing Query...
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {activeDomainsCount > 0
            ? `Coordinated across ${activeDomainsCount} university advisor${activeDomainsCount > 1 ? 's' : ''}`
            : 'Advisors ready on standby'}
        </span>
      </div>

      {/* Advisors Grid */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
        {agentDefinitions.map(advisor => {
          const isSelected = state.router.domains.includes(advisor.key);
          const agentState = state.agents[advisor.key];
          const isCompleted = agentState.status === 'completed';
          const isRunning = agentState.status === 'running';
          const IconComponent = advisor.icon;

          if (isSelected || isRunning || isCompleted) {
            return (
              <div
                key={advisor.key}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 font-medium shadow-2xs transition-all"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? `${advisor.activeColor} animate-pulse ring-2 ring-indigo-300` : advisor.activeColor
                  }`}
                />
                <IconComponent size={14} className={advisor.iconColor} />
                <span>{advisor.name}</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {advisor.subtext}
                </span>
                {isCompleted && <CheckCircle2 size={12} className="text-emerald-500 ml-0.5" />}
              </div>
            );
          }

          // Inactive / Standby state
          return (
            <div
              key={advisor.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-400 bg-transparent transition-opacity"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <IconComponent size={13} className="text-slate-400" />
              <span>{advisor.name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
