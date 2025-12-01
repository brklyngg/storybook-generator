'use client';

import { cn } from '@/lib/utils';
import { WorkflowState } from '@/lib/types';
import { Check, FileText, Users, Image, Sparkles } from 'lucide-react';

interface WorkflowStep {
  id: WorkflowState;
  label: string;
  icon: React.ReactNode;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'plan_review', label: 'Review Plan', icon: <FileText className="w-4 h-4" /> },
  { id: 'characters_generating', label: 'Characters', icon: <Users className="w-4 h-4" /> },
  { id: 'pages_generating', label: 'Generate Pages', icon: <Image className="w-4 h-4" /> },
  { id: 'complete', label: 'Complete', icon: <Sparkles className="w-4 h-4" /> },
];

// Map states to their position in the workflow
const STATE_ORDER: Record<WorkflowState, number> = {
  'idle': -1,
  'plan_pending': 0,
  'plan_review': 0,
  'story_preview': 0,
  'characters_generating': 1,
  'character_review': 1,
  'pages_generating': 2,
  'complete': 3,
  'error': -1,
};

interface WorkflowStepperProps {
  currentState: WorkflowState;
  showCharacterReview?: boolean;
}

export function WorkflowStepper({ currentState, showCharacterReview = false }: WorkflowStepperProps) {
  const currentPosition = STATE_ORDER[currentState];

  // Modify steps if character review is enabled
  const steps = showCharacterReview
    ? [
        WORKFLOW_STEPS[0],
        { id: 'character_review' as WorkflowState, label: 'Review Characters', icon: <Users className="w-4 h-4" /> },
        WORKFLOW_STEPS[2],
        WORKFLOW_STEPS[3],
      ]
    : WORKFLOW_STEPS;

  // Recalculate positions with character review step
  const getStepPosition = (stepId: WorkflowState): number => {
    if (showCharacterReview) {
      const positionMap: Record<WorkflowState, number> = {
        'idle': -1,
        'plan_pending': 0,
        'plan_review': 0,
        'story_preview': 0,
        'characters_generating': 1,
        'character_review': 1,
        'pages_generating': 2,
        'complete': 3,
        'error': -1,
      };
      return positionMap[stepId];
    }
    return STATE_ORDER[stepId];
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((step, index) => {
        const stepPosition = index;
        const isCompleted = currentPosition > stepPosition;
        const isCurrent = currentPosition === stepPosition;
        const isPending = currentPosition < stepPosition;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300',
                  isCompleted && 'bg-emerald-600 text-white',
                  isCurrent && 'bg-amber-600 text-white ring-4 ring-amber-200',
                  isPending && 'bg-stone-200 text-stone-500'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  step.icon
                )}
              </div>
              <span
                className={cn(
                  'mt-1 text-xs font-medium hidden sm:block',
                  isCompleted && 'text-emerald-700',
                  isCurrent && 'text-amber-700',
                  isPending && 'text-stone-400'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-8 sm:w-12 h-0.5 mx-1 sm:mx-2 transition-colors duration-300',
                  currentPosition > stepPosition ? 'bg-emerald-600' : 'bg-stone-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
