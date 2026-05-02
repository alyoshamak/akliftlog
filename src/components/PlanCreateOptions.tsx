import { LayoutGrid, Pencil, Upload, ChevronRight } from "lucide-react";

type Props = {
  onTemplate: () => void;
  onManual: () => void;
  onUpload: () => void;
  disabled?: boolean;
};

export default function PlanCreateOptions({ onTemplate, onManual, onUpload, disabled }: Props) {
  return (
    <div className="space-y-3">
      <button
        onClick={onTemplate}
        disabled={disabled}
        className="w-full surface-card p-5 text-left tap-56 hover:bg-surface-2 transition-colors flex items-start gap-4"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-bold">Start from a template</div>
          <div className="text-sm text-muted-foreground">PPL, Upper/Lower, Bro Split, Full Body, PHUL.</div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground self-center" />
      </button>
      <button
        onClick={onManual}
        disabled={disabled}
        className="w-full surface-card p-5 text-left tap-56 hover:bg-surface-2 transition-colors flex items-start gap-4"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Pencil className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-bold">Build from scratch</div>
          <div className="text-sm text-muted-foreground">Pick days and exercises yourself.</div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground self-center" />
      </button>
      <button
        onClick={onUpload}
        disabled={disabled}
        className="w-full surface-card p-5 text-left tap-56 hover:bg-surface-2 transition-colors flex items-start gap-4"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Upload className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-bold">Upload a plan</div>
          <div className="text-sm text-muted-foreground">PDF, image, spreadsheet, or text. We'll parse it.</div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground self-center" />
      </button>
    </div>
  );
}
