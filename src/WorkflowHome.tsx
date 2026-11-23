import { ArrowRight, BookOpen, ClipboardCheck, ClipboardList, Database, FilePlus2, LockKeyhole, ShieldCheck, WifiOff } from 'lucide-react';
import type { Draft } from './storage';

type Props = {
  drafts: Draft[];
  onStart: () => void;
  onSchemes: () => void;
  onResume: (draft: Draft) => void;
};

const hasValue = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';

export function draftProgress(draft: Draft, totalFields: number): number {
  const values = Object.values(draft.answers).filter(hasValue).length;
  return totalFields > 0 ? Math.min(100, Math.round((values / totalFields) * 100)) : 0;
}

export default function WorkflowHome({ drafts, onStart, onSchemes, onResume }: Props) {
  const latest = drafts[0];
  return <>
    <section className="journey-welcome" aria-labelledby="journey-title">
      <div>
        <span className="journey-kicker"><BookOpen size={15}/> EASY FIELD GUIDE</span>
        <h2 id="journey-title">Collect irrigation information, one step at a time</h2>
        <p>Choose a scheme, answer the questions, and save your work. You can work without internet and return later.</p>
      </div>
      <button className="primary" onClick={latest ? () => onResume(latest) : onStart}>
        {latest ? 'Continue latest survey' : 'Start a survey'} <ArrowRight size={17}/>
      </button>
    </section>

    <section className="journey-section" aria-labelledby="journey-steps-title">
      <div className="journey-section-heading">
        <h2 id="journey-steps-title">Your work, step by step</h2>
        <p>Follow the steps in order. Grey steps are not yet connected to the main NIMIS service.</p>
      </div>
      <div className="journey-grid">
        <button type="button" className="journey-card" onClick={onSchemes}>
          <span className="journey-number">1</span>
          <Database size={23} aria-hidden="true"/>
          <strong>Find your scheme</strong>
          <span>Preview fictional scheme assignments. Official assignments are not connected yet.</span>
          <em>View demo schemes <ArrowRight size={15}/></em>
        </button>
        <button type="button" className="journey-card" onClick={onStart}>
          <span className="journey-number">2</span>
          <FilePlus2 size={23} aria-hidden="true"/>
          <strong>Collect information</strong>
          <span>Complete the baseline questionnaire in small sections.</span>
          <em>Start a survey <ArrowRight size={15}/></em>
        </button>
        <button type="button" className="journey-card" onClick={() => latest ? onResume(latest) : onStart()}>
          <span className="journey-number">3</span>
          <ClipboardList size={23} aria-hidden="true"/>
          <strong>Check and save</strong>
          <span>Open your saved work and fill in any missing information.</span>
          <em>{latest ? 'Continue saved survey' : 'Create first draft'} <ArrowRight size={15}/></em>
        </button>
        <div className="journey-card journey-card-pending" aria-label="Officer verification planned for a later phase">
          <span className="journey-number">4</span>
          <ClipboardCheck size={23} aria-hidden="true"/>
          <strong>Officer verification</strong>
          <span>District and provincial approval workflow will follow secure integration.</span>
          <em><LockKeyhole size={15}/> Coming in a later phase</em>
        </div>
        <div className="journey-card journey-card-pending" aria-label="Secure synchronization not available yet">
          <span className="journey-number">5</span>
          <ShieldCheck size={23} aria-hidden="true"/>
          <strong>Send to NIMIS</strong>
          <span>Authenticated synchronization is not connected. Your surveys remain local.</span>
          <em><WifiOff size={15}/> Not available yet</em>
        </div>
      </div>
    </section>

    {latest && <section className="continue-banner" aria-label="Resume recent work">
      <div><strong>Pick up where you left off</strong>
        <p>{String(latest.answers.scheme_name || 'Unnamed scheme')} · Last saved {new Date(latest.updatedAt).toLocaleString()}</p>
      </div>
      <button type="button" className="secondary" onClick={() => onResume(latest)}>Open draft <ArrowRight size={16}/></button>
    </section>}
  </>;
}
